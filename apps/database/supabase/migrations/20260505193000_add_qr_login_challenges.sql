CREATE TABLE IF NOT EXISTS public.qr_login_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '2 minutes',
  approved_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  approver_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approver_email TEXT,
  approver_device_id TEXT,
  approver_platform TEXT,
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qr_login_challenges_status_check CHECK (
    status IN ('pending', 'approved', 'consumed', 'expired', 'rejected')
  ),
  CONSTRAINT qr_login_challenges_approval_consistency_check CHECK (
    (
      status = 'approved'
      AND approved_at IS NOT NULL
      AND approver_user_id IS NOT NULL
    )
    OR status <> 'approved'
  ),
  CONSTRAINT qr_login_challenges_consumed_consistency_check CHECK (
    (status = 'consumed' AND consumed_at IS NOT NULL)
    OR status <> 'consumed'
  )
);

CREATE INDEX IF NOT EXISTS idx_qr_login_challenges_status_expires_at
  ON public.qr_login_challenges(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_qr_login_challenges_approver_user_id
  ON public.qr_login_challenges(approver_user_id)
  WHERE approver_user_id IS NOT NULL;

ALTER TABLE public.qr_login_challenges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.qr_login_challenges FROM anon;
REVOKE ALL ON TABLE public.qr_login_challenges FROM authenticated;
GRANT ALL ON TABLE public.qr_login_challenges TO service_role;

CREATE OR REPLACE FUNCTION public.touch_qr_login_challenges_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qr_login_challenges_touch_updated_at
  ON public.qr_login_challenges;

CREATE TRIGGER qr_login_challenges_touch_updated_at
BEFORE UPDATE ON public.qr_login_challenges
FOR EACH ROW
EXECUTE FUNCTION public.touch_qr_login_challenges_updated_at();

CREATE OR REPLACE FUNCTION public.cleanup_qr_login_challenges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.qr_login_challenges
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at <= now();

  DELETE FROM public.qr_login_challenges
  WHERE (
      status IN ('consumed', 'expired', 'rejected')
      AND updated_at < now() - INTERVAL '1 day'
    )
    OR expires_at < now() - INTERVAL '1 day';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_qr_login_challenges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_qr_login_challenges() TO service_role;

CREATE OR REPLACE FUNCTION public.trigger_cleanup_qr_login_challenges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.cleanup_qr_login_challenges();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qr_login_challenges_cleanup_after_insert
  ON public.qr_login_challenges;

CREATE TRIGGER qr_login_challenges_cleanup_after_insert
AFTER INSERT ON public.qr_login_challenges
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_cleanup_qr_login_challenges();
