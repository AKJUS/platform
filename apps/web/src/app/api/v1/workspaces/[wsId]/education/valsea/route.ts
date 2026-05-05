import { resolveWorkspaceId } from '@tuturuuu/utils/constants';
import { sanitizePath } from '@tuturuuu/utils/storage-path';
import { verifyWorkspaceMembershipType } from '@tuturuuu/utils/workspace-helper';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { type AuthorizedRequest, withSessionAuth } from '@/lib/api-auth';
import { serverLogger } from '@/lib/infrastructure/log-drain';
import { createWorkspaceStorageSignedReadUrl } from '@/lib/workspace-storage-provider';
import { gradeVoicePronunciation } from './voice-grading';

type Params = {
  wsId: string;
};

type SemanticTag = {
  meaning?: string;
  phrase?: string;
  tag?: string;
};

type ValseaRecord = Record<string, unknown>;

const VALSEA_BASE_URL = 'https://api.valsea.ai/v1';
const MAX_AUDIO_UPLOAD_BYTES = 10 * 1024 * 1024;
const VALSEA_AUDIO_DRIVE_PATH = 'education/valsea/audio/';
const PRONUNCIATION_MODELS = [
  'local-whisper-large-v3-turbo',
  'local-whisper-large-v3',
  'local-whisper-medium',
  'local-whisper-small',
  'local-whisper-base',
  'local-whisper-tiny',
  'local-wav2vec2',
] as const;
const DEFAULT_PRONUNCIATION_MODEL = 'local-whisper-large-v3-turbo';

const classroomSchema = z.object({
  audioFileName: z.string().trim().min(1).max(255).optional(),
  audioStoragePath: z.string().trim().min(1).max(1024).optional(),
  language: z.string().min(2).max(64).default('auto'),
  outputType: z
    .enum([
      'action_items',
      'email_summary',
      'interview_notes',
      'key_quotes',
      'meeting_minutes',
      'service_log',
      'subtitles',
    ])
    .default('action_items'),
  pronunciationModel: z
    .enum(PRONUNCIATION_MODELS)
    .default(DEFAULT_PRONUNCIATION_MODEL),
  targetLanguage: z.string().min(2).max(64).default('vietnamese'),
  transcript: z.string().trim().min(1).max(12_000).optional(),
});

type ClassroomPayload = z.infer<typeof classroomSchema> & {
  file?: File;
};

type ParsePayloadResult =
  | {
      data: ClassroomPayload;
      error?: never;
    }
  | {
      data?: never;
      error: NextResponse;
    };

