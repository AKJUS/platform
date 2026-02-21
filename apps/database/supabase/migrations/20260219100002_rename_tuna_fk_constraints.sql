-- Migration: Rename remaining tuna_* FK constraints to mira_*
-- These were not automatically renamed when the tables were renamed.

-- mira_daily_stats
ALTER TABLE public.mira_daily_stats
  RENAME CONSTRAINT tuna_daily_stats_user_id_fkey TO mira_daily_stats_user_id_fkey;

-- mira_focus_sessions
ALTER TABLE public.mira_focus_sessions
  RENAME CONSTRAINT tuna_focus_sessions_user_id_fkey TO mira_focus_sessions_user_id_fkey;

-- mira_memories
ALTER TABLE public.mira_memories
  RENAME CONSTRAINT tuna_memories_user_id_fkey TO mira_memories_user_id_fkey;

-- mira_pets
ALTER TABLE public.mira_pets
  RENAME CONSTRAINT tuna_pets_user_id_fkey TO mira_pets_user_id_fkey;

-- mira_user_accessories
ALTER TABLE public.mira_user_accessories
  RENAME CONSTRAINT tuna_user_accessories_accessory_id_fkey TO mira_user_accessories_accessory_id_fkey;

ALTER TABLE public.mira_user_accessories
  RENAME CONSTRAINT tuna_user_accessories_user_id_fkey TO mira_user_accessories_user_id_fkey;

-- mira_user_achievements
ALTER TABLE public.mira_user_achievements
  RENAME CONSTRAINT tuna_user_achievements_achievement_id_fkey TO mira_user_achievements_achievement_id_fkey;

ALTER TABLE public.mira_user_achievements
  RENAME CONSTRAINT tuna_user_achievements_user_id_fkey TO mira_user_achievements_user_id_fkey;
