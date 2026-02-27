import { generateRandomUUID } from '@tuturuuu/utils/uuid-helper';
import type { UIMessage } from 'ai';
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
  id: z.string().optional(),
  model: z.string().optional(),
  messages: z.array(UIMessageSchema).optional(),
  wsId: z.string().optional(),
  isMiraMode: z.boolean().optional(),
  timezone: z.string().optional(),
  thinkingMode: z.enum(['thinking', 'fast']).optional(),
});

export type ChatRequestBody = z.infer<typeof ChatRequestBodySchema>;

export function mapToUIMessages(
  messages: ChatRequestBody['messages']
): UIMessage[] {
  if (!messages) return [];

  return messages.map(
    (message): UIMessage => ({
      id: message.id ?? generateRandomUUID(),
      role: message.role,
      parts: message.parts.map((part) => ({ ...part })) as UIMessage['parts'],
      ...(message.name ? { name: message.name } : {}),
      ...(message.metadata ? { metadata: message.metadata } : {}),
    })
  );
}