function getString(record: ValseaRecord | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function getNumber(record: ValseaRecord | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'number' ? value : undefined;
}

function getStringArray(record: ValseaRecord | undefined, key: string) {
  const value = record?.[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function getSemanticTags(record: ValseaRecord | undefined) {
  const value = record?.semantic_tags;
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (entry): entry is ValseaRecord =>
        !!entry && typeof entry === 'object' && !Array.isArray(entry)
    )
    .map<SemanticTag>((entry) => ({
      meaning: getString(entry, 'meaning'),
      phrase: getString(entry, 'phrase'),
      tag: getString(entry, 'tag'),
    }))
    .filter((entry) => entry.phrase || entry.tag || entry.meaning);
}

function parseValseaTextOutput(record: ValseaRecord | undefined) {
  if (!record) return '';

  const preferredKeys = [
    'formatted_text',
    'output',
    'result',
    'text',
    'content',
    'summary',
  ];

  for (const key of preferredKeys) {
    const value = getString(record, key);
    if (value) return value;
  }

  return JSON.stringify(record, null, 2);
}

function getValseaApiKey(request: NextRequest) {
  return (
    request.headers.get('x-valsea-api-key')?.trim() ||
    process.env.VALSEA_API_KEY?.trim()
  );
}

async function verifyValseaWorkspaceAccess(
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

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as ValseaRecord;
  } catch {
    return { message: text };
  }
}

class ValseaRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function postValseaJson(
  request: NextRequest,
  path: string,
  payload: ValseaRecord
) {
  const apiKey = getValseaApiKey(request);
  if (!apiKey) {
    throw new ValseaRequestError(
      'Provide a Valsea API key or configure VALSEA_API_KEY',
      503
    );
  }

  const response = await fetch(`${VALSEA_BASE_URL}${path}`, {
    body: JSON.stringify(payload),
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const data = await readJsonResponse(response);
  if (!response.ok) {
    throw new ValseaRequestError(
      getString(data, 'message') ||
        getString(data, 'error') ||
        `Valsea request failed with ${response.status}`,
      response.status
    );
  }

  return data;
}

async function transcribeAudio(
  request: NextRequest,
  file: File,
  language: string
) {
  const apiKey = getValseaApiKey(request);
  if (!apiKey) {
    throw new ValseaRequestError(
      'Provide a Valsea API key or configure VALSEA_API_KEY',
      503
    );
  }

  const formData = new FormData();
  formData.set('file', file, file.name);
  formData.set('model', 'valsea-transcribe');
  formData.set('language', language === 'auto' ? 'english' : language);
  formData.set('response_format', 'verbose_json');
  formData.set('enable_correction', 'true');
  formData.set('enable_tags', 'true');

  const response = await fetch(`${VALSEA_BASE_URL}/audio/transcriptions`, {
    body: formData,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    method: 'POST',
  });

  const data = await readJsonResponse(response);
  if (!response.ok) {
    throw new ValseaRequestError(
      getString(data, 'message') ||
        getString(data, 'error') ||
        `Valsea transcription failed with ${response.status}`,
      response.status
    );
  }

  return data;
}

async function readDriveAudioFile({
  audioFileName,
  audioStoragePath,
  wsId,
}: {
  audioFileName?: string;
  audioStoragePath: string;
  wsId: string;
}) {
  const sanitizedPath = sanitizePath(audioStoragePath);
  if (!sanitizedPath?.startsWith(VALSEA_AUDIO_DRIVE_PATH)) {
    throw new ValseaRequestError('Invalid Valsea audio storage path', 400);
  }

  const signedUrl = await createWorkspaceStorageSignedReadUrl(
    resolveWorkspaceId(wsId),
    sanitizedPath,
    { expiresIn: 5 * 60 }
  );
  const response = await fetch(signedUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new ValseaRequestError('Could not read stored classroom audio', 404);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_AUDIO_UPLOAD_BYTES) {
    throw new ValseaRequestError('Audio file must be 10 MB or smaller', 413);
  }

  const fallbackName =
    sanitizedPath.split('/').at(-1) || 'classroom-audio.webm';
  return new File([buffer], audioFileName || fallbackName, {
    type: response.headers.get('content-type') || 'application/octet-stream',
  });
}

async function parsePayload(request: NextRequest): Promise<ParsePayloadResult> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    const parsed = classroomSchema.safeParse({
      language: formData.get('language') || undefined,
      audioFileName: formData.get('audioFileName') || undefined,
      audioStoragePath: formData.get('audioStoragePath') || undefined,
      outputType: formData.get('outputType') || undefined,
      pronunciationModel: formData.get('pronunciationModel') || undefined,
      targetLanguage: formData.get('targetLanguage') || undefined,
      transcript: formData.get('transcript') || undefined,
    });

    if (!parsed.success) {
      return {
        error: NextResponse.json(
          { message: 'Invalid classroom payload' },
          { status: 400 }
        ),
      };
    }

    return {
      data: {
        ...parsed.data,
        file: file instanceof File && file.size > 0 ? file : undefined,
      },
    };
  }

  const parsed = classroomSchema.safeParse(await request.json());
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { message: 'Invalid classroom payload' },
        { status: 400 }
      ),
    };
  }

  return { data: { ...parsed.data, file: undefined } };
}

