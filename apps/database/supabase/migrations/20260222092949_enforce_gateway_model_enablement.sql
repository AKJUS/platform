-- Enforce ai_gateway_models is_enabled status in credit checks.
-- Gateway enablement is the FIRST check (highest priority), before plan
-- allocation or credit balance, so admins can globally kill-switch any model.
--
-- IMPORTANT: This replaces the 5-param overload (with p_user_id) that
-- callers actually invoke.  The previous migration (20260217130000) created
-- the 5-param version without a gateway-enabled guard.

CREATE OR REPLACE FUNCTION public.check_ai_credit_allowance(
  p_ws_id UUID,
  p_model_id TEXT,
  p_feature TEXT,
  p_estimated_input_tokens INTEGER DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining_credits NUMERIC,
  tier TEXT,
  max_output_tokens INTEGER,
  error_code TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_tier workspace_product_tier;
  v_allocation RECORD;
  v_balance RECORD;
  v_remaining NUMERIC;
  v_model RECORD;
  v_model_exists BOOLEAN;
  v_feature_access RECORD;
  v_daily_used NUMERIC;
  v_daily_request_count INTEGER;
  v_feature_daily_count INTEGER;
  v_effective_max_output INTEGER;
  v_estimated_cost NUMERIC;
  v_affordable_output INTEGER;
BEGIN
  -- ════════════════════════════════════════════════════════════════════
  -- 1. GATEWAY MODEL ENABLEMENT (highest priority — checked FIRST)
  -- ════════════════════════════════════════════════════════════════════
  SELECT EXISTS(
    SELECT 1 FROM public.ai_gateway_models gm
     WHERE gm.id = p_model_id
        OR gm.id = 'google/' || p_model_id
        OR 'google/' || gm.id = p_model_id
  ) INTO v_model_exists;

  IF v_model_exists THEN
    SELECT gm.max_tokens, gm.input_price_per_token, gm.output_price_per_token
      INTO v_model
      FROM public.ai_gateway_models gm
     WHERE (gm.id = p_model_id
            OR gm.id = 'google/' || p_model_id
            OR 'google/' || gm.id = p_model_id)
       AND gm.is_enabled = TRUE;

    IF NOT FOUND THEN
      RETURN QUERY SELECT FALSE, 0::NUMERIC, 'FREE'::TEXT, NULL::INTEGER,
        'MODEL_DISABLED'::TEXT,
        format('Model %s is currently disabled by administrators', p_model_id)::TEXT;
      RETURN;
    END IF;
  END IF;
  -- If model is not synced to ai_gateway_models yet, skip (graceful degradation)

  -- ════════════════════════════════════════════════════════════════════
  -- 2. WORKSPACE TIER + PLAN ALLOCATION
  -- ════════════════════════════════════════════════════════════════════
  v_tier := public._resolve_workspace_tier(p_ws_id);

  SELECT * INTO v_allocation
    FROM public.ai_credit_plan_allocations
   WHERE ai_credit_plan_allocations.tier = v_tier AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, v_tier::TEXT, NULL::INTEGER,
      'NO_ALLOCATION'::TEXT, 'No credit allocation configured for this tier'::TEXT;
    RETURN;
  END IF;

  -- ════════════════════════════════════════════════════════════════════
  -- 3. PLAN-LEVEL MODEL ALLOWLIST
  -- ════════════════════════════════════════════════════════════════════
  IF array_length(v_allocation.allowed_models, 1) > 0 THEN
    IF NOT (p_model_id = ANY(v_allocation.allowed_models)) THEN
      IF NOT EXISTS (
        SELECT 1 FROM unnest(v_allocation.allowed_models) AS m
        WHERE m = p_model_id OR split_part(m, '/', 2) = p_model_id
           OR p_model_id = split_part(m, '/', 2)
      ) THEN
        RETURN QUERY SELECT FALSE, 0::NUMERIC, v_tier::TEXT, NULL::INTEGER,
          'MODEL_NOT_ALLOWED'::TEXT,
          format('Model %s is not available on the %s plan', p_model_id, v_tier::TEXT)::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  -- ════════════════════════════════════════════════════════════════════
  -- 4. FEATURE ACCESS
  -- ════════════════════════════════════════════════════════════════════
  SELECT * INTO v_feature_access
    FROM public.ai_credit_feature_access fa
   WHERE fa.tier = v_tier AND fa.feature = p_feature;

  IF FOUND AND NOT v_feature_access.enabled THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, v_tier::TEXT, NULL::INTEGER,
      'FEATURE_NOT_ALLOWED'::TEXT,
      format('Feature %s is not available on the %s plan', p_feature, v_tier::TEXT)::TEXT;
    RETURN;
  END IF;

  -- ════════════════════════════════════════════════════════════════════
  -- 5. CREDIT BALANCE
  -- ════════════════════════════════════════════════════════════════════
  SELECT * INTO v_balance
    FROM public.get_or_create_credit_balance(p_ws_id, p_user_id);

  v_remaining := v_balance.total_allocated + v_balance.bonus_credits - v_balance.total_used;

  IF v_remaining <= 0 THEN
    RETURN QUERY SELECT FALSE, v_remaining, v_tier::TEXT, NULL::INTEGER,
      'CREDITS_EXHAUSTED'::TEXT,
      'Monthly AI credits have been used up'::TEXT;
    RETURN;
  END IF;

  -- ════════════════════════════════════════════════════════════════════
  -- 6. DAILY LIMITS
  -- ════════════════════════════════════════════════════════════════════
  IF v_allocation.daily_limit IS NOT NULL THEN
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_daily_used
      FROM public.ai_credit_transactions
     WHERE balance_id = v_balance.id
       AND transaction_type = 'deduction'
       AND created_at >= date_trunc('day', now());

    IF v_daily_used >= v_allocation.daily_limit THEN
      RETURN QUERY SELECT FALSE, v_remaining, v_tier::TEXT, NULL::INTEGER,
        'DAILY_LIMIT_REACHED'::TEXT,
        'Daily AI credit limit has been reached'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF v_allocation.max_requests_per_day IS NOT NULL THEN
    SELECT COUNT(*) INTO v_daily_request_count
      FROM public.ai_credit_transactions
     WHERE balance_id = v_balance.id
       AND transaction_type = 'deduction'
       AND created_at >= date_trunc('day', now());

    IF v_daily_request_count >= v_allocation.max_requests_per_day THEN
      RETURN QUERY SELECT FALSE, v_remaining, v_tier::TEXT, NULL::INTEGER,
        'DAILY_LIMIT_REACHED'::TEXT,
        'Daily AI request limit has been reached'::TEXT;
      RETURN;
    END IF;
  END IF;

  IF FOUND AND v_feature_access.max_requests_per_day IS NOT NULL THEN
    SELECT COUNT(*) INTO v_feature_daily_count
      FROM public.ai_credit_transactions
     WHERE balance_id = v_balance.id
       AND transaction_type = 'deduction'
       AND feature = p_feature
       AND created_at >= date_trunc('day', now());

    IF v_feature_daily_count >= v_feature_access.max_requests_per_day THEN
      RETURN QUERY SELECT FALSE, v_remaining, v_tier::TEXT, NULL::INTEGER,
        'DAILY_LIMIT_REACHED'::TEXT,
        format('Daily limit for %s has been reached', p_feature)::TEXT;
      RETURN;
    END IF;
  END IF;

  -- ════════════════════════════════════════════════════════════════════
  -- 7. MAX OUTPUT TOKENS + CREDIT-BUDGET CAP
  -- ════════════════════════════════════════════════════════════════════
  v_effective_max_output := v_allocation.max_output_tokens_per_request;
  IF v_model.max_tokens IS NOT NULL THEN
    IF v_effective_max_output IS NULL THEN
      v_effective_max_output := v_model.max_tokens;
    ELSE
      v_effective_max_output := LEAST(v_effective_max_output, v_model.max_tokens);
    END IF;
  END IF;

  IF v_model.output_price_per_token IS NOT NULL
     AND v_model.output_price_per_token > 0 THEN
    v_affordable_output := FLOOR(
      (v_remaining * 0.0001 / COALESCE(v_allocation.markup_multiplier, 1.0))
      / v_model.output_price_per_token
    )::INTEGER;

    IF v_affordable_output < 1 THEN
      RETURN QUERY SELECT FALSE, v_remaining, v_tier::TEXT, NULL::INTEGER,
        'CREDITS_EXHAUSTED'::TEXT, 'Insufficient credits for any output'::TEXT;
      RETURN;
    END IF;

    v_effective_max_output := LEAST(
      COALESCE(v_effective_max_output, v_affordable_output),
      v_affordable_output
    );
  END IF;

  IF p_estimated_input_tokens IS NOT NULL AND v_model.input_price_per_token IS NOT NULL THEN
    v_estimated_cost := (
      p_estimated_input_tokens::NUMERIC * v_model.input_price_per_token +
      COALESCE(v_effective_max_output, 8192)::NUMERIC * v_model.output_price_per_token
    ) / 0.0001 * v_allocation.markup_multiplier;

    IF v_estimated_cost > v_remaining THEN
      RETURN QUERY SELECT FALSE, v_remaining, v_tier::TEXT, v_effective_max_output,
        'CREDITS_EXHAUSTED'::TEXT,
        'Insufficient credits for estimated request cost'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT TRUE, v_remaining, v_tier::TEXT, v_effective_max_output,
    NULL::TEXT, NULL::TEXT;
  RETURN;
END;
$$;
