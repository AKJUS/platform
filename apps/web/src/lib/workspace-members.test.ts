import { describe, expect, it } from 'vitest';
import { resolveWorkspaceMemberDisplayName } from './workspace-members';

describe('resolveWorkspaceMemberDisplayName', () => {
  it('prefers a non-empty workspace display name', () => {
    expect(
      resolveWorkspaceMemberDisplayName({
        workspaceDisplayName: 'Workspace Alias',
        workspaceFullName: 'Workspace Full Name',
        userDisplayName: 'User Display Name',
      })
    ).toBe('Workspace Alias');
  });

  it('falls back to workspace full name when workspace display name is empty', () => {
    expect(
      resolveWorkspaceMemberDisplayName({
        workspaceDisplayName: '   ',
        workspaceFullName: 'Workspace Full Name',
        userDisplayName: 'User Display Name',
      })
    ).toBe('Workspace Full Name');
  });

  it('falls back to user display name when workspace profile names are empty', () => {
    expect(
      resolveWorkspaceMemberDisplayName({
        workspaceDisplayName: null,
        workspaceFullName: '',
        userDisplayName: 'User Display Name',
      })
    ).toBe('User Display Name');
  });
});