export const GET = withSessionAuth<Params>(
  async (_request, context, { wsId }) => {
    const accessError = await verifyValseaWorkspaceAccess(context, wsId);
    if (accessError) return accessError;

    return NextResponse.json(
      {
        hasServerKey: Boolean(process.env.VALSEA_API_KEY?.trim()),
        pronunciationDefaultModel: DEFAULT_PRONUNCIATION_MODEL,
        pronunciationModels: PRONUNCIATION_MODELS,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  },
  { rateLimitKind: 'read' }
);

export const POST = withSessionAuth<Params>(
  async (request, context, { wsId }) => {
    try {
      const accessError = await verifyValseaWorkspaceAccess(context, wsId);
      if (accessError) return accessError;

      const parsed = await parsePayload(request);
      if (parsed.error) return parsed.error;

      const {
        audioFileName,
        audioStoragePath,
        language,
        outputType,
        pronunciationModel,
        targetLanguage,
      } = parsed.data;
      const driveFile = audioStoragePath
        ? await readDriveAudioFile({
            audioFileName,
            audioStoragePath,
            wsId,
          })
        : undefined;
      const file = parsed.data.file ?? driveFile;

      if (file && file.size > MAX_AUDIO_UPLOAD_BYTES) {
        return NextResponse.json(
          { message: 'Audio file must be 10 MB or smaller' },
          { status: 413 }
        );
      }

      const transcription = file
        ? await transcribeAudio(request, file, language)
        : null;
      const transcript =
        parsed.data.transcript || getString(transcription ?? undefined, 'text');

      if (!transcript) {
        return NextResponse.json(
          { message: 'Transcript text or an audio file is required' },
          { status: 400 }
        );
      }

      const languageHint = language === 'auto' ? undefined : language;
      const [clarification, annotations] = await Promise.all([
        postValseaJson(request, '/clarifications', {
          language: languageHint,
          model: 'valsea-clarify',
          response_format: 'verbose_json',
          text: transcript,
        }),
        postValseaJson(request, '/annotations', {
          enable_correction: true,
          enable_tags: true,
          language: languageHint,
          model: 'valsea-annotate',
          response_format: 'verbose_json',
          text: transcript,
        }),
      ]);

      const clarifiedText =
        getString(clarification, 'clarified_text') || transcript;
      const semanticTags = [
        ...getSemanticTags(transcription ?? undefined),
        ...getSemanticTags(annotations),
      ];

      const [translation, formatting, sentiment] = await Promise.all([
        postValseaJson(request, '/translations', {
          model: 'valsea-translate',
          response_format: 'verbose_json',
          source: 'auto',
          target: targetLanguage,
          text: clarifiedText,
        }),
        postValseaJson(request, '/formatting', {
          model: 'valsea-format',
          output_type: outputType,
          response_format: 'verbose_json',
          semantic_tags: semanticTags,
          transcript: clarifiedText,
        }),
        postValseaJson(request, '/sentiment', {
          model: 'valsea-sentiment',
          response_format: 'verbose_json',
          semantic_tags: semanticTags,
          transcript: clarifiedText,
        }),
      ]);
      const pronunciation =
        file && parsed.data.transcript
          ? await gradeVoicePronunciation({
              assessorModel: pronunciationModel,
              file,
              language,
              referenceText: parsed.data.transcript,
              transcription,
            })
          : null;

      return NextResponse.json({
        annotations: {
          accentCorrections:
            annotations.accent_corrections ?? transcription?.corrections ?? [],
          annotatedText:
            getString(annotations, 'annotated_text') ||
            getString(transcription ?? undefined, 'annotated_text'),
          raw: annotations,
          semanticTags,
        },
        artifact: {
          output: parseValseaTextOutput(formatting),
          outputType,
          raw: formatting,
        },
        clarification: {
          explanations: clarification.explanations ?? [],
          raw: clarification,
          text: clarifiedText,
        },
        pronunciation,
        sentiment: {
          confidence: getNumber(sentiment, 'confidence'),
          emotions: getStringArray(sentiment, 'emotions'),
          raw: sentiment,
          reasoning: getString(sentiment, 'reasoning'),
          sentiment: getString(sentiment, 'sentiment'),
        },
        source: {
          detectedLanguages:
            transcription?.detected_languages ??
            translation.source_language ??
            [],
          rawTranscript:
            getString(transcription ?? undefined, 'raw_transcript') ||
            transcript,
          transcript,
        },
        translation: {
          raw: translation,
          sourceLanguage: getString(translation, 'source_language'),
          targetLanguage:
            getString(translation, 'target_language') || targetLanguage,
          text: getString(translation, 'translated_text') || '',
        },
      });
    } catch (error) {
      if (error instanceof ValseaRequestError) {
        return NextResponse.json(
          { message: error.message },
          { status: error.status }
        );
      }

      serverLogger.error(
        'Failed to generate Valsea classroom artifact:',
        error
      );
      return NextResponse.json(
        { message: 'Failed to generate classroom artifact' },
        { status: 500 }
      );
    }
  },
  {
    maxPayloadSize: MAX_AUDIO_UPLOAD_BYTES + 512 * 1024,
    rateLimit: { maxRequests: 10, windowMs: 60_000 },
  }
);
