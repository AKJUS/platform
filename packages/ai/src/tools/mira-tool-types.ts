import type { TypedSupabaseClient } from '@tuturuuu/supabase/next/client';

export type MiraToolContext = {
  userId: string;
  wsId: string;
  supabase: TypedSupabaseClient;
  timezone?: string;
};
