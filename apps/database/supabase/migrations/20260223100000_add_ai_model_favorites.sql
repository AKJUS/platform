-- AI model favorites: per-user, per-workspace favorite models for the Mira chat picker.
-- Users can star/unstar models; favorites persist across sessions and sync across devices.

CREATE TABLE IF NOT EXISTS public.ai_model_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ws_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  model_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ws_id, user_id, model_id)
);

COMMENT ON TABLE public.ai_model_favorites IS 'User favorites for AI models in Mira chat, scoped by workspace';
COMMENT ON COLUMN public.ai_model_favorites.model_id IS 'Gateway model ID (e.g. google/gemini-2.5-flash)';

CREATE INDEX IF NOT EXISTS idx_ai_model_favorites_ws_user
  ON public.ai_model_favorites (ws_id, user_id);

ALTER TABLE public.ai_model_favorites ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites only in workspaces they are members of
CREATE POLICY "ai_model_favorites_select_own"
  ON public.ai_model_favorites FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.ws_id = ai_model_favorites.ws_id AND wm.user_id = auth.uid()
    )
  );

-- Users can insert their own favorites in workspaces they belong to
CREATE POLICY "ai_model_favorites_insert_own"
  ON public.ai_model_favorites FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.ws_id = ai_model_favorites.ws_id AND wm.user_id = auth.uid()
    )
  );

-- Users can delete their own favorites
CREATE POLICY "ai_model_favorites_delete_own"
  ON public.ai_model_favorites FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
