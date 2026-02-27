import { z } from 'zod';

const ChatRoleSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.toLowerCase())
  .pipe(z.enum(['assistant', 'system', 'user']));

const UIMessagePartSchema = z
  .object({
    type: z.string().trim().min(1),
  })
  .catchall(z.unknown());

const UIMessageSchema = z
  .object({
    id: z.string().optional(),
    role: ChatRoleSchema,
    parts: z.array(UIMessagePartSchema),
    name: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const ChatRequestBodySchema = z.object({
  id: z.string().min(1),
  model: z.string().optional(),
  messages: z.array(UIMessageSchema).optional(),
  wsId: z.string().optional(),
  isMiraMode: z.boolean().optional(),
  timezone: z.string().optional(),
  thinkingMode: z.enum(['thinking', 'fast']).optional(),
});

export type ChatRequestBody = z.infer<typeof ChatRequestBodySchema>;
