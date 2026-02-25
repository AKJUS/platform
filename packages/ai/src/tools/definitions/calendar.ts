import { z } from 'zod';
import { tool } from '../core';

export const calendarToolDefinitions = {
  get_upcoming_events: tool({
    description:
      'Get upcoming calendar events for the next N days. Events are automatically decrypted if E2EE is enabled.',
    inputSchema: z.object({
      days: z
        .number()
        .int()
        .min(1)
        .max(30)
        .optional()
        .describe('Number of days to look ahead (default: 7)'),
    }),
  }),

  create_event: tool({
    description:
      'Create a new calendar event. Events are automatically encrypted if E2EE is enabled.',
    inputSchema: z.object({
      title: z.string().describe('Event title'),
      startAt: z.string().describe('Start time ISO 8601'),
      endAt: z.string().describe('End time ISO 8601'),
      description: z
        .string()
        .nullish()
        .describe('Event description, or null/omit'),
      location: z.string().nullish().describe('Event location, or null/omit'),
    }),
  }),

  check_e2ee_status: tool({
    description:
      'Check whether end-to-end encryption is enabled for calendar events in this workspace.',
    inputSchema: z.object({}),
  }),

  enable_e2ee: tool({
    description:
      'Enable end-to-end encryption for calendar events. Once enabled, new events will be encrypted automatically.',
    inputSchema: z.object({}),
  }),
} as const;
