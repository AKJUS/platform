import { z } from 'zod';

export const startTimerArgsSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  description: z.union([z.string(), z.null()]).optional(),
});

export type StartTimerArgs = z.infer<typeof startTimerArgsSchema>;

export const stopTimerArgsSchema = z.object({
  sessionId: z.union([z.string(), z.null()]).optional(),
});

export type StopTimerArgs = z.infer<typeof stopTimerArgsSchema>;

export const createTimeTrackingEntryArgsSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  description: z.union([z.string(), z.null()]).optional(),
  categoryId: z.union([z.string(), z.null()]).optional(),
  taskId: z.union([z.string(), z.null()]).optional(),
  startTime: z.unknown(),
  endTime: z.unknown(),
  date: z.unknown().optional(),
});

export type CreateTimeTrackingEntryArgs = z.infer<
  typeof createTimeTrackingEntryArgsSchema
>;

export const updateTimeTrackingSessionArgsSchema = z.object({
  sessionId: z.union([z.string(), z.null()]).optional(),
  id: z.union([z.string(), z.null()]).optional(),
  title: z.unknown().optional(),
  description: z.unknown().optional(),
  categoryId: z.unknown().optional(),
  taskId: z.unknown().optional(),
  startTime: z.unknown().optional(),
  endTime: z.unknown().optional(),
  date: z.unknown().optional(),
});

export type UpdateTimeTrackingSessionArgs = z.infer<
  typeof updateTimeTrackingSessionArgsSchema
>;

export const deleteTimeTrackingSessionArgsSchema = z.object({
  sessionId: z.union([z.string(), z.null()]).optional(),
  id: z.union([z.string(), z.null()]).optional(),
});

export type DeleteTimeTrackingSessionArgs = z.infer<
  typeof deleteTimeTrackingSessionArgsSchema
>;

export const moveTimeTrackingSessionArgsSchema = z.object({
  sessionId: z.union([z.string(), z.null()]).optional(),
  id: z.union([z.string(), z.null()]).optional(),
  targetWorkspaceId: z.union([z.string(), z.null()]),
});

export type MoveTimeTrackingSessionArgs = z.infer<
  typeof moveTimeTrackingSessionArgsSchema
>;

export function getZodErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Invalid arguments';
  }
  return 'Invalid arguments';
}
