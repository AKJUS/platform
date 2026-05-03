'use client';

import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import type { UserGroup } from '@tuturuuu/types/primitives/UserGroup';

export type UserGroupStatusFilter = 'all' | 'active' | 'archived';

export interface UserGroupsParams {
  includeArchived?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
  status?: UserGroupStatusFilter;
}

export interface UserGroupsResponse {
  data: UserGroup[];
  count: number;
  error?: boolean;
  errorMessage?: string;
}

interface UserGroupsPageResponse extends UserGroupsResponse {
  page: number;
  pageSize: number;
}

/**
 * Type for manager user data from workspace_users table.
 * Used when fetching group managers.
 */
export type ManagerUser = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  display_name: string | null;
  email: string | null;
  hasLinkedPlatformUser: boolean;
};

const GROUPS_INFINITE_PAGE_SIZE = 50;

async function fetchUserGroupsPage(
  wsId: string,
  params: UserGroupsParams = {}
): Promise<UserGroupsPageResponse> {
  const {
    includeArchived = false,
    q = '',
    page = 1,
    pageSize = GROUPS_INFINITE_PAGE_SIZE,
    status = includeArchived ? 'all' : 'active',
  } = params;
  const searchParams = new URLSearchParams();

  if (status !== 'active') searchParams.set('status', status);
  if (q) searchParams.set('q', q);
  searchParams.set('page', String(page));
  searchParams.set('pageSize', String(pageSize));

  const response = await fetch(
    `/api/v1/workspaces/${wsId}/users/groups?${searchParams.toString()}`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch workspace user groups');
  }

  const json = (await response.json()) as UserGroupsResponse;
  if (json.error) {
    const errorMessage =
      json.errorMessage || 'Failed to fetch workspace user groups';
    throw new Error(errorMessage);
  }

  return {
    ...json,
    page,
    pageSize,
  };
}

export function useUserGroups(
  wsId: string,
  params: UserGroupsParams = {},
  options?: {
    enabled?: boolean;
    initialData?: UserGroupsResponse;
  }
) {
  const {
    includeArchived = false,
    q = '',
    page = 1,
    pageSize = 10,
    status = includeArchived ? 'all' : 'active',
  } = params;

  return useQuery({
    queryKey: ['workspace-user-groups', wsId, { q, page, pageSize, status }],
    queryFn: async (): Promise<UserGroupsResponse> => {
      const { data, count, error, errorMessage } = await fetchUserGroupsPage(
        wsId,
        {
          includeArchived,
          q,
          page,
          pageSize,
          status,
        }
      );

      return { data, count, error, errorMessage };
    },
    enabled: options?.enabled !== false,
    initialData: options?.initialData,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useInfiniteUserGroups(
  wsId: string,
  params: Pick<
    UserGroupsParams,
    'includeArchived' | 'q' | 'pageSize' | 'status'
  > = {},
  options?: {
    enabled?: boolean;
    initialData?: UserGroupsResponse;
  }
) {
  const {
    includeArchived = false,
    q = '',
    pageSize = GROUPS_INFINITE_PAGE_SIZE,
    status = includeArchived ? 'all' : 'active',
  } = params;

  const query = useInfiniteQuery({
    queryKey: ['workspace-user-groups-infinite', wsId, { q, pageSize, status }],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      fetchUserGroupsPage(wsId, {
        includeArchived,
        q,
        page: pageParam,
        pageSize,
        status,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce(
        (total, currentPage) => total + currentPage.data.length,
        0
      );

      if (loadedCount >= lastPage.count) {
        return undefined;
      }

      return allPages.length + 1;
    },
    enabled: options?.enabled !== false,
    initialData: options?.initialData
      ? {
          pages: [
            {
              ...options.initialData,
              page: 1,
              pageSize,
            },
          ],
          pageParams: [1],
        }
      : undefined,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const groups = query.data?.pages.flatMap((page) => page.data) ?? [];
  const count = query.data?.pages[0]?.count ?? 0;

  return {
    ...query,
    groups,
    count,
  };
}
