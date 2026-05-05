import { randomUUID } from 'node:crypto';
import { resolveWorkspaceId } from '@tuturuuu/utils/constants';
import { sanitizeFilename } from '@tuturuuu/utils/storage-path';
import { verifyWorkspaceMembershipType } from '@tuturuuu/utils/workspace-helper';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { type AuthorizedRequest, withSessionAuth } from '@/lib/api-auth';
import { serverLogger } from '@/lib/infrastructure/log-drain';
import {
  createWorkspaceStorageUploadPayload,
  WorkspaceStorageError,
} from '@/lib/workspace-storage-provider';

type Params = {
  wsId: string;
};

const MAX_AUDIO_UPLOAD_BYTES = 10 * 1024 * 1024;
const VALSEA_AUDIO_DRIVE_PATH = 'education/valsea/audio';
const ALLOWED_AUDIO_EXTENSIONS = new Set([
  'flac',
  'm4a',
  'mp3',
  'mp4',
  'mpeg',
  'oga',
  'ogg',
  'wav',
  'webm',
]);

const uploadUrlSchema = z.object({
  contentType: z.string().max(255).optional(),
  filename: z.string().min(1).max(255),
  size: z.number().int().min(1).max(MAX_AUDIO_UPLOAD_BYTES),
});

async function verifyValseaAudioUploadAccess(
  context: AuthorizedRequest,
  wsId: string
) {
  const resolvedWsId = resolveWorkspaceId(wsId);
  const membership = await verifyWorkspaceMembershipType({
    supabase: context.supabase,
    userId: context.user.id,
    wsId: resolvedWsId,
  });

  if (membership.error === 'membership_lookup_failed') {
    return NextResponse.json(
      { message: 'Could not verify workspace membership' },
      { status: 500 }
    );
  }

  if (!membership.ok) {
    return NextResponse.json(
      { message: "You don't have access to this workspace" },
      { status: 403 }
    );
  }

  return null;
}

export const POST = withSessionAuth<Params>(
  async (request, context, { wsId }) => {
    try {
      const accessError = await verifyValseaAudioUploadAccess(context, wsId);
      if (accessError) return accessError;

      const payload = await request.json().catch(() => null);
      const parsed = uploadUrlSchema.safeParse(payload);
      if (!parsed.success) {
        return NextResponse.json(
          { message: 'Invalid audio upload payload' },
          { status: 400 }
        );
      }

      const sanitizedFilename = sanitizeFilename(parsed.data.filename);
      if (!sanitizedFilename) {
        return NextResponse.json(
          { message: 'Invalid audio filename' },
          { status: 400 }
        );
      }

      const dotIndex = sanitizedFilename.lastIndexOf('.');
      const extension =
        dotIndex >= 0
          ? sanitizedFilename.slice(dotIndex + 1).toLowerCase()
          : '';
      if (!ALLOWED_AUDIO_EXTENSIONS.has(extension)) {
        return NextResponse.json(
          { message: 'Unsupported audio file type' },
          { status: 400 }
        );
      }

      const resolvedWsId = resolveWorkspaceId(wsId);
      const uploadPayload = await createWorkspaceStorageUploadPayload(
        resolvedWsId,
        `${Date.now()}-${randomUUID()}-${sanitizedFilename}`,
        {
          contentType: parsed.data.contentType,
          path: VALSEA_AUDIO_DRIVE_PATH,
          size: parsed.data.size,
          upsert: false,
        }
      );

      return NextResponse.json({
        fullPath: uploadPayload.fullPath,
        headers: uploadPayload.headers,
        path: uploadPayload.path,
        signedUrl: uploadPayload.signedUrl,
        token: uploadPayload.token,
      });
    } catch (error) {
      if (error instanceof WorkspaceStorageError) {
        return NextResponse.json(
          { message: error.message },
          { status: error.status }
        );
      }

      serverLogger.error('Failed to prepare Valsea audio upload:', error);
      return NextResponse.json(
        { message: 'Failed to prepare audio upload' },
        { status: 500 }
      );
    }
  },
  { rateLimit: { maxRequests: 30, windowMs: 60_000 } }
);
