import { createDynamicAdminClient } from '@tuturuuu/supabase/next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withSessionAuth } from '@/lib/api-auth';

const DeleteFileRequestSchema = z.object({
  wsId: z.string().uuid(),
  path: z.string().min(1).max(1024),
});

/**
 * POST /api/ai/chat/delete-file
 *
 * Deletes a previously uploaded chat file from Supabase Storage.
 * Path must remain within `{wsId}/chats/ai/resources/`.
 */
export const POST = withSessionAuth(
  async (req) => {
    try {
      const body = await req.json();
      const { wsId, path } = DeleteFileRequestSchema.parse(body);

      const expectedPrefix = `${wsId}/chats/ai/resources/`;
      if (!path.startsWith(expectedPrefix) || path.includes('..')) {
        return NextResponse.json(
          { message: 'Invalid storage path' },
          { status: 400 }
        );
      }

      const supabase = await createDynamicAdminClient();
      const { error } = await supabase.storage
        .from('workspaces')
        .remove([path]);

      if (error) {
        console.error('Error deleting chat file from storage:', error);
        return NextResponse.json(
          { message: 'Failed to delete file' },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { message: 'Invalid request data', errors: err.issues },
          { status: 400 }
        );
      }

      console.error('Unexpected error in chat delete-file:', err);
      return NextResponse.json(
        { message: 'Internal server error' },
        { status: 500 }
      );
    }
  },
  { rateLimit: { windowMs: 60000, maxRequests: 120 } }
);
