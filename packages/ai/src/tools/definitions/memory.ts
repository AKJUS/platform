import { z } from 'zod';
import { tool } from '../core';

export const memoryToolDefinitions = {
  remember: tool({
    description:
      'Save a memory or fact about the user. Store rich, contextual values. For people use key format person_<name>.',
    inputSchema: z.object({
      key: z
        .string()
        .describe('Short label (e.g. "user_birthday", "person_quoc")'),
      value: z.string().describe('Detailed contextual content to remember'),
      category: z
        .enum(['preference', 'fact', 'conversation_topic', 'event', 'person'])
        .describe('Memory category'),
    }),
  }),

  recall: tool({
    description:
      'Search saved memories. Pass null query with high maxResults for "everything" requests.',
    inputSchema: z.object({
      query: z
        .string()
        .nullish()
        .describe('Search keywords, or null/omit for all'),
      category: z
        .enum(['preference', 'fact', 'conversation_topic', 'event', 'person'])
        .nullish()
        .describe('Filter by category, or null/omit'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe(
          'Max results (default: 10, use 20-50 for broad queries, 5-10 for specific)'
        ),
    }),
  }),

  delete_memory: tool({
    description: 'Delete a single memory by its exact key.',
    inputSchema: z.object({
      key: z.string().describe('The exact key of the memory to delete'),
    }),
  }),

  list_memories: tool({
    description:
      'List all stored memories, optionally filtered by category. Used for memory hygiene and review.',
    inputSchema: z.object({
      category: z
        .enum(['preference', 'fact', 'conversation_topic', 'event', 'person'])
        .nullish()
        .describe('Category to filter memories by'),
    }),
  }),

  merge_memories: tool({
    description:
      'Consolidate multiple existing memories into a single new memory. The old memories will be deleted.',
    inputSchema: z.object({
      keysToDelete: z
        .array(z.string())
        .describe('Array of exact keys to delete'),
      newKey: z.string().describe('The key for the new consolidated memory'),
      newValue: z
        .string()
        .describe('The value for the new consolidated memory'),
      newCategory: z
        .enum(['preference', 'fact', 'conversation_topic', 'event', 'person'])
        .describe('Category for the new memory'),
    }),
  }),
} as const;
