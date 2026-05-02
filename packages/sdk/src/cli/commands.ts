import packageJson from '../../package.json';
import { TuturuuuUserClient } from '../platform';
import {
  type FlagValue,
  getDefaultAction,
  getFlag,
  getTaskStateFilters,
  parseArgs,
  parseCsv,
} from './args';
import {
  buildLoginUrl,
  exchangeCliToken,
  readTokenFromStdin,
  receiveTokenFromBrowser,
} from './auth';
import {
  type CliConfig,
  DEFAULT_BASE_URL,
  getDefaultConfigPath,
  normalizeBaseUrl,
  readCliConfig,
  writeCliConfig,
} from './config';
import { render, renderWhoami } from './render';
import { checkForCliUpdate, isCliUpdateCheckDisabled } from './update';

function getWorkspaceId(config: CliConfig, flags: Record<string, FlagValue>) {
  const explicit = getFlag(flags, 'workspace') || getFlag(flags, 'ws');
  const workspaceId = explicit || config.currentWorkspaceId;

  if (!workspaceId) {
    throw new Error(
      'No workspace selected. Use --workspace or run `ttr workspaces use <id>`.'
    );
  }

  return workspaceId;
}

function getClient(config: CliConfig) {
  if (!config.session?.accessToken || !config.session.refreshToken) {
    throw new Error('Not logged in. Run `ttr login` first.');
  }

  return new TuturuuuUserClient({
    accessToken: config.session.accessToken,
    baseUrl: config.baseUrl,
    onSessionRefresh: async (session) => {
      await writeCliConfig({ ...config, session });
    },
    refreshToken: config.session.refreshToken,
  });
}

async function saveSession(config: CliConfig, token: string) {
  const payload = await exchangeCliToken({
    baseUrl: config.baseUrl,
    token,
  });
  const session = {
    accessToken: payload.session.access_token,
    expiresAt: payload.session.expires_at,
    refreshToken: payload.session.refresh_token,
    tokenType: payload.session.token_type,
  };
  const nextConfig: CliConfig = {
    ...config,
    session,
  };
  await writeCliConfig(nextConfig);

  const email =
    payload.email ??
    (await new TuturuuuUserClient({
      accessToken: session.accessToken,
      baseUrl: nextConfig.baseUrl,
      refreshToken: session.refreshToken,
    }).users
      .profile()
      .then((profile) => profile.email)
      .catch(() => null));

  process.stdout.write(
    [
      email
        ? `Logged in as ${email}.`
        : 'Logged in with your Tuturuuu account.',
      'Session: Tuturuuu CLI',
      `Config: ${getDefaultConfigPath()}`,
    ].join('\n') + '\n'
  );
}

async function login(flags: Record<string, FlagValue>, config: CliConfig) {
  config.baseUrl = normalizeBaseUrl(
    getFlag(flags, 'base-url') || config.baseUrl
  );
  const directToken = getFlag(flags, 'token');

  if (directToken) {
    await saveSession(config, directToken);
    return;
  }

  if (flags.copy) {
    const state = crypto.randomUUID();
    const url = buildLoginUrl({
      baseUrl: config.baseUrl,
      mode: 'copy',
      state,
    });
    process.stdout.write(
      `Open this URL, copy the token, then paste it below:\n${url}\n`
    );
    await saveSession(config, await readTokenFromStdin());
    return;
  }

  await saveSession(config, await receiveTokenFromBrowser(config.baseUrl));
}

function getPayload(flags: Record<string, FlagValue>) {
  const payload = getFlag(flags, 'json-payload');
  return payload ? (JSON.parse(payload) as Record<string, unknown>) : {};
}

function resolveWorkspaceName(
  workspaceId: string,
  workspaces: Awaited<ReturnType<TuturuuuUserClient['workspaces']['list']>>
) {
  const workspace = workspaces.find(
    (entry) =>
      entry.id === workspaceId ||
      (workspaceId === 'personal' && entry.personal === true)
  );

  return workspace?.name || workspaceId;
}

