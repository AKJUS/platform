CREATE TABLE IF NOT EXISTS public.ai_credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ws_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  balance_id UUID NOT NULL REFERENCES public.workspace_ai_credit_balances(id) ON DELETE CASCADE,
  amount NUMERIC(14,4) NOT NULL CHECK (amount > 0),
  model_id TEXT,
  feature TEXT,
  status TEXT NOT NULL CHECK (status IN ('reserved', 'committed', 'released', 'expired')),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  committed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_credit_reservations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ai_credit_reservations_balance_status
  ON public.ai_credit_reservations (balance_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_ai_credit_reservations_ws_created
  ON public.ai_credit_reservations (ws_id, created_at DESC);

CREATE POLICY "ai_credit_reservations_select_members"
  ON public.ai_credit_reservations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.ws_id = ai_credit_reservations.ws_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public._release_expired_ai_credit_reservations(
  p_balance_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_released_amount NUMERIC := 0;
BEGIN
  WITH expired AS (
    UPDATE public.ai_credit_reservations
       SET status = 'expired',
           released_at = now(),
           updated_at = now(),
           metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object('expired_at', now())
     WHERE balance_id = p_balance_id
       AND status = 'reserved'
       AND expires_at <= now()
    RETURNING amount
  )
  SELECT COALESCE(SUM(amount), 0)
    INTO v_released_amount
    FROM expired;

  IF v_released_amount > 0 THEN
    UPDATE public.workspace_ai_credit_balances
       SET total_used = GREATEST(total_used - v_released_amount, 0),
           updated_at = now()
     WHERE id = p_balance_id;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.reserve_fixed_ai_credits(
  UUID,
  UUID,
  NUMERIC,
  TEXT,
  TEXT,
  JSONB,
  INTEGER
);

CREATE OR REPLACE FUNCTION public.reserve_fixed_ai_credits(
  p_ws_id UUID,
  p_user_id UUID,
  p_amount NUMERIC,
  p_model_id TEXT DEFAULT 'markitdown/conversion',
  p_feature TEXT DEFAULT 'chat',
  p_metadata JSONB DEFAULT '{}'::JSONB,
  p_expires_in_seconds INTEGER DEFAULT 1800
)
RETURNS TABLE (
  success BOOLEAN,
  reservation_id UUID,
  remaining_credits NUMERIC,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_balance RECORD;
  v_new_total_used NUMERIC;
  v_total_allocated NUMERIC;
  v_bonus_credits NUMERIC;
  v_current_total_used NUMERIC;
  v_current_total_allocated NUMERIC;
  v_current_bonus_credits NUMERIC;
  v_reservation_id UUID;
BEGIN
  SELECT * INTO v_balance
    FROM public.get_or_create_credit_balance(p_ws_id, p_user_id);

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0::NUMERIC, 'NO_BALANCE'::TEXT;
    RETURN;
  END IF;

  IF COALESCE(p_amount, 0) <= 0 THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 0::NUMERIC, 'INVALID_AMOUNT'::TEXT;
    RETURN;
  END IF;

  PERFORM public._release_expired_ai_credit_reservations(v_balance.id);

  UPDATE public.workspace_ai_credit_balances
     SET total_used = total_used + p_amount,
         updated_at = now()
   WHERE id = v_balance.id
     AND (total_allocated + bonus_credits - total_used) >= p_amount
  RETURNING total_used, total_allocated, bonus_credits
    INTO v_new_total_used, v_total_allocated, v_bonus_credits;

  IF NOT FOUND THEN
    SELECT total_used, total_allocated, bonus_credits
      INTO v_current_total_used, v_current_total_allocated, v_current_bonus_credits
      FROM public.workspace_ai_credit_balances
     WHERE id = v_balance.id;

    RETURN QUERY
    SELECT
      FALSE,
      NULL::UUID,
      (
        COALESCE(v_current_total_allocated, COALESCE(v_balance.total_allocated, 0)) +
        COALESCE(v_current_bonus_credits, COALESCE(v_balance.bonus_credits, 0)) -
        COALESCE(v_current_total_used, COALESCE(v_balance.total_used, 0))
      )::NUMERIC,
      'INSUFFICIENT_CREDITS'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.ai_credit_reservations
    (ws_id, user_id, balance_id, amount, model_id, feature, status, metadata, expires_at)
  VALUES
    (
      p_ws_id,
      p_user_id,
      v_balance.id,
      p_amount,
      p_model_id,
      p_feature,
      'reserved',
      COALESCE(p_metadata, '{}'::JSONB),
      now() + make_interval(secs => GREATEST(COALESCE(p_expires_in_seconds, 1800), 60))
    )
  RETURNING id INTO v_reservation_id;

  RETURN QUERY
  SELECT
    TRUE,
    v_reservation_id,
    (v_total_allocated + v_bonus_credits - v_new_total_used)::NUMERIC,
    NULL::TEXT;
END;
$$;

DROP FUNCTION IF EXISTS public.commit_fixed_ai_credit_reservation(
  UUID,
  JSONB
);

CREATE OR REPLACE FUNCTION public.commit_fixed_ai_credit_reservation(
  p_reservation_id UUID,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE (
  success BOOLEAN,
  credits_deducted NUMERIC,
  remaining_credits NUMERIC,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_reservation RECORD;
  v_balance_total_used NUMERIC;
  v_balance_total_allocated NUMERIC;
  v_balance_bonus_credits NUMERIC;
BEGIN
  SELECT
    r.*,
    b.total_used AS balance_total_used,
    b.total_allocated AS balance_total_allocated,
    b.bonus_credits AS balance_bonus_credits
    INTO v_reservation
    FROM public.ai_credit_reservations r
    JOIN public.workspace_ai_credit_balances b
      ON b.id = r.balance_id
   WHERE r.id = p_reservation_id
   FOR UPDATE OF r, b;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, 0::NUMERIC, 'RESERVATION_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  IF v_reservation.status = 'committed' THEN
    RETURN QUERY
    SELECT
      TRUE,
      v_reservation.amount,
      (
        v_reservation.balance_total_allocated +
        v_reservation.balance_bonus_credits -
        v_reservation.balance_total_used
      )::NUMERIC,
      NULL::TEXT;
    RETURN;
  END IF;

  IF v_reservation.status IN ('released', 'expired') THEN
    RETURN QUERY
    SELECT
      FALSE,
      0::NUMERIC,
      (
        v_reservation.balance_total_allocated +
        v_reservation.balance_bonus_credits -
        v_reservation.balance_total_used
      )::NUMERIC,
      'RESERVATION_NOT_ACTIVE'::TEXT;
    RETURN;
  END IF;

  IF v_reservation.expires_at <= now() THEN
    UPDATE public.workspace_ai_credit_balances
       SET total_used = GREATEST(total_used - v_reservation.amount, 0),
           updated_at = now()
     WHERE id = v_reservation.balance_id
  RETURNING total_used, total_allocated, bonus_credits
    INTO v_balance_total_used, v_balance_total_allocated, v_balance_bonus_credits;

    UPDATE public.ai_credit_reservations
       SET status = 'expired',
           released_at = now(),
           updated_at = now(),
           metadata = COALESCE(metadata, '{}'::JSONB) || COALESCE(p_metadata, '{}'::JSONB) || jsonb_build_object('expired_during_commit', true)
     WHERE id = p_reservation_id;

    RETURN QUERY
    SELECT
      FALSE,
      0::NUMERIC,
      (
        v_balance_total_allocated +
        v_balance_bonus_credits -
        v_balance_total_used
      )::NUMERIC,
      'RESERVATION_EXPIRED'::TEXT;
    RETURN;
  END IF;

  UPDATE public.ai_credit_reservations
     SET status = 'committed',
         committed_at = now(),
         updated_at = now(),
         metadata = COALESCE(metadata, '{}'::JSONB) || COALESCE(p_metadata, '{}'::JSONB)
   WHERE id = p_reservation_id;

  INSERT INTO public.ai_credit_transactions
    (ws_id, user_id, balance_id, transaction_type, amount, cost_usd, model_id, feature, metadata)
  VALUES
    (
      v_reservation.ws_id,
      v_reservation.user_id,
      v_reservation.balance_id,
      'deduction',
      -v_reservation.amount,
      v_reservation.amount * 0.0001,
      v_reservation.model_id,
      v_reservation.feature,
      COALESCE(v_reservation.metadata, '{}'::JSONB) || jsonb_build_object('reservation_id', v_reservation.id)
    );

  RETURN QUERY
  SELECT
    TRUE,
    v_reservation.amount,
    (
      v_reservation.balance_total_allocated +
      v_reservation.balance_bonus_credits -
      v_reservation.balance_total_used
    )::NUMERIC,
    NULL::TEXT;
END;
$$;

DROP FUNCTION IF EXISTS public.release_fixed_ai_credit_reservation(
  UUID,
  JSONB
);

CREATE OR REPLACE FUNCTION public.release_fixed_ai_credit_reservation(
  p_reservation_id UUID,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE (
  success BOOLEAN,
  remaining_credits NUMERIC,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_reservation RECORD;
  v_balance_total_used NUMERIC;
  v_balance_total_allocated NUMERIC;
  v_balance_bonus_credits NUMERIC;
BEGIN
  SELECT
    r.*,
    b.total_used AS balance_total_used,
    b.total_allocated AS balance_total_allocated,
    b.bonus_credits AS balance_bonus_credits
    INTO v_reservation
    FROM public.ai_credit_reservations r
    JOIN public.workspace_ai_credit_balances b
      ON b.id = r.balance_id
   WHERE r.id = p_reservation_id
   FOR UPDATE OF r, b;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0::NUMERIC, 'RESERVATION_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  IF v_reservation.status = 'committed' THEN
    RETURN QUERY
    SELECT
      FALSE,
      (
        v_reservation.balance_total_allocated +
        v_reservation.balance_bonus_credits -
        v_reservation.balance_total_used
      )::NUMERIC,
      'RESERVATION_ALREADY_COMMITTED'::TEXT;
    RETURN;
  END IF;

  IF v_reservation.status IN ('released', 'expired') THEN
    RETURN QUERY
    SELECT
      TRUE,
      (
        v_reservation.balance_total_allocated +
        v_reservation.balance_bonus_credits -
        v_reservation.balance_total_used
      )::NUMERIC,
      NULL::TEXT;
    RETURN;
  END IF;

  UPDATE public.workspace_ai_credit_balances
     SET total_used = GREATEST(total_used - v_reservation.amount, 0),
         updated_at = now()
   WHERE id = v_reservation.balance_id
  RETURNING total_used, total_allocated, bonus_credits
    INTO v_balance_total_used, v_balance_total_allocated, v_balance_bonus_credits;

  UPDATE public.ai_credit_reservations
     SET status = 'released',
         released_at = now(),
         updated_at = now(),
         metadata = COALESCE(metadata, '{}'::JSONB) || COALESCE(p_metadata, '{}'::JSONB)
   WHERE id = p_reservation_id;

  RETURN QUERY
  SELECT
    TRUE,
    (
      v_balance_total_allocated +
      v_balance_bonus_credits -
      v_balance_total_used
    )::NUMERIC,
    NULL::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_fixed_ai_credits(
  UUID,
  UUID,
  NUMERIC,
  TEXT,
  TEXT,
  JSONB,
  INTEGER
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_fixed_ai_credits(
  UUID,
  UUID,
  NUMERIC,
  TEXT,
  TEXT,
  JSONB,
  INTEGER
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.commit_fixed_ai_credit_reservation(
  UUID,
  JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.commit_fixed_ai_credit_reservation(
  UUID,
  JSONB
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_fixed_ai_credit_reservation(
  UUID,
  JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.release_fixed_ai_credit_reservation(
  UUID,
  JSONB
) TO service_role;

REVOKE EXECUTE ON FUNCTION public._release_expired_ai_credit_reservations(
  UUID
) FROM PUBLIC, anon, authenticated;
