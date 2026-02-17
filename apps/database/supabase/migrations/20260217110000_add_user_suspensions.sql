-- User suspension system for blocking authenticated bad actors
CREATE TABLE public.user_suspensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    suspended_by UUID REFERENCES auth.users(id),
    suspended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,  -- NULL = permanent
    lifted_at TIMESTAMPTZ,
    lifted_by UUID REFERENCES auth.users(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup for active suspensions
CREATE INDEX idx_user_suspensions_active
    ON public.user_suspensions(user_id)
    WHERE lifted_at IS NULL;

-- RPC for fast suspension check
CREATE OR REPLACE FUNCTION public.is_user_suspended(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_suspensions
    WHERE user_id = p_user_id
      AND lifted_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
  );
$$;

-- RLS: Only root workspace members with manage_workspace_roles permission
ALTER TABLE public.user_suspensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Root admins can view suspensions"
    ON public.user_suspensions FOR SELECT
    USING (
      public.has_workspace_permission(
        '00000000-0000-0000-0000-000000000000'::uuid,
        auth.uid(),
        'manage_workspace_roles'
      )
    );

CREATE POLICY "Root admins can insert suspensions"
    ON public.user_suspensions FOR INSERT
    WITH CHECK (
      public.has_workspace_permission(
        '00000000-0000-0000-0000-000000000000'::uuid,
        auth.uid(),
        'manage_workspace_roles'
      )
    );

CREATE POLICY "Root admins can update suspensions"
    ON public.user_suspensions FOR UPDATE
    USING (
      public.has_workspace_permission(
        '00000000-0000-0000-0000-000000000000'::uuid,
        auth.uid(),
        'manage_workspace_roles'
      )
    );

-- Allow service role full access (for server-side suspension checks)
CREATE POLICY "Service role can manage suspensions"
    ON public.user_suspensions
    AS PERMISSIVE FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
