import {
  encodePathSegment,
  getInternalApiClient,
  type InternalApiClientOptions,
} from './client';

export interface ForceSendWorkspacePostEmailPayload {
  postId: string;
  userId: string;
}

export interface GetWorkspacePostsQuery {
  page?: number;
  pageSize?: number;
  start?: string;
  end?: string;
  includedGroups?: string[];
  excludedGroups?: string[];
  userId?: string;
  stage?: string;
  queueStatus?: string;
  approvalStatus?: string;
  showAll?: boolean;
  cursor?: string;
}

export interface GetWorkspacePostsResponse<
  TPost = unknown,
  TSummary = unknown,
> {
  data: TPost[];
  count: number;
  summary: TSummary;
}

export interface GetWorkspacePostsBootstrapResponse {
  wsId: string;
  defaultDateRange: {
    start: string;
    end: string;
  };
}

export interface GetWorkspacePostsPermissionsResponse {
  canApprovePosts: boolean;
  canForceSendPosts: boolean;
}

export async function getWorkspacePosts<TPost = unknown, TSummary = unknown>(
  workspaceId: string,
  query?: GetWorkspacePostsQuery,
  options?: InternalApiClientOptions
) {
  const client = getInternalApiClient(options);
  const search = new URLSearchParams();

  for (const groupId of query?.includedGroups ?? []) {
    search.append('includedGroups', groupId);
  }

  for (const groupId of query?.excludedGroups ?? []) {
    search.append('excludedGroups', groupId);
  }

  const scalarQuery = {
    approvalStatus: query?.approvalStatus,
    cursor: query?.cursor,
    end: query?.end,
    page: query?.page,
    pageSize: query?.pageSize,
    queueStatus: query?.queueStatus,
    showAll: query?.showAll,
    stage: query?.stage,
    start: query?.start,
    userId: query?.userId,
  };
  const suffix = search.toString();
  return client.json<GetWorkspacePostsResponse<TPost, TSummary>>(
    `/api/v1/workspaces/${encodePathSegment(workspaceId)}/posts${suffix ? `?${suffix}` : ''}`,
    {
      query: scalarQuery,
      cache: 'no-store',
    }
  );
}

export async function getWorkspacePostsBootstrap(
  workspaceId: string,
  options?: InternalApiClientOptions
) {
  const client = getInternalApiClient(options);
  return client.json<GetWorkspacePostsBootstrapResponse>(
    `/api/v1/workspaces/${encodePathSegment(workspaceId)}/posts/bootstrap`,
    {
      cache: 'no-store',
    }
  );
}

export async function getWorkspacePostsPermissions(
  workspaceId: string,
  options?: InternalApiClientOptions
) {
  const client = getInternalApiClient(options);
  return client.json<GetWorkspacePostsPermissionsResponse>(
    `/api/v1/workspaces/${encodePathSegment(workspaceId)}/posts/permissions`,
    {
      cache: 'no-store',
    }
  );
}

export async function forceSendWorkspacePostEmail(
  workspaceId: string,
  payload: ForceSendWorkspacePostEmailPayload,
  options?: InternalApiClientOptions
) {
  const client = getInternalApiClient(options);
  return client.json<{ success: true }>(
    `/api/v1/workspaces/${encodePathSegment(workspaceId)}/posts/force-send`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    }
  );
}
