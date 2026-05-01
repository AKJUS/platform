import {
  encodePathSegment,
  getInternalApiClient,
  type InternalApiClientOptions,
} from './client';

export interface InternalAiChatSummary {
  id: string;
  title: string | null;
  created_at: string;
  pinned?: boolean | null;
  is_public?: boolean | null;
  model?: string | null;
}

export interface GenerateWorkspaceCourseModulesFromStoragePayload {
  fileName?: string;
  groupId: string;
  maxCharacters?: number;
  storagePath: string;
}

export interface GeneratedWorkspaceCourseModule {
  id: string;
  name?: string | null;
  content?: string | null;
  sort_key?: number | null;
}

export interface GenerateWorkspaceCourseModulesFromStorageResponse {
  data: unknown;
  createdModules: GeneratedWorkspaceCourseModule[] | null;
  metadata?: {
    title?: string | null;
    creditsCharged?: number;
    truncated?: boolean;
  };
}

export async function listWorkspaceAiModelFavorites(
  workspaceId: string,
  options?: InternalApiClientOptions
) {
  const client = getInternalApiClient(options);
  const payload = await client.json<{ favoriteIds: string[] }>(
    `/api/v1/workspaces/${encodePathSegment(workspaceId)}/ai/model-favorites`,
    {
      cache: 'no-store',
    }
  );

  return payload.favoriteIds ?? [];
}

export async function toggleWorkspaceAiModelFavorite(
  workspaceId: string,
  payload: { modelId: string; isFavorited: boolean },
  options?: InternalApiClientOptions
) {
  const client = getInternalApiClient(options);
  return client.json<{ success: true }>(
    `/api/v1/workspaces/${encodePathSegment(workspaceId)}/ai/model-favorites`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    }
  );
}

export async function listCurrentUserAiChats(
  options?: InternalApiClientOptions
) {
  const client = getInternalApiClient(options);
  return client.json<InternalAiChatSummary[]>('/api/v1/ai/chats', {
    cache: 'no-store',
  });
}

export async function updateAiChat(
  chatId: string,
  payload: Partial<
    Pick<InternalAiChatSummary, 'is_public' | 'title' | 'pinned'>
  >,
  options?: InternalApiClientOptions
) {
  const client = getInternalApiClient(options);
  return client.json<{ success: true }>(
    `/api/v1/ai/chats/${encodePathSegment(chatId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    }
  );
}

export async function generateWorkspaceCourseModulesFromStorage(
  workspaceId: string,
  payload: GenerateWorkspaceCourseModulesFromStoragePayload,
  options?: InternalApiClientOptions
) {
  const client = getInternalApiClient(options);
  return client.json<GenerateWorkspaceCourseModulesFromStorageResponse>(
    '/api/ai/course',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wsId: workspaceId,
        ...payload,
      }),
      cache: 'no-store',
    }
  );
}
