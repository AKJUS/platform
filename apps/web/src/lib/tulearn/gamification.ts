import type { Json } from '@tuturuuu/types/supabase';

import { getAdmin } from './db';
import type { Db, TulearnXpSourceType } from './types';

type AwardTulearnXpRow = {
  awarded: boolean;
  xp: number;
};

type AwardTulearnXpRpc = (
  fn: 'award_tulearn_xp',
  args: {
    p_idempotency_key: string;
    p_metadata: Json;
    p_source_id: string | null;
    p_source_type: TulearnXpSourceType;
    p_user_id: string;
    p_ws_id: string;
    p_xp: number;
  }
) => Promise<{ data: AwardTulearnXpRow[] | null; error: unknown | null }>;

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
  const sbAdmin = await getAdmin(db);
  const awardXp = sbAdmin.rpc as unknown as AwardTulearnXpRpc;
  const { data, error } = await awardXp('award_tulearn_xp', {
    p_idempotency_key: idempotencyKey,
    p_metadata: metadata as Json,
    p_source_id: sourceId ?? null,
    p_source_type: sourceType,
    p_user_id: userId,
    p_ws_id: wsId,
    p_xp: xp,
  });

  if (error) throw error;

  const [result] = (data ?? []) as AwardTulearnXpRow[];
  return {
    awarded: Boolean(result?.awarded),
    xp: result?.xp ?? 0,
  };
}
