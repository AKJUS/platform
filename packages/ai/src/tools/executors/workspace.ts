import type { Tables } from '@tuturuuu/types';
import type { MiraToolContext } from '../mira-tools';
import {
  getWorkspaceContextWorkspaceId,
  listAccessibleWorkspaceSummaries,
  resolveWorkspaceContextState,
} from '../workspace-context';

interface WorkspaceMemberWithUsers
  extends Pick<Tables<'workspace_members'>, 'user_id' | 'created_at'> {
  users: Tables<'users'>[] | Tables<'users'> | null;
}

export async function executeListWorkspaceMembers(
  _args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const workspaceId = getWorkspaceContextWorkspaceId(ctx);
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
    .eq('ws_id', workspaceId)
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

export async function executeListAccessibleWorkspaces(
  _args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  try {
    const workspaces = await listAccessibleWorkspaceSummaries(
      ctx.supabase,
      ctx.userId
    );

    return {
      count: workspaces.length,
      currentWorkspaceContext: ctx.workspaceContext,
      workspaces,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Failed to list accessible workspaces.',
    };
  }
}

export async function executeGetWorkspaceContext(
  _args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  return {
    currentWorkspaceContext: ctx.workspaceContext,
    note: 'Task, calendar, and finance queries default to the personal workspace unless the user explicitly switches to another workspace.',
  };
}

export async function executeSetWorkspaceContext(
  args: Record<string, unknown>,
  ctx: MiraToolContext
) {
  const workspaceId =
    typeof args.workspaceId === 'string' ? args.workspaceId : '';
  if (!workspaceId.trim()) {
    return { error: 'workspaceId is required.' };
  }

  try {
    const resolvedContext = await resolveWorkspaceContextState({
      supabase: ctx.supabase,
      userId: ctx.userId,
      requestedWorkspaceContextId: workspaceId,
      fallbackWorkspaceId: getWorkspaceContextWorkspaceId(ctx),
      strict: true,
    });

    ctx.workspaceContext = resolvedContext;

    return {
      success: true,
      message: `Workspace context switched to ${resolvedContext.name}.`,
      workspaceContextId: resolvedContext.workspaceContextId,
      currentWorkspaceContext: resolvedContext,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Failed to switch workspace context.',
    };
  }
}
