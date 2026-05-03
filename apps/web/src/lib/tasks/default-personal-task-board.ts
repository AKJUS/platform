import type { TypedSupabaseClient } from '@tuturuuu/supabase';

export const DEFAULT_PERSONAL_TASK_BOARD_NAME = 'Tasks';

interface EnsureDefaultPersonalTaskBoardParams {
  sbAdmin: TypedSupabaseClient;
  userId: string;
  wsId: string;
}

export async function ensureDefaultPersonalTaskBoard({
  sbAdmin,
  userId,
  wsId,
}: EnsureDefaultPersonalTaskBoardParams) {
  const { data: workspace, error: workspaceError } = await sbAdmin
    .from('workspaces')
    .select('id, personal')
    .eq('id', wsId)
    .maybeSingle();

  if (workspaceError) throw workspaceError;
  if (!workspace?.personal) return null;

  const { data: existingBoard, error: existingError } = await sbAdmin
    .from('workspace_boards')
    .select('*')
    .eq('ws_id', wsId)
    .eq('name', DEFAULT_PERSONAL_TASK_BOARD_NAME)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingBoard) return existingBoard;

  const { data: board, error: insertError } = await sbAdmin
    .from('workspace_boards')
    .insert({
      creator_id: userId,
      name: DEFAULT_PERSONAL_TASK_BOARD_NAME,
      ws_id: wsId,
    })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return board;
}
