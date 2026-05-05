import type { TablesInsert, TablesUpdate } from '@tuturuuu/types/supabase';

import { DEFAULT_HEARTS, HEART_REFILL_MS } from './constants';
import { getAdmin } from './db';
import type { Db, TulearnState } from './types';

const LEARNER_STATE_SELECT =
  'hearts, max_hearts, xp_total, current_streak, longest_streak, streak_freezes, last_activity_date, last_heart_refill_at';

const LEARNER_STATE_PUBLIC_SELECT =
  'hearts, max_hearts, xp_total, current_streak, longest_streak, streak_freezes, last_activity_date';

export async function getLearnerState({
  db,
  userId,
  wsId,
}: {
  db?: Db;
  userId: string;
  wsId: string;
}): Promise<TulearnState> {
  const admin = await getAdmin(db);
  const { data, error } = await admin
    .from('tulearn_learner_state')
    .select(LEARNER_STATE_SELECT)
    .eq('ws_id', wsId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const initial: TablesInsert<'tulearn_learner_state'> = {
      ws_id: wsId,
      user_id: userId,
      hearts: DEFAULT_HEARTS,
      max_hearts: DEFAULT_HEARTS,
    };
    const { data: created, error: createError } = await admin
      .from('tulearn_learner_state')
      .insert(initial)
      .select(LEARNER_STATE_PUBLIC_SELECT)
      .single();
    if (createError) throw createError;
    return created;
  }

  const lastRefill = new Date(data.last_heart_refill_at).getTime();
  if (
    data.hearts < data.max_hearts &&
    Number.isFinite(lastRefill) &&
    Date.now() - lastRefill >= HEART_REFILL_MS
  ) {
    const refillPayload: TablesUpdate<'tulearn_learner_state'> = {
      hearts: data.max_hearts,
      last_heart_refill_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data: refilled, error: refillError } = await admin
      .from('tulearn_learner_state')
      .update(refillPayload)
      .eq('ws_id', wsId)
      .eq('user_id', userId)
      .select(LEARNER_STATE_PUBLIC_SELECT)
      .single();
    if (refillError) throw refillError;
    return refilled;
  }

  return data;
}

export async function loseHeart({
  db,
  userId,
  wsId,
}: {
  db?: Db;
  userId: string;
  wsId: string;
}) {
  const admin = await getAdmin(db);
  const state = await getLearnerState({ db: admin, userId, wsId });
  const nextHearts = Math.max(0, state.hearts - 1);
  const payload: TablesUpdate<'tulearn_learner_state'> = {
    hearts: nextHearts,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin
    .from('tulearn_learner_state')
    .update(payload)
    .eq('ws_id', wsId)
    .eq('user_id', userId);

  if (error) throw error;
  return nextHearts;
}
