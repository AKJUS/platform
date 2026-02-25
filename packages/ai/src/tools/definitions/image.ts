import { z } from 'zod';
import { tool } from '../core';

export const imageToolDefinitions = {
  create_image: tool({
    description: 'Generate an image from a text description.',
    inputSchema: z.object({
      prompt: z.string().describe('Detailed image description'),
      aspectRatio: z
        .enum(['1:1', '3:4', '4:3', '9:16', '16:9'])
        .optional()
        .describe('Aspect ratio (default 1:1)'),
      model: z
        .enum([
          'google/imagen-4.0-fast-generate-001',
          'google/imagen-4.0-generate-001',
          'google/gemini-2.5-flash-image',
        ])
        .optional()
        .describe('Image model (auto-selected by plan if omitted)'),
    }),
  }),
} as const;
