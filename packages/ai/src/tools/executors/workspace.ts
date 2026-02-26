import type { Tables } from '@tuturuuu/types';
import type { MiraToolContext } from '../mira-tools';

interface WorkspaceMemberWithUsers
  extends Pick<Tables<'workspace_members'>, 'user_id' | 'created_at'> {
  users: Tables<'users'>[] | Tables<'users'> | null;
}

export async function executeListWorkspaceMembers(
  _args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const { data, error } = await ctx.supabase
    .from('workspace_members')
    .select(
      `
      user_id,
      created_at,
      users:user_id (
        display_name,
        avatar_url
      )
    `
    )
    .eq('ws_id', ctx.wsId)
    .order('created_at', { ascending: true });

  if (error) return { error: error.message };

  return {
    count: data?.length ?? 0,
    members: ((data ?? []) as WorkspaceMemberWithUsers[]).map((m) => {
      const user = Array.isArray(m.users) ? (m.users[0] ?? null) : m.users;
      return {
        userId: m.user_id,
        role: null,
        displayName: user?.display_name ?? null,
        joinedAt: m.created_at,
      };
    }),
  };
}
