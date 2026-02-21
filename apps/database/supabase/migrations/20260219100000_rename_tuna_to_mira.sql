-- Migration: Destructive rename of all tuna_* infrastructure to mira_*
-- This is part of the Mira Personal Assistant pivot.
-- Renames: 4 enums, 8 tables, 16 indexes, 22 RLS policies, 3 triggers, 4 functions
-- Also updates seed data text references from "Tuna" to "Mira"

-- ============================================================================
-- 1. DROP TRIGGERS (must drop before renaming tables)
-- ============================================================================

DROP TRIGGER IF EXISTS update_tuna_pets_updated_at ON public.tuna_pets;
DROP TRIGGER IF EXISTS update_tuna_memories_updated_at ON public.tuna_memories;
DROP TRIGGER IF EXISTS update_tuna_daily_stats_updated_at ON public.tuna_daily_stats;

-- ============================================================================
-- 2. DROP ALL RLS POLICIES (ALTER POLICY doesn't support rename)
-- ============================================================================

-- tuna_pets policies
DROP POLICY IF EXISTS "tuna_pets_select" ON public.tuna_pets;
DROP POLICY IF EXISTS "tuna_pets_insert" ON public.tuna_pets;
DROP POLICY IF EXISTS "tuna_pets_update" ON public.tuna_pets;

-- tuna_achievements policies
DROP POLICY IF EXISTS "tuna_achievements_select" ON public.tuna_achievements;

-- tuna_user_achievements policies
DROP POLICY IF EXISTS "tuna_user_achievements_select" ON public.tuna_user_achievements;
DROP POLICY IF EXISTS "tuna_user_achievements_insert" ON public.tuna_user_achievements;

-- tuna_accessories policies
DROP POLICY IF EXISTS "tuna_accessories_select" ON public.tuna_accessories;

-- tuna_user_accessories policies
DROP POLICY IF EXISTS "tuna_user_accessories_select" ON public.tuna_user_accessories;
DROP POLICY IF EXISTS "tuna_user_accessories_insert" ON public.tuna_user_accessories;
DROP POLICY IF EXISTS "tuna_user_accessories_update" ON public.tuna_user_accessories;

-- tuna_memories policies
DROP POLICY IF EXISTS "tuna_memories_select" ON public.tuna_memories;
DROP POLICY IF EXISTS "tuna_memories_insert" ON public.tuna_memories;
DROP POLICY IF EXISTS "tuna_memories_update" ON public.tuna_memories;
DROP POLICY IF EXISTS "tuna_memories_delete" ON public.tuna_memories;

-- tuna_daily_stats policies
DROP POLICY IF EXISTS "tuna_daily_stats_select" ON public.tuna_daily_stats;
DROP POLICY IF EXISTS "tuna_daily_stats_insert" ON public.tuna_daily_stats;
DROP POLICY IF EXISTS "tuna_daily_stats_update" ON public.tuna_daily_stats;

-- tuna_focus_sessions policies
DROP POLICY IF EXISTS "tuna_focus_sessions_select" ON public.tuna_focus_sessions;
DROP POLICY IF EXISTS "tuna_focus_sessions_insert" ON public.tuna_focus_sessions;
DROP POLICY IF EXISTS "tuna_focus_sessions_update" ON public.tuna_focus_sessions;
DROP POLICY IF EXISTS "tuna_focus_sessions_delete" ON public.tuna_focus_sessions;

-- ============================================================================
-- 3. DROP FUNCTIONS (they reference tuna table names internally)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_or_create_tuna_pet(UUID);
DROP FUNCTION IF EXISTS public.award_tuna_xp(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.record_tuna_interaction(UUID);
DROP FUNCTION IF EXISTS public.complete_tuna_focus_session(UUID, TEXT);

-- ============================================================================
-- 4. RENAME ENUMS
-- ============================================================================

ALTER TYPE public.tuna_mood RENAME TO mira_mood;
ALTER TYPE public.tuna_achievement_category RENAME TO mira_achievement_category;
ALTER TYPE public.tuna_accessory_category RENAME TO mira_accessory_category;
ALTER TYPE public.tuna_memory_category RENAME TO mira_memory_category;

-- ============================================================================
-- 5. RENAME TABLES (cascades to FK constraints automatically)
-- ============================================================================

ALTER TABLE public.tuna_pets RENAME TO mira_pets;
ALTER TABLE public.tuna_achievements RENAME TO mira_achievements;
ALTER TABLE public.tuna_user_achievements RENAME TO mira_user_achievements;
ALTER TABLE public.tuna_accessories RENAME TO mira_accessories;
ALTER TABLE public.tuna_user_accessories RENAME TO mira_user_accessories;
ALTER TABLE public.tuna_memories RENAME TO mira_memories;
ALTER TABLE public.tuna_daily_stats RENAME TO mira_daily_stats;
ALTER TABLE public.tuna_focus_sessions RENAME TO mira_focus_sessions;

-- ============================================================================
-- 6. RENAME INDEXES
-- ============================================================================

ALTER INDEX IF EXISTS idx_tuna_pets_user_id RENAME TO idx_mira_pets_user_id;
ALTER INDEX IF EXISTS idx_tuna_achievements_category RENAME TO idx_mira_achievements_category;
ALTER INDEX IF EXISTS idx_tuna_achievements_code RENAME TO idx_mira_achievements_code;
ALTER INDEX IF EXISTS idx_tuna_user_achievements_user_id RENAME TO idx_mira_user_achievements_user_id;
ALTER INDEX IF EXISTS idx_tuna_user_achievements_achievement_id RENAME TO idx_mira_user_achievements_achievement_id;
ALTER INDEX IF EXISTS idx_tuna_accessories_category RENAME TO idx_mira_accessories_category;
ALTER INDEX IF EXISTS idx_tuna_user_accessories_user_id RENAME TO idx_mira_user_accessories_user_id;
ALTER INDEX IF EXISTS idx_tuna_user_accessories_equipped RENAME TO idx_mira_user_accessories_equipped;
ALTER INDEX IF EXISTS idx_tuna_memories_user_id RENAME TO idx_mira_memories_user_id;
ALTER INDEX IF EXISTS idx_tuna_memories_category RENAME TO idx_mira_memories_category;
ALTER INDEX IF EXISTS idx_tuna_memories_key RENAME TO idx_mira_memories_key;
ALTER INDEX IF EXISTS idx_tuna_daily_stats_user_date RENAME TO idx_mira_daily_stats_user_date;
ALTER INDEX IF EXISTS idx_tuna_daily_stats_date RENAME TO idx_mira_daily_stats_date;
ALTER INDEX IF EXISTS idx_tuna_focus_sessions_user_id RENAME TO idx_mira_focus_sessions_user_id;
ALTER INDEX IF EXISTS idx_tuna_focus_sessions_started_at RENAME TO idx_mira_focus_sessions_started_at;
ALTER INDEX IF EXISTS idx_tuna_focus_sessions_active RENAME TO idx_mira_focus_sessions_active;

-- ============================================================================
-- 7. RECREATE RLS POLICIES with mira_* names on renamed tables
-- ============================================================================

-- mira_pets: Users can only access their own pet
CREATE POLICY "mira_pets_select" ON public.mira_pets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mira_pets_insert" ON public.mira_pets
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "mira_pets_update" ON public.mira_pets
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- mira_achievements: Everyone can read achievements catalog
CREATE POLICY "mira_achievements_select" ON public.mira_achievements
  FOR SELECT TO authenticated USING (TRUE);

-- mira_user_achievements: Users can only access their own unlocked achievements
CREATE POLICY "mira_user_achievements_select" ON public.mira_user_achievements
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mira_user_achievements_insert" ON public.mira_user_achievements
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- mira_accessories: Everyone can read accessories catalog
CREATE POLICY "mira_accessories_select" ON public.mira_accessories
  FOR SELECT TO authenticated USING (TRUE);

-- mira_user_accessories: Users can only access their own accessories
CREATE POLICY "mira_user_accessories_select" ON public.mira_user_accessories
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mira_user_accessories_insert" ON public.mira_user_accessories
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "mira_user_accessories_update" ON public.mira_user_accessories
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- mira_memories: Users can only access their own memories
CREATE POLICY "mira_memories_select" ON public.mira_memories
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mira_memories_insert" ON public.mira_memories
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "mira_memories_update" ON public.mira_memories
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "mira_memories_delete" ON public.mira_memories
  FOR DELETE USING (user_id = auth.uid());

-- mira_daily_stats: Users can only access their own stats
CREATE POLICY "mira_daily_stats_select" ON public.mira_daily_stats
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mira_daily_stats_insert" ON public.mira_daily_stats
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "mira_daily_stats_update" ON public.mira_daily_stats
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- mira_focus_sessions: Users can only access their own sessions
CREATE POLICY "mira_focus_sessions_select" ON public.mira_focus_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mira_focus_sessions_insert" ON public.mira_focus_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "mira_focus_sessions_update" ON public.mira_focus_sessions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "mira_focus_sessions_delete" ON public.mira_focus_sessions
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- 8. RECREATE TRIGGERS on renamed tables
-- ============================================================================

CREATE TRIGGER update_mira_pets_updated_at
  BEFORE UPDATE ON public.mira_pets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mira_memories_updated_at
  BEFORE UPDATE ON public.mira_memories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mira_daily_stats_updated_at
  BEFORE UPDATE ON public.mira_daily_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 9. RECREATE FUNCTIONS with mira_* references
-- ============================================================================

-- Function to get or create a user's Mira pet
CREATE OR REPLACE FUNCTION public.get_or_create_mira_pet(p_user_id UUID)
RETURNS public.mira_pets AS $$
DECLARE
  v_pet public.mira_pets;
BEGIN
  SELECT * INTO v_pet FROM public.mira_pets WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.mira_pets (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_pet;
  END IF;

  RETURN v_pet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to award XP and handle level ups
CREATE OR REPLACE FUNCTION public.award_mira_xp(p_user_id UUID, p_xp INTEGER, p_source TEXT DEFAULT NULL)
RETURNS public.mira_pets AS $$
DECLARE
  v_pet public.mira_pets;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_new_xp_to_next INTEGER;
BEGIN
  SELECT * INTO v_pet FROM public.get_or_create_mira_pet(p_user_id);

  v_new_xp := v_pet.xp + p_xp;
  v_new_level := v_pet.level;
  v_new_xp_to_next := v_pet.xp_to_next_level;

  WHILE v_new_xp >= v_new_xp_to_next LOOP
    v_new_xp := v_new_xp - v_new_xp_to_next;
    v_new_level := v_new_level + 1;
    v_new_xp_to_next := CEIL(v_new_xp_to_next * 1.2);
  END LOOP;

  UPDATE public.mira_pets
  SET
    xp = v_new_xp,
    level = v_new_level,
    xp_to_next_level = v_new_xp_to_next,
    last_interaction_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING * INTO v_pet;

  INSERT INTO public.mira_daily_stats (user_id, date, xp_earned)
  VALUES (p_user_id, CURRENT_DATE, p_xp)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    xp_earned = mira_daily_stats.xp_earned + p_xp,
    updated_at = NOW();

  RETURN v_pet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record daily interaction and update streak
CREATE OR REPLACE FUNCTION public.record_mira_interaction(p_user_id UUID)
RETURNS public.mira_pets AS $$
DECLARE
  v_pet public.mira_pets;
  v_last_date DATE;
  v_new_streak INTEGER;
BEGIN
  SELECT * INTO v_pet FROM public.get_or_create_mira_pet(p_user_id);

  SELECT date INTO v_last_date
  FROM public.mira_daily_stats
  WHERE user_id = p_user_id
  ORDER BY date DESC
  LIMIT 1;

  IF v_last_date IS NULL THEN
    v_new_streak := 1;
  ELSIF v_last_date = CURRENT_DATE THEN
    v_new_streak := v_pet.streak_days;
  ELSIF v_last_date = CURRENT_DATE - INTERVAL '1 day' THEN
    v_new_streak := v_pet.streak_days + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  UPDATE public.mira_pets
  SET
    streak_days = v_new_streak,
    total_conversations = total_conversations + 1,
    last_interaction_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING * INTO v_pet;

  INSERT INTO public.mira_daily_stats (user_id, date, interactions, streak_day)
  VALUES (p_user_id, CURRENT_DATE, 1, v_new_streak)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    interactions = mira_daily_stats.interactions + 1,
    streak_day = v_new_streak,
    updated_at = NOW();

  RETURN v_pet;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete a focus session
CREATE OR REPLACE FUNCTION public.complete_mira_focus_session(
  p_session_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.mira_focus_sessions AS $$
DECLARE
  v_session public.mira_focus_sessions;
  v_actual_duration INTEGER;
  v_xp_earned INTEGER;
BEGIN
  SELECT * INTO v_session FROM public.mira_focus_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Focus session not found';
  END IF;

  IF v_session.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'Focus session already completed';
  END IF;

  v_actual_duration := EXTRACT(EPOCH FROM (NOW() - v_session.started_at)) / 60;

  v_xp_earned := v_actual_duration;
  IF v_actual_duration >= v_session.planned_duration THEN
    v_xp_earned := v_xp_earned + CEIL(v_session.planned_duration * 0.5);
  END IF;

  UPDATE public.mira_focus_sessions
  SET
    ended_at = NOW(),
    actual_duration = v_actual_duration,
    completed = v_actual_duration >= v_session.planned_duration,
    xp_earned = v_xp_earned,
    notes = COALESCE(p_notes, notes)
  WHERE id = p_session_id
  RETURNING * INTO v_session;

  PERFORM public.award_mira_xp(v_session.user_id, v_xp_earned, 'focus_session');

  UPDATE public.mira_pets
  SET
    total_focus_minutes = total_focus_minutes + v_actual_duration,
    updated_at = NOW()
  WHERE user_id = v_session.user_id;

  INSERT INTO public.mira_daily_stats (user_id, date, focus_minutes, focus_sessions_completed)
  VALUES (
    v_session.user_id,
    CURRENT_DATE,
    v_actual_duration,
    CASE WHEN v_session.completed THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    focus_minutes = mira_daily_stats.focus_minutes + v_actual_duration,
    focus_sessions_completed = mira_daily_stats.focus_sessions_completed +
      CASE WHEN v_session.completed THEN 1 ELSE 0 END,
    updated_at = NOW();

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. UPDATE DEFAULT PET NAME from 'Tuna' to 'Mira'
-- ============================================================================

ALTER TABLE public.mira_pets ALTER COLUMN name SET DEFAULT 'Mira';

-- ============================================================================
-- 11. UPDATE SEED DATA TEXT REFERENCES
-- ============================================================================

-- Update achievement names and descriptions that reference "Tuna"
UPDATE public.mira_achievements SET
  name = 'Hello, Mira!',
  description = 'Have your first conversation with Mira'
WHERE code = 'first_conversation';

UPDATE public.mira_achievements SET
  description = 'Reach level 5 with Mira'
WHERE code = 'level_5';

UPDATE public.mira_achievements SET
  description = 'Reach level 10 with Mira'
WHERE code = 'level_10';

UPDATE public.mira_achievements SET
  description = 'Reach level 25 with Mira'
WHERE code = 'level_25';

UPDATE public.mira_achievements SET
  description = 'Have Mira remember 10 things about you'
WHERE code = 'remember_me';

UPDATE public.mira_achievements SET
  description = 'Have a meaningful conversation with Mira'
WHERE code = 'deep_talk';

UPDATE public.mira_achievements SET
  name = 'Good Provider',
  description = 'Feed Mira for the first time'
WHERE code = 'fed_tuna';

UPDATE public.mira_achievements SET
  description = 'Share a personal story with Mira'
WHERE code = 'share_story';

-- Update existing pet names from "Tuna" to "Mira" (only if user hasn't customized)
UPDATE public.mira_pets SET name = 'Mira' WHERE name = 'Tuna';

-- ============================================================================
-- 12. UPDATE TABLE AND FUNCTION COMMENTS
-- ============================================================================

COMMENT ON TABLE public.mira_pets IS 'User''s Mira companion state - one pet per user for gamified AI assistant';
COMMENT ON TABLE public.mira_achievements IS 'Global catalog of achievements that users can unlock with Mira';
COMMENT ON TABLE public.mira_user_achievements IS 'Junction table tracking which achievements each user has unlocked';
COMMENT ON TABLE public.mira_accessories IS 'Global catalog of accessories for customizing Mira';
COMMENT ON TABLE public.mira_user_accessories IS 'Junction table tracking which accessories each user owns and has equipped';
COMMENT ON TABLE public.mira_memories IS 'Mira''s memory system for remembering facts about users';
COMMENT ON TABLE public.mira_daily_stats IS 'Daily statistics for tracking user activity and calculating mood';
COMMENT ON TABLE public.mira_focus_sessions IS 'Deep work focus sessions with Pomodoro-style timing';

COMMENT ON FUNCTION public.get_or_create_mira_pet IS 'Gets or creates a Mira companion for a user';
COMMENT ON FUNCTION public.award_mira_xp IS 'Awards XP to a user''s Mira companion with automatic level-up handling';
COMMENT ON FUNCTION public.record_mira_interaction IS 'Records a daily interaction and updates streak';
COMMENT ON FUNCTION public.complete_mira_focus_session IS 'Completes a focus session and awards XP';
