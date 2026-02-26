import type { PermissionId } from '@tuturuuu/types';
import type { Tool, ToolSet } from 'ai';
import { miraToolDefinitions } from './mira-tool-definitions';
import { executeMiraTool } from './mira-tool-dispatcher';
import type { MiraToolName } from './mira-tool-names';
import {
  MIRA_TOOL_DIRECTORY,
  MIRA_TOOL_PERMISSIONS,
} from './mira-tool-metadata';
import {
  buildRenderUiFailsafeSpec,
  isRenderableRenderUiSpec,
} from './mira-tool-render-ui';
import type { MiraToolContext } from './mira-tool-types';

export {
  MIRA_TOOL_DIRECTORY,
  MIRA_TOOL_PERMISSIONS,
  miraToolDefinitions,
  executeMiraTool,
};
export type { MiraToolContext } from './mira-tool-types';
export type { MiraToolName };

export function createMiraStreamTools(
  ctx: MiraToolContext,
  withoutPermission?: (p: PermissionId) => boolean
): ToolSet {
  const tools: ToolSet = {};
  let renderUiInvalidAttempts = 0;
  const definitionEntries = Object.entries(miraToolDefinitions) as Array<
    [keyof typeof miraToolDefinitions, (typeof miraToolDefinitions)[keyof typeof miraToolDefinitions]]
  >;

  for (const [name, def] of definitionEntries) {
    const requiredPerm = MIRA_TOOL_PERMISSIONS[name];
    let isMissingPermission = false;
    let missingPermissionsStr = '';

    if (requiredPerm && withoutPermission) {
      if (Array.isArray(requiredPerm)) {
        const missing = requiredPerm.filter((p) => withoutPermission(p));
        if (missing.length > 0) {
          isMissingPermission = true;
          missingPermissionsStr = missing.join(', ');
        }
      } else if (withoutPermission(requiredPerm)) {
        isMissingPermission = true;
        missingPermissionsStr = requiredPerm;
      }
    }

    if (isMissingPermission) {
      tools[name] = {
        ...def,
        execute: async () => ({
          ok: false,
          error: `You do not have the required permissions to use this tool. Missing permission(s): ${missingPermissionsStr}. Please inform the user.`,
        }),
      } as Tool;
      continue;
    }

    if (name === 'render_ui') {
      tools[name] = {
        ...def,
        execute: async (args: Record<string, unknown>) => {
          if (isRenderableRenderUiSpec(args)) {
            renderUiInvalidAttempts = 0;
            return { spec: args };
          }

          renderUiInvalidAttempts += 1;
          const isRepeatedInvalidAttempt = renderUiInvalidAttempts > 1;
          return {
            spec: buildRenderUiFailsafeSpec(args),
            autoRecoveredFromInvalidSpec: true,
            ...(isRepeatedInvalidAttempt
              ? { forcedFromRecoveryLoop: true }
              : {}),
            warning:
              'Invalid render_ui spec was replaced with a compact warning indicator because elements was empty or root was missing.',
          };
        },
      } as Tool;
      continue;
    }

    tools[name] = {
      ...def,
      execute: async (args: Record<string, unknown>) =>
        executeMiraTool(name, args, ctx),
    } as Tool;
  }

  return tools;
}
