import { z } from 'zod';
import { tool } from '../core';
import { MIRA_TOOL_NAMES } from '../mira-tool-names';

const validToolSet = new Set<string>(MIRA_TOOL_NAMES);

export const metaToolDefinitions = {
  select_tools: tool({
    description:
      'Pick which tools you need for this request. You MUST call this as your FIRST action every turn. Choose from the available tool names listed in the system prompt. Use no_action_needed ONLY for truly conversational turns with no durable info to save and no real-world lookup needed.',
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
      'Call only when the message is purely conversational and requires NO real action (no settings/memory updates, no search, no data/tool operation).',
    inputSchema: z.object({
      reason: z.string().describe('Brief reason (e.g. "user said thanks")'),
    }),
  }),

  google_search: tool({
    description:
      'Search the public web for current, real-time information such as news, pricing, weather, and up-to-date facts.',
    inputSchema: z.object({
      query: z.string().min(1).max(500).describe('Search query for web lookup'),
    }),
  }),
} as const;
