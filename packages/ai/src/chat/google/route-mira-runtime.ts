import type { TypedSupabaseClient } from '@tuturuuu/supabase/next/client';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import type { NextRequest } from 'next/server';
import { buildMiraContext } from '../../tools/context-builder';
import {
  createMiraStreamTools,
  type MiraToolContext,
} from '../../tools/mira-tools';
import { buildMiraSystemInstruction } from '../mira-system-instruction';

type PermissionResultLike = {
  withoutPermission?: (permission: unknown) => boolean;
};

type SupabaseClientLike = TypedSupabaseClient;

type PrepareMiraRuntimeParams = {
  isMiraMode?: boolean;
  wsId?: string;
  request: NextRequest;
  userId: string;
  chatId: string;
  supabase: SupabaseClientLike;
  timezone?: string;
};

export async function prepareMiraRuntime({
  isMiraMode,
  wsId,
  request,
  userId,
  chatId,
  supabase,
  timezone,
}: PrepareMiraRuntimeParams): Promise<{
  miraSystemPrompt?: string;
  miraTools?: ReturnType<typeof createMiraStreamTools>;
}> {
  if (!isMiraMode || !wsId) {
    return {};
  }

  let withoutPermission: PermissionResultLike['withoutPermission'];
  try {
    const permissionsResult = (await getPermissions({
      wsId,
      request,
    })) as PermissionResultLike | null;
    if (permissionsResult) {
      withoutPermission = permissionsResult.withoutPermission;
    }
  } catch (permErr) {
    console.error('Failed to get permissions for Mira tools:', permErr);
  }

  const ctx: MiraToolContext = {
    userId,
    wsId,
    chatId,
    supabase,
    timezone,
  };

  let miraSystemPrompt: string;
  try {
    const { contextString, soul, isFirstInteraction } =
      await buildMiraContext(ctx);
    const dynamicInstruction = buildMiraSystemInstruction({
      soul,
      isFirstInteraction,
      withoutPermission,
    });
    miraSystemPrompt = `${contextString}\n\n${dynamicInstruction}`;
  } catch (ctxErr) {
    console.error(
      'Failed to build Mira context (continuing with default instruction):',
      ctxErr
    );
    miraSystemPrompt = buildMiraSystemInstruction({ withoutPermission });
  }

  return {
    miraSystemPrompt,
    miraTools: createMiraStreamTools(ctx, withoutPermission),
  };
}
