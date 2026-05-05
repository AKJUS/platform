import { z } from 'zod';

export const WORKSPACE_HANDLE_REGEX = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;

export const workspaceHandleSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(WORKSPACE_HANDLE_REGEX);
