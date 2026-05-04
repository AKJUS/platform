const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DEFAULT_PLATFORM_BRANCH,
  normalizeProjectBranch,
  resolvePlatformProjectTarget,
} = require('./watch-blue-green/projects.js');

test('normalizeProjectBranch defaults platform to production', () => {
  assert.equal(normalizeProjectBranch(''), DEFAULT_PLATFORM_BRANCH);
  assert.equal(normalizeProjectBranch(' staging '), 'staging');
});

test('resolvePlatformProjectTarget blocks a dirty branch mismatch', async () => {
  const result = await resolvePlatformProjectTarget(
    {
      branch: 'main',
      remote: 'origin',
      upstreamBranch: 'main',
      upstreamRef: 'origin/main',
    },
    {
      env: {
        PLATFORM_LOG_DRAIN_DATABASE_URL: 'postgres://local/test',
      },
      listDirtyWorktreePaths: async () => ['apps/web/page.tsx'],
      postgresFactory: () => {
        const sql = async () => [
          {
            auto_deploy_enabled: true,
            selected_branch: 'production',
          },
        ];
        sql.end = async () => {};
        return sql;
      },
      runCommand: async () => ({ code: 0, stderr: '', stdout: '' }),
    }
  );

  assert.equal(result.blocked, true);
  assert.equal(result.target.branch, 'production');
  assert.match(result.message, /dirty/);
});

test('resolvePlatformProjectTarget switches a clean branch mismatch', async () => {
  const calls = [];
  const result = await resolvePlatformProjectTarget(
    {
      branch: 'main',
      remote: 'origin',
      upstreamBranch: 'main',
      upstreamRef: 'origin/main',
    },
    {
      env: {
        PLATFORM_LOG_DRAIN_DATABASE_URL: 'postgres://local/test',
      },
      listDirtyWorktreePaths: async () => [],
      postgresFactory: () => {
        const sql = async () => [
          {
            auto_deploy_enabled: true,
            selected_branch: 'production',
          },
        ];
        sql.end = async () => {};
        return sql;
      },
      runCommand: async (command, args) => {
        calls.push([command, args]);
        return { code: 0, stderr: '', stdout: '' };
      },
    }
  );

  assert.equal(result.blocked, false);
  assert.equal(result.target.upstreamRef, 'origin/production');
  assert.deepEqual(calls, [
    ['git', ['fetch', 'origin', 'production']],
    ['git', ['checkout', 'production']],
  ]);
});
