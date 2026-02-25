import { z } from 'zod';
import { tool } from '../core';

export const timeTrackingToolDefinitions = {
  start_timer: tool({
    description:
      'Start a time tracking session. Stops any currently running timer first.',
    inputSchema: z.object({
      title: z.string().describe('What are you working on?'),
      description: z
        .string()
        .nullish()
        .describe('Additional details, or null/omit'),
    }),
  }),

  stop_timer: tool({
    description: 'Stop the currently running time tracking session.',
    inputSchema: z.object({
      sessionId: z
        .string()
        .nullish()
        .describe('Session UUID, or null/omit for active session'),
    }),
  }),

  list_time_tracking_sessions: tool({
    description:
      'List your time tracking sessions with cursor pagination. By default pending approval sessions are excluded.',
    inputSchema: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Page size (default 20, max 50)'),
      cursor: z
        .string()
        .optional()
        .describe('Pagination cursor from previous response (start_time|id)'),
      includePending: z
        .boolean()
        .optional()
        .describe('Whether to include pending approval sessions'),
    }),
  }),

  get_time_tracking_session: tool({
    description:
      'Get one specific time tracking session by ID in the current workspace.',
    inputSchema: z
      .object({
        sessionId: z.string().optional().describe('Session UUID'),
        id: z
          .string()
          .optional()
          .describe('Alias for sessionId. Use either sessionId or id.'),
      })
      .refine((data) => Boolean(data.sessionId || data.id), {
        message: 'sessionId or id is required',
        path: ['sessionId'],
      }),
  }),

  create_time_tracking_entry: tool({
    description:
      'Create a manual (stopped) time tracking entry. If approval is required and imagePaths are provided, it submits a pending approval request. If approval is required but no imagePaths are provided, it returns requiresApproval=true with guidance.',
    inputSchema: z.object({
      title: z.string().describe('Entry title'),
      description: z
        .string()
        .nullish()
        .describe('Entry description, or null/omit'),
      categoryId: z
        .string()
        .nullish()
        .describe('Time tracking category UUID, or null/omit'),
      taskId: z.string().nullish().describe('Task UUID, or null/omit'),
      startTime: z.iso
        .datetime()
        .describe('Start time (ISO 8601, YYYY-MM-DD HH:mm)'),
      endTime: z.iso
        .datetime()
        .describe('End time (ISO 8601, YYYY-MM-DD HH:mm)'),
      requestId: z
        .uuid()
        .optional()
        .describe(
          'Optional request UUID used for evidence path prefix when approval request is needed'
        ),
      breakTypeId: z
        .string()
        .nullish()
        .describe('Break type UUID, or null/omit'),
      breakTypeName: z
        .string()
        .nullish()
        .describe('Break type name, or null/omit'),
      linkedSessionId: z
        .string()
        .nullish()
        .describe('Linked session UUID, or null/omit'),
      imagePaths: z
        .array(z.string())
        .max(5)
        .optional()
        .describe(
          'Uploaded image storage paths for proof. Required only when approval is needed.'
        ),
    }),
  }),

  create_time_tracking_request: tool({
    description:
      'Deprecated compatibility alias. Prefer create_time_tracking_entry with imagePaths for approval-required entries.',
    inputSchema: z.object({
      requestId: z
        .uuid()
        .optional()
        .describe('Optional request UUID, generated if omitted'),
      title: z.string().describe('Request title'),
      description: z
        .string()
        .nullish()
        .describe('Request description, or null/omit'),
      categoryId: z.string().nullish().describe('Category UUID, or null/omit'),
      taskId: z.string().nullish().describe('Task UUID, or null/omit'),
      date: z
        .string()
        .optional()
        .describe(
          'Optional base date (YYYY-MM-DD) when using HH:mm time inputs'
        ),
      startTime: z.iso
        .datetime()
        .describe('Start time (ISO 8601, YYYY-MM-DD HH:mm)'),
      endTime: z.iso
        .datetime()
        .describe('End time (ISO 8601, YYYY-MM-DD HH:mm)'),
      breakTypeId: z
        .string()
        .nullish()
        .describe('Break type UUID, or null/omit'),
      breakTypeName: z
        .string()
        .nullish()
        .describe('Break type name, or null/omit'),
      linkedSessionId: z
        .string()
        .nullish()
        .describe('Linked session UUID, or null/omit'),
      imagePaths: z
        .array(z.string())
        .max(5)
        .describe('Uploaded image storage paths for proof'),
    }),
  }),

  update_time_tracking_session: tool({
    description:
      'Update fields of an existing time tracking session. Recomputes duration when times change.',
    inputSchema: z
      .object({
        sessionId: z.string().optional().describe('Session UUID'),
        id: z
          .string()
          .optional()
          .describe('Alias for sessionId. Use either sessionId or id.'),
        title: z.string().optional().describe('Updated title'),
        description: z
          .string()
          .nullable()
          .optional()
          .describe('Updated description'),
        categoryId: z
          .string()
          .nullable()
          .optional()
          .describe('Updated category UUID'),
        taskId: z.string().nullable().optional().describe('Updated task UUID'),
        startTime: z.iso
          .datetime()
          .optional()
          .describe('Updated start time (ISO 8601, YYYY-MM-DD HH:mm)'),
        endTime: z.iso
          .datetime()
          .optional()
          .describe('Updated end time (ISO 8601, YYYY-MM-DD HH:mm)'),
      })
      .refine((data) => Boolean(data.sessionId || data.id), {
        message: 'sessionId or id is required',
        path: ['sessionId'],
      }),
  }),

  delete_time_tracking_session: tool({
    description: 'Delete a time tracking session by ID.',
    inputSchema: z
      .object({
        sessionId: z.string().optional().describe('Session UUID'),
        id: z
          .string()
          .optional()
          .describe('Alias for sessionId. Use either sessionId or id.'),
      })
      .refine((data) => Boolean(data.sessionId || data.id), {
        message: 'sessionId or id is required',
        path: ['sessionId'],
      }),
  }),

  move_time_tracking_session: tool({
    description:
      'Move a stopped session to another workspace after membership checks, with category/task remapping by name.',
    inputSchema: z
      .object({
        sessionId: z.string().optional().describe('Session UUID'),
        id: z
          .string()
          .optional()
          .describe('Alias for sessionId. Use either sessionId or id.'),
        targetWorkspaceId: z.string().describe('Destination workspace UUID'),
      })
      .refine((data) => Boolean(data.sessionId || data.id), {
        message: 'sessionId or id is required',
        path: ['sessionId'],
      }),
  }),
} as const;
