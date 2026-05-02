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
import {
  chooseBoard,
  chooseLabel,
  chooseList,
  chooseProject,
  chooseWorkspace,
  getWorkspaceConfigId,
  type ListedBoard,
  type ListedLabel,
  type ListedList,
  type ListedProject,
  resolveWorkspaceName,
  selectBoardId,
  selectListId,
  selectTaskId,
} from './selection';
import { checkForCliUpdate, isCliUpdateCheckDisabled } from './update';

function getWorkspaceId(config: CliConfig, flags: Record<string, FlagValue>) {
  const explicit = getFlag(flags, 'workspace') || getFlag(flags, 'ws');
  const workspaceId = explicit || config.currentWorkspaceId || 'personal';

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
    currentBoardId: undefined,
    currentLabelId: undefined,
    currentListId: undefined,
    currentProjectId: undefined,
    currentTaskId: undefined,
    currentWorkspaceId: 'personal',
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
    `${[
      email
        ? `Logged in as ${email}.`
        : 'Logged in with your Tuturuuu account.',
      'Session: Tuturuuu CLI',
      'Current workspace: personal',
      `Config: ${getDefaultConfigPath()}`,
    ].join('\n')}\n`
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

export async function runCli(argv = process.argv.slice(2)) {
  if (argv.length === 1 && (argv[0] === '-v' || argv[0] === '--version')) {
    process.stdout.write(`${packageJson.version}\n`);
    return;
  }

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
        '  workspaces [list]|use [id]',
        '  boards [list]|use|create|update|delete',
        '  lists [list]|use|create|update|delete --board <id>',
        '  tasks [list]|use|get|create|update|delete|move|bulk',
        '  labels [list]|use|create',
        '  projects [list]|use|create|get|tasks',
        '  relationships [list]|create|delete <task-id>',
        '',
        'Selection:',
        '  Omit an id on use/get/update/delete/move to pick with up/down/space/enter.',
        '  The personal workspace is selected by default.',
        '',
        'Task list filters:',
        '  tasks                       open tasks only',
        '  tasks --all                 include done and closed tasks',
        '  tasks --done                completed tasks',
        '  tasks --closed              closed tasks',
        '  tasks --compact             title, list, and workspace only',
        '',
        'Global options:',
        '  -v, --version               print the CLI version',
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
      const currentWorkspaceId = config.currentWorkspaceId || 'personal';
      const [loadedProfile, loadedDefaultWorkspace, workspaces] =
        await Promise.all([
          client.users.profile(),
          client.users.defaultWorkspace(),
          client.workspaces.list(),
        ]);
      profile = loadedProfile;
      defaultWorkspace = loadedDefaultWorkspace;
      currentWorkspace = currentWorkspaceId
        ? (workspaces.find(
            (workspace) =>
              workspace.id === currentWorkspaceId ||
              (currentWorkspaceId === 'personal' && workspace.personal === true)
          ) ?? {
            id: currentWorkspaceId,
            name: currentWorkspaceId,
          })
        : null;
    }

    renderWhoami(
      {
        baseUrl: config.baseUrl,
        configPath: getDefaultConfigPath(),
        currentBoardId: config.currentBoardId,
        currentLabelId: config.currentLabelId,
        currentListId: config.currentListId,
        currentProjectId: config.currentProjectId,
        currentTaskId: config.currentTaskId,
        currentWorkspace,
        currentWorkspaceId: config.currentWorkspaceId || 'personal',
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
        currentWorkspaceId: config.currentWorkspaceId || 'personal',
        group,
        json,
      });
      return;
    }

    if (action === 'use') {
      const workspace = firstId
        ? null
        : await chooseWorkspace(client, config, json);
      const nextWorkspaceId = workspace
        ? getWorkspaceConfigId(workspace)
        : firstId;
      if (!nextWorkspaceId) throw new Error('Missing workspace id.');
      config = {
        ...config,
        currentBoardId: undefined,
        currentLabelId: undefined,
        currentListId: undefined,
        currentProjectId: undefined,
        currentTaskId: undefined,
        currentWorkspaceId: nextWorkspaceId,
      };
      await writeCliConfig(config);
      process.stdout.write(`Current workspace set to ${nextWorkspaceId}\n`);
      return;
    }
  }

  const workspaceId = getWorkspaceId(config, flags);

  if (group === 'boards') {
    if (action === 'list') {
      render(await client.tasks.listBoards(workspaceId), { group, json });
      return;
    }
    if (action === 'use' || action === 'select') {
      const board = firstId
        ? ({ id: firstId } as ListedBoard)
        : await chooseBoard(client, workspaceId, config, json);
      config = {
        ...config,
        currentBoardId: board.id,
        currentListId: undefined,
        currentTaskId: undefined,
      };
      await writeCliConfig(config);
      process.stdout.write(`Current board set to ${board.id}\n`);
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
    if (action === 'update') {
      const selection = firstId
        ? { boardId: firstId, config }
        : await selectBoardId(client, config, workspaceId, flags, json);
      config = selection.config;
      render(
        await client.tasks.updateBoard(
          workspaceId,
          selection.boardId,
          getPayload(flags)
        ),
        { group, json }
      );
      return;
    }
    if (action === 'delete') {
      const selection = firstId
        ? { boardId: firstId, config }
        : await selectBoardId(client, config, workspaceId, flags, json);
      config = {
        ...selection.config,
        currentBoardId: undefined,
        currentListId: undefined,
        currentTaskId: undefined,
      };
      await writeCliConfig(config);
      render(await client.tasks.deleteBoard(workspaceId, selection.boardId), {
        group,
        json,
      });
      return;
    }
  }

  if (group === 'lists') {
    const boardSelection = await selectBoardId(
      client,
      config,
      workspaceId,
      flags,
      json
    );
    config = boardSelection.config;
    const boardId = boardSelection.boardId;
    if (action === 'list') {
      render(await client.tasks.listLists(workspaceId, boardId), {
        group,
        json,
      });
      return;
    }
    if (action === 'use' || action === 'select') {
      const list = firstId
        ? ({ id: firstId } as ListedList)
        : await chooseList(client, workspaceId, boardId, config, json);
      config = {
        ...config,
        currentBoardId: boardId,
        currentListId: list.id,
        currentTaskId: undefined,
      };
      await writeCliConfig(config);
      process.stdout.write(`Current list set to ${list.id}\n`);
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
    if (action === 'update') {
      const listSelection = firstId
        ? { config, listId: firstId }
        : await selectListId(client, config, workspaceId, flags, json);
      config = listSelection.config;
      render(
        await client.tasks.updateList(
          workspaceId,
          boardId,
          listSelection.listId,
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
          boardId: getFlag(flags, 'board') || config.currentBoardId,
          ...getTaskStateFilters(flags),
          includeCount: flags.count === true,
          includeDeleted: flags.deleted === true,
          limit: getFlag(flags, 'limit')
            ? Number(getFlag(flags, 'limit'))
            : undefined,
          listId: getFlag(flags, 'list') || config.currentListId,
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
    if (action === 'use' || action === 'select') {
      const selection = await selectTaskId(
        client,
        config,
        workspaceId,
        flags,
        json,
        firstId
      );
      config = selection.config;
      process.stdout.write(`Current task set to ${selection.taskId}\n`);
      return;
    }
    if (action === 'get') {
      const selection = await selectTaskId(
        client,
        config,
        workspaceId,
        flags,
        json,
        firstId
      );
      config = selection.config;
      render(await client.tasks.get(workspaceId, selection.taskId), {
        group,
        json,
      });
      return;
    }
    if (action === 'create') {
      const listSelection = await selectListId(
        client,
        config,
        workspaceId,
        flags,
        json
      );
      config = listSelection.config;
      render(
        await client.tasks.create(workspaceId, {
          assignee_ids: parseCsv(getFlag(flags, 'assignees')),
          end_date: getFlag(flags, 'end-date') || null,
          label_ids: parseCsv(getFlag(flags, 'labels')),
          listId: listSelection.listId,
          name: getFlag(flags, 'name') || 'Untitled Task',
          priority: (getFlag(flags, 'priority') as never) || null,
          project_ids: parseCsv(getFlag(flags, 'projects')),
          start_date: getFlag(flags, 'start-date') || null,
        }),
        { group, json }
      );
      return;
    }
    if (action === 'update') {
      const selection = await selectTaskId(
        client,
        config,
        workspaceId,
        flags,
        json,
        firstId
      );
      config = selection.config;
      render(
        await client.tasks.update(
          workspaceId,
          selection.taskId,
          getPayload(flags)
        ),
        { group, json }
      );
      return;
    }
    if (action === 'delete') {
      const selection = await selectTaskId(
        client,
        config,
        workspaceId,
        flags,
        json,
        firstId
      );
      config = { ...selection.config, currentTaskId: undefined };
      await writeCliConfig(config);
      render(await client.tasks.delete(workspaceId, selection.taskId), {
        group,
        json,
      });
      return;
    }
    if (action === 'move') {
      const taskSelection = await selectTaskId(
        client,
        config,
        workspaceId,
        flags,
        json,
        firstId
      );
      config = taskSelection.config;
      const targetFlags: Record<string, FlagValue> = { ...flags };
      const targetBoardId =
        getFlag(flags, 'target-board') || getFlag(flags, 'board');
      const targetListId = getFlag(flags, 'list');
      if (targetBoardId) {
        targetFlags.board = targetBoardId;
      }
      if (targetListId) {
        targetFlags.list = targetListId;
      }
      const listSelection = await selectListId(
        client,
        config,
        workspaceId,
        targetFlags,
        json
      );
      config = listSelection.config;
      render(
        await client.tasks.move(workspaceId, taskSelection.taskId, {
          list_id: listSelection.listId,
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
    if (action === 'use' || action === 'select') {
      const label = firstId
        ? ({ id: firstId } as ListedLabel)
        : await chooseLabel(client, workspaceId, config, json);
      config = { ...config, currentLabelId: label.id };
      await writeCliConfig(config);
      process.stdout.write(`Current label set to ${label.id}\n`);
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
    if (action === 'use' || action === 'select') {
      const project = firstId
        ? ({ id: firstId } as ListedProject)
        : await chooseProject(client, workspaceId, config, json);
      config = { ...config, currentProjectId: project.id };
      await writeCliConfig(config);
      process.stdout.write(`Current project set to ${project.id}\n`);
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
    if (action === 'get') {
      const projectId =
        firstId ||
        config.currentProjectId ||
        (await chooseProject(client, workspaceId, config, json)).id;
      config = { ...config, currentProjectId: projectId };
      await writeCliConfig(config);
      render(await client.tasks.getProject(workspaceId, projectId), {
        group,
        json,
      });
      return;
    }
    if (action === 'tasks') {
      const projectId =
        firstId ||
        config.currentProjectId ||
        (await chooseProject(client, workspaceId, config, json)).id;
      config = { ...config, currentProjectId: projectId };
      await writeCliConfig(config);
      render(await client.tasks.getProjectTasks(workspaceId, projectId), {
        group,
        json,
      });
      return;
    }
  }

  if (group === 'relationships') {
    const taskSelection = await selectTaskId(
      client,
      config,
      workspaceId,
      flags,
      json,
      firstId || getFlag(flags, 'task')
    );
    config = taskSelection.config;
    const taskId = taskSelection.taskId;
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
