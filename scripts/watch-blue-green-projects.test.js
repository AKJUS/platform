const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DEFAULT_PLATFORM_BRANCH,
  normalizeProjectBranch,
  renderManagedProjectCompose,
  renderManagedProjectProxyServerBlocks,
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

test('resolvePlatformProjectTarget allows manual queued deployment when auto deploy is disabled', async () => {
  const result = await resolvePlatformProjectTarget(
    {
      branch: 'production',
      remote: 'origin',
      upstreamBranch: 'production',
      upstreamRef: 'origin/production',
    },
    {
      env: {
        PLATFORM_LOG_DRAIN_DATABASE_URL: 'postgres://local/test',
      },
      listDirtyWorktreePaths: async () => [],
      postgresFactory: () => {
        const sql = async () => [
          {
            auto_deploy_enabled: false,
            deployment_status: 'queued',
            selected_branch: 'production',
          },
        ];
        sql.end = async () => {};
        return sql;
      },
      runCommand: async () => ({ code: 0, stderr: '', stdout: '' }),
    }
  );

  assert.equal(result.blocked, false);
  assert.equal(result.project.deploymentStatus, 'queued');
});

test('resolvePlatformProjectTarget blocks disabled auto deploy when nothing is queued', async () => {
  const result = await resolvePlatformProjectTarget(
    {
      branch: 'production',
      remote: 'origin',
      upstreamBranch: 'production',
      upstreamRef: 'origin/production',
    },
    {
      env: {
        PLATFORM_LOG_DRAIN_DATABASE_URL: 'postgres://local/test',
      },
      listDirtyWorktreePaths: async () => [],
      postgresFactory: () => {
        const sql = async () => [
          {
            auto_deploy_enabled: false,
            deployment_status: 'ready',
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
  assert.match(result.message, /auto-deploy is disabled/);
});

test('renderManagedProjectCompose keeps project services under platform compose group', () => {
  const compose = renderManagedProjectCompose(
    {
      app_root: 'apps/web',
      id: 'Docs App',
      log_drain_enabled: true,
      port: 3000,
      redis_enabled: true,
      selected_branch: 'main',
    },
    {
      rootDir: '/workspace',
    }
  );

  assert.match(compose, /project-docs-app:/);
  assert.match(compose, /PLATFORM_PROJECT_ID=docs-app/);
  assert.match(compose, /PLATFORM_SELECTED_BRANCH=main/);
  assert.match(compose, /UPSTASH_REDIS_REST_TOKEN/);
});

test('renderManagedProjectProxyServerBlocks renders host routes with project context', () => {
  const config = renderManagedProjectProxyServerBlocks([
    {
      hostnames: ['docs.example.com'],
      id: 'docs-app',
      port: 3000,
      selected_branch: 'main',
    },
  ]);

  assert.match(config, /server_name docs\.example\.com;/);
  assert.match(config, /set \$platform_project_id "docs-app";/);
  assert.match(config, /proxy_pass http:\/\/project_docs_app_upstream;/);
});
