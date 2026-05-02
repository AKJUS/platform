import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAdminClientMock = vi.fn();
const getPermissionsMock = vi.fn();
const normalizeWorkspaceIdMock = vi.fn();
const adminRpcMock = vi.fn();
const rpcSelectMock = vi.fn();
const rpcOrderMock = vi.fn();
const rpcRangeMock = vi.fn();

vi.mock('@tuturuuu/supabase/next/server', () => ({
  createAdminClient: (...args: Parameters<typeof createAdminClientMock>) =>
    createAdminClientMock(...args),
}));

vi.mock('@tuturuuu/utils/workspace-helper', () => ({
  getPermissions: (...args: Parameters<typeof getPermissionsMock>) =>
    getPermissionsMock(...args),
  normalizeWorkspaceId: (
    ...args: Parameters<typeof normalizeWorkspaceIdMock>
  ) => normalizeWorkspaceIdMock(...args),
}));

vi.mock('@/lib/require-attention-users', () => ({
  fetchRequireAttentionUserIds: vi.fn().mockResolvedValue(new Set()),
  withRequireAttentionFlag: vi.fn((users) => users),
}));

import { GET } from './route';

describe('workspace users database route query parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    normalizeWorkspaceIdMock.mockImplementation(async (wsId: string) => wsId);
    getPermissionsMock.mockResolvedValue({
      containsPermission: (permission: string) =>
        permission === 'view_users_private_info' ||
        permission === 'view_users_public_info',
    });

    rpcRangeMock.mockResolvedValue({
      data: [],
      error: null,
      count: 0,
    });
    rpcOrderMock.mockReturnValue({
      range: rpcRangeMock,
    });
    rpcSelectMock.mockReturnValue({
      order: rpcOrderMock,
    });
    adminRpcMock.mockReturnValue({
      select: rpcSelectMock,
    });

    createAdminClientMock.mockResolvedValue({
      rpc: adminRpcMock,
      from: vi.fn(() => {
        throw new Error('Unexpected table lookup');
      }),
    });
  });

  it('defaults omitted withPromotions to false while preserving repeated group filters', async () => {
    const request = new NextRequest(
      'http://localhost/api/v1/workspaces/ws-1/users/database?page=1&pageSize=10&status=active&linkStatus=virtual&requireAttention=all&groupMembership=all&includedGroups=group-a&includedGroups=group-b&excludedGroups=group-c',
      { method: 'GET' }
    );

    const response = await GET(request, {
      params: Promise.resolve({ wsId: 'ws-1' }),
    });

    expect(response.status).toBe(200);
    expect(adminRpcMock).toHaveBeenCalledWith(
      'get_workspace_users',
      {
        _ws_id: 'ws-1',
        included_groups: ['group-a', 'group-b'],
        excluded_groups: ['group-c'],
        search_query: '',
        include_archived: false,
        link_status: 'virtual',
        group_membership: 'all',
      },
      {
        count: 'exact',
      }
    );
    await expect(response.json()).resolves.toMatchObject({
      data: [],
      count: 0,
    });
  });
});
