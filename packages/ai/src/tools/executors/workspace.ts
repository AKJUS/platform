import type { MiraToolContext } from '../mira-tools';

export async function executeListWorkspaceMembers(
  _args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const { data, error } = await ctx.supabase
    .from('workspace_members')
    .select(
      `
      user_id,
      role,
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
    members: (data || []).map(
      (m: {
        user_id: string;
        role: string;
        created_at: string;
        users: unknown;
      }) => {
        const user = (Array.isArray(m.users) ? m.users[0] : m.users) as {
          display_name: string | null;
        } | null;
        return {
          userId: m.user_id,
          role: m.role,
          displayName: user?.display_name ?? null,
          joinedAt: m.created_at,
        };
      }
    ),
  };
}
