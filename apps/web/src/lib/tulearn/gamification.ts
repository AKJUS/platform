import type { TablesInsert, TablesUpdate } from '@tuturuuu/types/supabase';

import { getAdmin } from './db';
import { getYesterdayKey, toDateKey } from './helpers';
import { getLearnerState } from './learner-state';
import type { Db, TulearnXpSourceType } from './types';

export async function awardTulearnXp({
  db,
  idempotencyKey,
  metadata = {},
  sourceId,
  sourceType,
  userId,
  wsId,
  xp,
}: {
  db?: Db;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  sourceId?: string | null;
  sourceType: TulearnXpSourceType;
  userId: string;
  wsId: string;
  xp: number;
}) {
  const admin = await getAdmin(db);
  const eventPayload: TablesInsert<'tulearn_gamification_events'> = {
    ws_id: wsId,
    user_id: userId,
    source_type: sourceType,
    source_id: sourceId ?? null,
    xp,
    idempotency_key: idempotencyKey,
    metadata:
      metadata as TablesInsert<'tulearn_gamification_events'>['metadata'],
  };
  const { error } = await admin
    .from('tulearn_gamification_events')
    .insert(eventPayload);

  if (error) {
    if (error.code === '23505') {
      return { awarded: false, xp: 0 };
    }
    throw error;
  }

  const currentState = await getLearnerState({ db: admin, userId, wsId });
  const today = toDateKey();
  const yesterday = getYesterdayKey();
  const nextStreak =
    currentState.last_activity_date === today
      ? currentState.current_streak
      : currentState.last_activity_date === yesterday
        ? currentState.current_streak + 1
        : 1;

  const stateUpdate: TablesUpdate<'tulearn_learner_state'> = {
    xp_total: currentState.xp_total + xp,
    current_streak: nextStreak,
    longest_streak: Math.max(currentState.longest_streak, nextStreak),
    last_activity_date: today,
    updated_at: new Date().toISOString(),
  };
  const { error: updateError } = await admin
    .from('tulearn_learner_state')
    .update(stateUpdate)
    .eq('ws_id', wsId)
    .eq('user_id', userId);

  if (updateError) throw updateError;
  return { awarded: true, xp };
}