export async function runCli(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  const [group, rawAction, rawFirstId] = positionals;
  const relationshipAction =
    group === 'relationships' &&
    rawAction &&
    !['create', 'delete', 'list'].includes(rawAction)
      ? 'list'
      : undefined;
  const action = relationshipAction || rawAction || getDefaultAction(group);
  const firstId = relationshipAction ? rawAction : rawFirstId;
  const json = flags.json === true;

  if (!group || group === 'help' || flags.help) {
    process.stdout.write(
      `${[
        'Usage: ttr <command> [options]',
        '',
        'Commands:',
        '  login [--copy] [--token <token>] [--base-url <url>]',
        '  logout',
        '  whoami',
        '  config set-base-url <url>',
        '  workspaces [list]|use <id>',
        '  boards [list]|create|update|delete',
        '  lists [list]|create|update|delete --board <id>',
        '  tasks [list]|get|create|update|delete|move|bulk',
        '  labels [list]|create',
        '  projects [list]|create|get|tasks',
        '  relationships [list]|create|delete <task-id>',
        '',
        'Task list filters:',
        '  tasks                       open tasks only',
        '  tasks --all                 include done and closed tasks',
        '  tasks --done                completed tasks',
        '  tasks --closed              closed tasks',
        '  tasks --compact             title, list, and workspace only',
      ].join('\n')}\n`
    );
    return;
  }

  let config = await readCliConfig();
  if (flags['no-update-check'] !== true && !isCliUpdateCheckDisabled()) {
    const nextConfig = await checkForCliUpdate({
      config,
      currentVersion: packageJson.version,
    });
    if (nextConfig !== config) {
      await writeCliConfig(nextConfig);
      config = nextConfig;
    }
  }

  if (group === 'login') {
    await login(flags, config);
    return;
  }

  if (group === 'logout') {
    await writeCliConfig({ baseUrl: config.baseUrl || DEFAULT_BASE_URL });
    process.stdout.write('Logged out.\n');
    return;
  }

  if (group === 'whoami') {
    const loggedIn = !!config.session?.accessToken;
    let profile = null;
    let currentWorkspace = null;
    let defaultWorkspace = null;

    if (loggedIn) {
      const client = getClient(config);
      const [loadedProfile, loadedDefaultWorkspace, workspaces] =
        await Promise.all([
          client.users.profile(),
          client.users.defaultWorkspace(),
          client.workspaces.list(),
        ]);
      profile = loadedProfile;
      defaultWorkspace = loadedDefaultWorkspace;
      currentWorkspace = config.currentWorkspaceId
        ? (workspaces.find(
            (workspace) =>
              workspace.id === config.currentWorkspaceId ||
              (config.currentWorkspaceId === 'personal' &&
                workspace.personal === true)
          ) ?? {
            id: config.currentWorkspaceId,
            name: config.currentWorkspaceId,
          })
        : null;
    }

    renderWhoami(
      {
        baseUrl: config.baseUrl,
        configPath: getDefaultConfigPath(),
        currentWorkspace,
        currentWorkspaceId: config.currentWorkspaceId,
        defaultWorkspace,
        loggedIn,
        session: config.session ? 'Tuturuuu CLI' : null,
        user: profile,
      },
      json
    );
    return;
  }

  if (group === 'config' && action === 'set-base-url' && firstId) {
    await writeCliConfig({ ...config, baseUrl: normalizeBaseUrl(firstId) });
    process.stdout.write(`Base URL set to ${normalizeBaseUrl(firstId)}\n`);
    return;
  }

  const client = getClient(config);

  if (group === 'workspaces') {
    if (action === 'list') {
      render(await client.workspaces.list(), {
        currentWorkspaceId: config.currentWorkspaceId,
        group,
        json,
      });
      return;
    }

    if (action === 'use' && firstId) {
      await writeCliConfig({ ...config, currentWorkspaceId: firstId });
      process.stdout.write(`Current workspace set to ${firstId}\n`);
      return;
    }
  }

  const workspaceId = getWorkspaceId(config, flags);

  if (group === 'boards') {
    if (action === 'list') {
      render(await client.tasks.listBoards(workspaceId), { group, json });
      return;
    }
    if (action === 'create') {
      render(
        await client.tasks.createBoard(workspaceId, {
          icon: (getFlag(flags, 'icon') || null) as never,
          name: getFlag(flags, 'name') || 'Untitled Board',
          template_id: getFlag(flags, 'template-id'),
        }),
        { group, json }
      );
      return;
    }
    if (action === 'update' && firstId) {
      render(
        await client.tasks.updateBoard(workspaceId, firstId, getPayload(flags)),
        { group, json }
      );
      return;
    }
    if (action === 'delete' && firstId) {
      render(await client.tasks.deleteBoard(workspaceId, firstId), {
        group,
        json,
      });
      return;
    }
  }

  if (group === 'lists') {
    const boardId = getFlag(flags, 'board') || getFlag(flags, 'board-id');
    if (!boardId) throw new Error('Missing --board.');
    if (action === 'list') {
      render(await client.tasks.listLists(workspaceId, boardId), {
        group,
        json,
      });
      return;
    }
    if (action === 'create') {
      render(
        await client.tasks.createList(workspaceId, boardId, {
          color: getFlag(flags, 'color'),
          name: getFlag(flags, 'name') || 'Untitled List',
          status: getFlag(flags, 'status'),
        }),
        { group, json }
      );
      return;
    }
    if (action === 'update' && firstId) {
      render(
        await client.tasks.updateList(
          workspaceId,
          boardId,
          firstId,
          getPayload(flags)
        ),
        { group, json }
      );
      return;
    }
  }

  if (group === 'tasks') {
    if (action === 'list') {
      const workspaceName =
        flags.compact === true
          ? resolveWorkspaceName(workspaceId, await client.workspaces.list())
          : undefined;
      render(
        await client.tasks.list(workspaceId, {
          boardId: getFlag(flags, 'board'),
          ...getTaskStateFilters(flags),
          includeCount: flags.count === true,
          includeDeleted: flags.deleted === true,
          limit: getFlag(flags, 'limit')
            ? Number(getFlag(flags, 'limit'))
            : undefined,
          listId: getFlag(flags, 'list'),
          offset: getFlag(flags, 'offset')
            ? Number(getFlag(flags, 'offset'))
            : undefined,
          q: getFlag(flags, 'q'),
        }),
        {
          compact: flags.compact === true,
          currentWorkspaceId: workspaceId,
          group,
          json,
          workspaceName,
        }
      );
      return;
    }
    if (action === 'get' && firstId) {
      render(await client.tasks.get(workspaceId, firstId), { group, json });
      return;
    }
    if (action === 'create') {
      const listId = getFlag(flags, 'list');
      if (!listId) throw new Error('Missing --list.');
      render(
        await client.tasks.create(workspaceId, {
          assignee_ids: parseCsv(getFlag(flags, 'assignees')),
          end_date: getFlag(flags, 'end-date') || null,
          label_ids: parseCsv(getFlag(flags, 'labels')),
          listId,
          name: getFlag(flags, 'name') || 'Untitled Task',
          priority: (getFlag(flags, 'priority') as never) || null,
          project_ids: parseCsv(getFlag(flags, 'projects')),
          start_date: getFlag(flags, 'start-date') || null,
        }),
        { group, json }
      );
      return;
    }
    if (action === 'update' && firstId) {
      render(
        await client.tasks.update(workspaceId, firstId, getPayload(flags)),
        { group, json }
      );
      return;
    }
    if (action === 'delete' && firstId) {
      render(await client.tasks.delete(workspaceId, firstId), { group, json });
      return;
    }
    if (action === 'move' && firstId) {
      const listId = getFlag(flags, 'list');
      if (!listId) throw new Error('Missing --list.');
      render(
        await client.tasks.move(workspaceId, firstId, {
          list_id: listId,
          target_board_id: getFlag(flags, 'target-board'),
        }),
        { group, json }
      );
      return;
    }
    if (action === 'bulk') {
      render(
        await client.tasks.bulk(workspaceId, {
          operation: getPayload(flags) as never,
          taskIds: parseCsv(getFlag(flags, 'ids')),
        }),
        { group, json }
      );
      return;
    }
  }

  if (group === 'labels') {
    if (action === 'list') {
      render(await client.tasks.listLabels(workspaceId), { group, json });
      return;
    }
    if (action === 'create') {
      render(
        await client.tasks.createLabel(workspaceId, {
          color: getFlag(flags, 'color') || 'gray',
          name: getFlag(flags, 'name') || 'Untitled Label',
        }),
        { group, json }
      );
      return;
    }
  }

  if (group === 'projects') {
    if (action === 'list') {
      render(await client.tasks.listProjects(workspaceId), { group, json });
      return;
    }
    if (action === 'create') {
      render(
        await client.tasks.createProject(workspaceId, {
          description: getFlag(flags, 'description'),
          name: getFlag(flags, 'name') || 'Untitled Project',
        }),
        { group, json }
      );
      return;
    }
    if (action === 'get' && firstId) {
      render(await client.tasks.getProject(workspaceId, firstId), {
        group,
        json,
      });
      return;
    }
    if (action === 'tasks' && firstId) {
      render(await client.tasks.getProjectTasks(workspaceId, firstId), {
        group,
        json,
      });
      return;
    }
  }

  if (group === 'relationships') {
    const taskId = firstId || getFlag(flags, 'task');
    if (!taskId) throw new Error('Missing task id.');
    if (action === 'list') {
      render(await client.tasks.getRelationships(workspaceId, taskId), {
        group,
        json,
      });
      return;
    }
    if (action === 'create') {
      render(
        await client.tasks.createRelationship(
          workspaceId,
          taskId,
          getPayload(flags) as never
        ),
        { group, json }
      );
      return;
    }
    if (action === 'delete') {
      render(
        await client.tasks.deleteRelationship(
          workspaceId,
          taskId,
          getPayload(flags) as never
        ),
        { group, json }
      );
      return;
    }
  }

  throw new Error(
    `Unknown command: ${[group, action].filter(Boolean).join(' ')}`
  );
}
