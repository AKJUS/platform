--------------------------------------------------------------------------------
-- 1. Add image_gen_price column to gateway models
--------------------------------------------------------------------------------
ALTER TABLE public.ai_gateway_models
  ADD COLUMN IF NOT EXISTS image_gen_price NUMERIC(10,4);

--------------------------------------------------------------------------------
-- 2. Update compute_ai_cost_from_gateway to support image pricing
--    Drop the old 4-arg signature first to avoid PostgreSQL overload ambiguity
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.compute_ai_cost_from_gateway(TEXT, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.compute_ai_cost_from_gateway(
  p_model_id TEXT,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER,
  p_reasoning_tokens INTEGER DEFAULT 0,
  p_image_count INTEGER DEFAULT 0
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_model RECORD;
  v_input_cost NUMERIC := 0;
  v_output_cost NUMERIC := 0;
  v_reasoning_cost NUMERIC := 0;
  v_image_cost NUMERIC := 0;
  v_tier JSONB;
  v_tier_cost NUMERIC;
  v_tier_min INTEGER;
  v_tier_max INTEGER;
  v_bare_model TEXT;
BEGIN
  -- Try to find model in gateway table (exact match)
  SELECT input_price_per_token, output_price_per_token,
         input_tiers, output_tiers, image_gen_price
    INTO v_model
    FROM public.ai_gateway_models
   WHERE id = p_model_id;

  -- If not found, try with google/ prefix (bare model name compat)
  IF NOT FOUND THEN
    SELECT input_price_per_token, output_price_per_token,
           input_tiers, output_tiers, image_gen_price
      INTO v_model
      FROM public.ai_gateway_models
     WHERE id = 'google/' || p_model_id;
  END IF;

  -- Fall back to existing compute_ai_cost_usd if still not found
  IF NOT FOUND THEN
    -- Strip provider prefix: 'google/gemini-2.5-flash-lite' → 'gemini-2.5-flash-lite'
    v_bare_model := CASE WHEN p_model_id LIKE '%/%'
      THEN substring(p_model_id from position('/' in p_model_id) + 1)
      ELSE p_model_id END;

    RETURN public.compute_ai_cost_usd(
      v_bare_model,
      COALESCE(p_input_tokens, 0)::NUMERIC,
      COALESCE(p_output_tokens, 0)::NUMERIC,
      COALESCE(p_reasoning_tokens, 0)::NUMERIC,
      NULL
    );
  END IF;

  -- Calculate input cost (tiered if available)
  IF v_model.input_tiers IS NOT NULL AND jsonb_array_length(v_model.input_tiers) > 0 THEN
    FOR v_tier IN SELECT * FROM jsonb_array_elements(v_model.input_tiers)
    LOOP
      v_tier_cost := (v_tier ->> 'cost')::NUMERIC;
      v_tier_min := COALESCE((v_tier ->> 'min')::INTEGER, 0);
      v_tier_max := (v_tier ->> 'max')::INTEGER; -- NULL means unlimited
      IF COALESCE(p_input_tokens, 0) >= v_tier_min AND
         (v_tier_max IS NULL OR COALESCE(p_input_tokens, 0) <= v_tier_max) THEN
        v_input_cost := COALESCE(p_input_tokens, 0)::NUMERIC * v_tier_cost;
        EXIT;
      END IF;
    END LOOP;
  ELSE
    v_input_cost := COALESCE(p_input_tokens, 0)::NUMERIC * v_model.input_price_per_token;
  END IF;

  -- Calculate output cost (tiered if available)
  IF v_model.output_tiers IS NOT NULL AND jsonb_array_length(v_model.output_tiers) > 0 THEN
    FOR v_tier IN SELECT * FROM jsonb_array_elements(v_model.output_tiers)
    LOOP
      v_tier_cost := (v_tier ->> 'cost')::NUMERIC;
      v_tier_min := COALESCE((v_tier ->> 'min')::INTEGER, 0);
      v_tier_max := (v_tier ->> 'max')::INTEGER;
      IF COALESCE(p_output_tokens, 0) >= v_tier_min AND
         (v_tier_max IS NULL OR COALESCE(p_output_tokens, 0) <= v_tier_max) THEN
        v_output_cost := COALESCE(p_output_tokens, 0)::NUMERIC * v_tier_cost;
        EXIT;
      END IF;
    END LOOP;
  ELSE
    v_output_cost := COALESCE(p_output_tokens, 0)::NUMERIC * v_model.output_price_per_token;
  END IF;

  -- Reasoning tokens use output pricing
  v_reasoning_cost := COALESCE(p_reasoning_tokens, 0)::NUMERIC * v_model.output_price_per_token;

  -- Image generation cost
  v_image_cost := COALESCE(v_model.image_gen_price, 0) * COALESCE(p_image_count, 0);

  RETURN v_input_cost + v_output_cost + v_reasoning_cost + v_image_cost;
END;
$$;

--------------------------------------------------------------------------------
-- 3. Update deduct_ai_credits to accept p_image_count
--    Drop the old 10-arg signature first to avoid PostgREST PGRST203 ambiguity
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.deduct_ai_credits(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, UUID, UUID, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.deduct_ai_credits(
  p_ws_id UUID,
  p_model_id TEXT,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER,
  p_reasoning_tokens INTEGER DEFAULT 0,
  p_feature TEXT DEFAULT NULL,
  p_execution_id UUID DEFAULT NULL,
  p_chat_message_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_user_id UUID DEFAULT NULL,
  p_image_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  success BOOLEAN,
  credits_deducted NUMERIC,
  remaining_credits NUMERIC,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance RECORD;
  v_cost_usd NUMERIC;
  v_credits NUMERIC;
  v_tier workspace_product_tier;
  v_markup NUMERIC;
  v_new_total_used NUMERIC;
  v_remaining NUMERIC;
BEGIN
  -- Get current balance (routes to correct pool based on tier)
  SELECT * INTO v_balance
    FROM public.get_or_create_credit_balance(p_ws_id, p_user_id);

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, 0::NUMERIC, 'NO_BALANCE'::TEXT;
    RETURN;
  END IF;

  -- Resolve tier for markup
  v_tier := public._resolve_workspace_tier(p_ws_id);

  SELECT COALESCE(markup_multiplier, 1.0) INTO v_markup
    FROM public.ai_credit_plan_allocations
   WHERE tier = v_tier AND is_active = TRUE;

  IF v_markup IS NULL THEN
    v_markup := 1.0;
  END IF;

  -- Compute cost using gateway pricing (now with image count)
  v_cost_usd := public.compute_ai_cost_from_gateway(
    p_model_id, p_input_tokens, p_output_tokens, p_reasoning_tokens, p_image_count
  );

  -- Convert to credits: cost_usd / 0.0001 * markup
  v_credits := (v_cost_usd / 0.0001) * v_markup;

  -- Enforce minimum 1 credit deduction for any non-zero usage
  IF v_credits < 1 AND (
    COALESCE(p_input_tokens, 0) + COALESCE(p_output_tokens, 0)
    + COALESCE(p_reasoning_tokens, 0) + COALESCE(p_image_count, 0)
  ) > 0 THEN
    v_credits := 1;
  END IF;

  -- Atomically increment total_used
  UPDATE public.workspace_ai_credit_balances
     SET total_used = total_used + v_credits,
         updated_at = now()
   WHERE id = v_balance.id
  RETURNING total_used INTO v_new_total_used;

  v_remaining := v_balance.total_allocated + v_balance.bonus_credits - v_new_total_used;

  -- Insert ledger entry with first-class user_id
  INSERT INTO public.ai_credit_transactions
    (ws_id, user_id, balance_id, execution_id, chat_message_id,
     transaction_type, amount, cost_usd, model_id, feature,
     input_tokens, output_tokens, reasoning_tokens, metadata)
  VALUES
    (CASE WHEN v_balance.ws_id IS NOT NULL THEN p_ws_id ELSE NULL END,
     p_user_id, v_balance.id, p_execution_id, p_chat_message_id,
     'deduction', -v_credits, v_cost_usd, p_model_id, p_feature,
     p_input_tokens, p_output_tokens, p_reasoning_tokens, p_metadata);

  RETURN QUERY SELECT TRUE, v_credits, v_remaining, NULL::TEXT;
  RETURN;
END;
$$;

--------------------------------------------------------------------------------
-- 4. Add image_generation feature access rows
--------------------------------------------------------------------------------
INSERT INTO public.ai_credit_feature_access (tier, feature, enabled, max_requests_per_day)
VALUES
  ('FREE', 'image_generation', TRUE, 5),
  ('PLUS', 'image_generation', TRUE, 50),
  ('PRO', 'image_generation', TRUE, 200),
  ('ENTERPRISE', 'image_generation', TRUE, NULL)
ON CONFLICT (tier, feature) DO NOTHING;
