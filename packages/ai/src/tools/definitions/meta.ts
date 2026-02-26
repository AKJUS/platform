import { z } from 'zod';
import { tool } from '../core';
import { MIRA_TOOL_NAMES } from '../mira-tool-names';

const validToolSet = new Set<string>(MIRA_TOOL_NAMES);

export const metaToolDefinitions = {
  select_tools: tool({
    description:
      'Pick which tools you need for this request. You MUST call this as your FIRST action every turn. Choose from the available tool names listed in the system prompt. For pure conversation, pick no_action_needed.',
    inputSchema: z.object({
      tools: z
        .array(z.string())
        .min(1)
        .refine(
          (tools) => tools.every((toolName) => validToolSet.has(toolName)),
          {
            message: 'Invalid tool name(s)',
          }
        )
        .describe(
          'Array of tool names to activate (e.g. ["get_my_tasks", "create_task"]). Include all tools you expect to call.'
        ),
    }),
  }),

  no_action_needed: tool({
    description:
      'Call when the message is purely conversational and requires NO real action.',
    inputSchema: z.object({
      reason: z.string().describe('Brief reason (e.g. "user said thanks")'),
    }),
  }),
} as const;
