const DEFAULT_PLATFORM_PROJECT_ID = 'platform';
const DEFAULT_PLATFORM_BRANCH = 'production';
const LOG_DRAIN_DATABASE_URL_KEY = 'PLATFORM_LOG_DRAIN_DATABASE_URL';

function normalizeProjectBranch(value) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : DEFAULT_PLATFORM_BRANCH;
}

async function readPlatformProject({
  env = process.env,
  postgresFactory = null,
} = {}) {
  const databaseUrl = env[LOG_DRAIN_DATABASE_URL_KEY]?.trim();
  if (!databaseUrl) {
    return {
      autoDeployEnabled: true,
      id: DEFAULT_PLATFORM_PROJECT_ID,
      selectedBranch: DEFAULT_PLATFORM_BRANCH,
      source: 'default',
    };
  }

  let postgres = postgresFactory;
  if (!postgres) {
    try {
      postgres = require('postgres');
    } catch {
      return {
        autoDeployEnabled: true,
        id: DEFAULT_PLATFORM_PROJECT_ID,
        selectedBranch: DEFAULT_PLATFORM_BRANCH,
        source: 'fallback',
      };
    }
  }

  const sql = postgres(databaseUrl, {
    connect_timeout: 2,
    idle_timeout: 2,
    max: 1,
    prepare: false,
  });

  try {
    const rows = await sql`
      SELECT id, selected_branch, auto_deploy_enabled
      FROM infrastructure_projects
      WHERE id = ${DEFAULT_PLATFORM_PROJECT_ID}
      LIMIT 1
    `;
    const row = rows[0];

    return {
      autoDeployEnabled: row?.auto_deploy_enabled !== false,
      id: DEFAULT_PLATFORM_PROJECT_ID,
      selectedBranch: normalizeProjectBranch(row?.selected_branch),
      source: row ? 'database' : 'default',
    };
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

async function resolvePlatformProjectTarget(
  baseTarget,
  {
    env = process.env,
    listDirtyWorktreePaths,
    log = null,
    postgresFactory = null,
    runCommand,
  } = {}
) {
  const project = await readPlatformProject({ env, postgresFactory });
  if (
    project.source === 'default' &&
    !env[LOG_DRAIN_DATABASE_URL_KEY]?.trim()
  ) {
    return {
      blocked: false,
      project,
      target: baseTarget,
    };
  }

  const selectedBranch = normalizeProjectBranch(project.selectedBranch);

  if (!project.autoDeployEnabled) {
    return {
      blocked: true,
      message: `Project ${project.id} auto-deploy is disabled.`,
      project,
      target: baseTarget,
    };
  }

  if (selectedBranch === baseTarget.branch) {
    return {
      blocked: false,
      project,
      target: baseTarget,
    };
  }

  const dirtyPaths =
    typeof listDirtyWorktreePaths === 'function'
      ? await listDirtyWorktreePaths({ env, runCommand })
      : [];

  if (dirtyPaths.length > 0) {
    return {
      blocked: true,
      message: `Project ${project.id} targets ${selectedBranch}, but the current checkout is dirty.`,
      project,
      target: {
        ...baseTarget,
        branch: selectedBranch,
        upstreamBranch: selectedBranch,
        upstreamRef: `${baseTarget.remote}/${selectedBranch}`,
      },
    };
  }

  const fetch = await runCommand(
    'git',
    ['fetch', baseTarget.remote, selectedBranch],
    {
      env,
      stdio: 'pipe',
    }
  );
  if (fetch.code !== 0) {
    throw new Error(
      fetch.stderr?.trim() ||
        fetch.stdout?.trim() ||
        `Unable to fetch ${baseTarget.remote}/${selectedBranch}.`
    );
  }

  const checkout = await runCommand('git', ['checkout', selectedBranch], {
    env,
    stdio: 'pipe',
  });

  if (checkout.code !== 0) {
    const createBranch = await runCommand(
      'git',
      [
        'checkout',
        '-B',
        selectedBranch,
        `${baseTarget.remote}/${selectedBranch}`,
      ],
      {
        env,
        stdio: 'pipe',
      }
    );

    if (createBranch.code !== 0) {
      throw new Error(
        createBranch.stderr?.trim() ||
          createBranch.stdout?.trim() ||
          `Unable to check out ${selectedBranch}.`
      );
    }
  }

  log?.info?.(
    `Switched platform project from ${baseTarget.branch} to ${selectedBranch}.`
  );

  return {
    blocked: false,
    project,
    target: {
      ...baseTarget,
      branch: selectedBranch,
      upstreamBranch: selectedBranch,
      upstreamRef: `${baseTarget.remote}/${selectedBranch}`,
    },
  };
}

module.exports = {
  DEFAULT_PLATFORM_BRANCH,
  DEFAULT_PLATFORM_PROJECT_ID,
  normalizeProjectBranch,
  readPlatformProject,
  resolvePlatformProjectTarget,
};
