import type { TypedSupabaseClient } from '@tuturuuu/supabase/next/client';

export interface MiraToolContext {
  userId: string;
  wsId: string;
  chatId?: string;
  supabase: TypedSupabaseClient;
  timezone?: string;
}
