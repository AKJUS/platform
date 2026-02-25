--------------------------------------------------------------------------------
-- Add Google Search pricing support (analogous to image_gen_price / image_count)
-- Pricing: ~$40/1000 searches = $0.04 per search
--------------------------------------------------------------------------------

-- 1. Add search_price column to gateway models
ALTER TABLE public.ai_gateway_models
  ADD COLUMN IF NOT EXISTS search_price NUMERIC(10,4);

-- 2. Add search_count column to credit transactions ledger
ALTER TABLE public.ai_credit_transactions
  ADD COLUMN IF NOT EXISTS search_count INTEGER;

--------------------------------------------------------------------------------
-- 3. Update compute_ai_cost_from_gateway to support search pricing
--    Drop old 5-arg signature to avoid PostgREST PGRST203 ambiguity
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.compute_ai_cost_from_gateway(TEXT, INTEGER, INTEGER, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.compute_ai_cost_from_gateway(
  p_model_id TEXT,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER,
  p_reasoning_tokens INTEGER DEFAULT 0,
  p_image_count INTEGER DEFAULT 0,
  p_search_count INTEGER DEFAULT 0
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
  v_search_cost NUMERIC := 0;
  v_tier JSONB;
  v_tier_cost NUMERIC;
  v_tier_min INTEGER;
  v_tier_max INTEGER;
  v_bare_model TEXT;
BEGIN
  -- Try to find model in gateway table (exact match)
  SELECT input_price_per_token, output_price_per_token,
         input_tiers, output_tiers, image_gen_price, search_price
    INTO v_model
    FROM public.ai_gateway_models
   WHERE id = p_model_id;

  -- If not found, try with google/ prefix (bare model name compat)
  IF NOT FOUND THEN
    SELECT input_price_per_token, output_price_per_token,
           input_tiers, output_tiers, image_gen_price, search_price
      INTO v_model
      FROM public.ai_gateway_models
     WHERE id = 'google/' || p_model_id;
  END IF;

  -- Fall back to existing compute_ai_cost_usd if still not found
  IF NOT FOUND THEN
    -- Strip provider prefix: 'google/gemini-2.5-flash' → 'gemini-2.5-flash'
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

  -- Search cost
  v_search_cost := COALESCE(v_model.search_price, 0) * COALESCE(p_search_count, 0);

  RETURN v_input_cost + v_output_cost + v_reasoning_cost + v_image_cost + v_search_cost;
END;
$$;

--------------------------------------------------------------------------------
-- 4. Update deduct_ai_credits to accept p_search_count
--    Drop old 11-arg signature to avoid PostgREST PGRST203 ambiguity
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.deduct_ai_credits(UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, UUID, UUID, JSONB, UUID, INTEGER);

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
  p_image_count INTEGER DEFAULT 0,
  p_search_count INTEGER DEFAULT 0
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
  SELECT * INTO v_balance
    FROM public.get_or_create_credit_balance(p_ws_id, p_user_id);

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, 0::NUMERIC, 'NO_BALANCE'::TEXT;
    RETURN;
  END IF;

  v_tier := public._resolve_workspace_tier(p_ws_id);

  SELECT COALESCE(markup_multiplier, 1.0) INTO v_markup
    FROM public.ai_credit_plan_allocations
   WHERE tier = v_tier AND is_active = TRUE;

  IF v_markup IS NULL THEN
    v_markup := 1.0;
  END IF;

  v_cost_usd := public.compute_ai_cost_from_gateway(
    p_model_id, p_input_tokens, p_output_tokens, p_reasoning_tokens, p_image_count, p_search_count
  );

  v_credits := (v_cost_usd / 0.0001) * v_markup;

  IF v_credits < 1 AND (
    COALESCE(p_input_tokens, 0) + COALESCE(p_output_tokens, 0)
    + COALESCE(p_reasoning_tokens, 0) + COALESCE(p_image_count, 0)
    + COALESCE(p_search_count, 0)
  ) > 0 THEN
    v_credits := 1;
  END IF;

  UPDATE public.workspace_ai_credit_balances
     SET total_used = total_used + v_credits,
         updated_at = now()
   WHERE id = v_balance.id
  RETURNING total_used INTO v_new_total_used;

  v_remaining := v_balance.total_allocated + v_balance.bonus_credits - v_new_total_used;

  INSERT INTO public.ai_credit_transactions
    (ws_id, user_id, balance_id, execution_id, chat_message_id,
     transaction_type, amount, cost_usd, model_id, feature,
     input_tokens, output_tokens, reasoning_tokens, image_count, search_count, metadata)
  VALUES
    (CASE WHEN v_balance.ws_id IS NOT NULL THEN p_ws_id ELSE NULL END,
     p_user_id, v_balance.id, p_execution_id, p_chat_message_id,
     'deduction', -v_credits, v_cost_usd, p_model_id, p_feature,
     p_input_tokens, p_output_tokens, p_reasoning_tokens, p_image_count, p_search_count, p_metadata);

  RETURN QUERY SELECT TRUE, v_credits, v_remaining, NULL::TEXT;
  RETURN;
END;
$$;

--------------------------------------------------------------------------------
-- 5. Update admin_list_ai_credit_transactions to expose search_count
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_list_ai_credit_transactions;

CREATE OR REPLACE FUNCTION public.admin_list_ai_credit_transactions(
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 50,
  p_ws_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_scope TEXT DEFAULT NULL,
  p_transaction_type TEXT DEFAULT NULL,
  p_feature TEXT DEFAULT NULL,
  p_model_id TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  ws_id UUID,
  user_id UUID,
  balance_id UUID,
  transaction_type TEXT,
  amount NUMERIC,
  cost_usd NUMERIC,
  model_id TEXT,
  feature TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  reasoning_tokens INTEGER,
  image_count INTEGER,
  search_count INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  ws_name TEXT,
  ws_member_count BIGINT,
  user_display_name TEXT,
  user_avatar_url TEXT,
  workspace_tier TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_offset INTEGER;
BEGIN
  v_offset := (GREATEST(p_page, 1) - 1) * p_limit;

  RETURN QUERY
  WITH filtered AS (
    SELECT t.*
      FROM public.ai_credit_transactions t
     WHERE (p_ws_id IS NULL OR t.ws_id = p_ws_id)
       AND (p_user_id IS NULL OR t.user_id = p_user_id)
       AND (p_scope IS NULL
            OR (p_scope = 'user' AND t.user_id IS NOT NULL)
            OR (p_scope = 'workspace' AND t.ws_id IS NOT NULL AND t.user_id IS NULL))
       AND (p_transaction_type IS NULL OR t.transaction_type = p_transaction_type)
       AND (p_feature IS NULL OR t.feature = p_feature)
       AND (p_model_id IS NULL OR t.model_id = p_model_id)
       AND (p_start_date IS NULL OR t.created_at >= p_start_date)
       AND (p_end_date IS NULL OR t.created_at <= p_end_date)
  )
  SELECT
    f.id,
    f.ws_id,
    f.user_id,
    f.balance_id,
    f.transaction_type,
    f.amount,
    f.cost_usd,
    f.model_id,
    f.feature,
    f.input_tokens,
    f.output_tokens,
    f.reasoning_tokens,
    f.image_count,
    f.search_count,
    f.metadata,
    f.created_at,
    w.name::TEXT AS ws_name,
    (SELECT COUNT(*) FROM public.workspace_members wm WHERE wm.ws_id = f.ws_id)::BIGINT AS ws_member_count,
    u.display_name::TEXT AS user_display_name,
    u.avatar_url::TEXT AS user_avatar_url,
    public._resolve_workspace_tier(f.ws_id)::TEXT AS workspace_tier,
    COUNT(*) OVER()::BIGINT AS total_count
  FROM filtered f
  LEFT JOIN public.workspaces w ON w.id = f.ws_id
  LEFT JOIN public.users u ON u.id = f.user_id
  ORDER BY f.created_at DESC
  LIMIT p_limit
  OFFSET v_offset;
END;
$$;

--------------------------------------------------------------------------------
-- 6. Set default search_price for all Google models that support grounding
--    $0.04 per search (~$40/1000 searches)
--------------------------------------------------------------------------------
UPDATE public.ai_gateway_models
   SET search_price = 0.04
 WHERE id LIKE 'google/%'
    AND search_price IS NULL;
