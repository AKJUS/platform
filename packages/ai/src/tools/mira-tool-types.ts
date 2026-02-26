import type { TypedSupabaseClient } from '@tuturuuu/supabase/next/client';

export interface MiraToolContext {
  userId: string;
  wsId: string;
  supabase: TypedSupabaseClient;
  timezone?: string;
}
