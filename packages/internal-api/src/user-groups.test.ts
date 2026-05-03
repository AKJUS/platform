import type { UserGroup } from '@tuturuuu/types/primitives/UserGroup';
import { describe, expect, it } from 'vitest';
import { getNextWorkspaceUserGroupsPageParam } from './user-groups';

function createGroups(count: number): UserGroup[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `group-${index}`,
    is_guest: false,
    name: `Group ${index}`,
  }));
}

describe('workspace user groups pagination', () => {
  it('continues pagination after a full page when more rows remain', () => {
    expect(
      getNextWorkspaceUserGroupsPageParam(
        {
          count: 120,
          data: createGroups(50),
          page: 1,
          pageSize: 50,
        },
        [
          {
            count: 120,
            data: createGroups(50),
            page: 1,
            pageSize: 50,
          },
        ]
      )
    ).toBe(2);
  });

  it('stops pagination when the API returns an empty page even if count is stale', () => {
    expect(
      getNextWorkspaceUserGroupsPageParam(
        {
          count: 10,
          data: [],
          page: 2,
          pageSize: 50,
        },
        [
          {
            count: 10,
            data: [],
            page: 2,
            pageSize: 50,
          },
        ]
      )
    ).toBeUndefined();
  });

  it('stops pagination after a short final page', () => {
    expect(
      getNextWorkspaceUserGroupsPageParam(
        {
          count: 51,
          data: createGroups(1),
          page: 2,
          pageSize: 50,
        },
        [
          {
            count: 51,
            data: createGroups(50),
            page: 1,
            pageSize: 50,
          },
          {
            count: 51,
            data: createGroups(1),
            page: 2,
            pageSize: 50,
          },
        ]
      )
    ).toBeUndefined();
  });
});
