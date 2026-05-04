-- Migration: Add user_workspace_configs table for workspace-scoped user preferences

CREATE TABLE IF NOT EXISTS public.user_workspace_configs (
    id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    ws_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, ws_id, id)
);

CREATE INDEX IF NOT EXISTS idx_user_workspace_configs_ws_id
    ON public.user_workspace_configs(ws_id);

ALTER TABLE public.user_workspace_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workspace configs" ON public.user_workspace_configs
    FOR ALL USING (
        user_id = auth.uid()
        AND ws_id IN (
            SELECT wm.ws_id
            FROM public.workspace_members wm
            WHERE wm.user_id = auth.uid()
        )
    )
    WITH CHECK (
        user_id = auth.uid()
        AND ws_id IN (
            SELECT wm.ws_id
            FROM public.workspace_members wm
            WHERE wm.user_id = auth.uid()
        )
    );

CREATE TRIGGER update_user_workspace_configs_updated_at
    BEFORE UPDATE ON public.user_workspace_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.user_workspace_configs IS 'Workspace-scoped user configuration store';
COMMENT ON COLUMN public.user_workspace_configs.id IS 'Configuration key, e.g., ROOT_DEFAULT_NAVIGATION';
COMMENT ON COLUMN public.user_workspace_configs.value IS 'Configuration value as text (parse as needed)';
