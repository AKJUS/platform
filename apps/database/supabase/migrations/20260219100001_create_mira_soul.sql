-- Migration: Create mira_soul table for Mira personality/identity configuration
-- Inspired by OpenClaw's SOUL.md — stores user-editable personality settings
-- that define how Mira communicates and behaves for each user.

CREATE TABLE IF NOT EXISTS public.mira_soul (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Mira',
  tone TEXT DEFAULT 'balanced',            -- overall communication tone
  personality TEXT,                         -- free-form personality description
  boundaries TEXT,                         -- topics/behaviors to avoid
  vibe TEXT,                               -- general vibe/energy level
  push_tone TEXT DEFAULT 'concise',        -- tone for push notifications
  chat_tone TEXT DEFAULT 'thorough',       -- tone for chat conversations
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_mira_soul_user_id ON public.mira_soul(user_id);

-- Enable RLS
ALTER TABLE public.mira_soul ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own soul config
CREATE POLICY "mira_soul_select" ON public.mira_soul
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mira_soul_insert" ON public.mira_soul
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "mira_soul_update" ON public.mira_soul
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "mira_soul_delete" ON public.mira_soul
  FOR DELETE USING (user_id = auth.uid());

-- Auto-update updated_at
CREATE TRIGGER update_mira_soul_updated_at
  BEFORE UPDATE ON public.mira_soul
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.mira_soul IS 'User-editable personality configuration for Mira AI assistant (OpenClaw SOUL.md equivalent)';
