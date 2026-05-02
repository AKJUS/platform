import { inspect } from 'node:util';
import packageJson from '../../package.json';
import { TuturuuuUserClient } from '../platform';
import {
  buildLoginUrl,
  exchangeCliToken,
  readTokenFromStdin,
  receiveTokenFromBrowser,
} from './auth';
import {
  type CliConfig,
  DEFAULT_BASE_URL,
  normalizeBaseUrl,
  readCliConfig,
  writeCliConfig,
} from './config';
import { checkForCliUpdate, isCliUpdateCheckDisabled } from './update';

type FlagValue = boolean | string;

interface ParsedArgs {
  flags: Record<string, FlagValue>;
  positionals: string[];
}

function parseArgs(args: string[]): ParsedArgs {
  const flags: Record<string, FlagValue> = {};
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/su, 2);
    const key = rawKey || '';
    if (!key) continue;

    if (inlineValue !== undefined) {
      flags[key] = inlineValue;
      continue;
    }

    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i += 1;
      continue;
    }

    flags[key] = true;
  }

  return { flags, positionals };
}

function getFlag(flags: Record<string, FlagValue>, key: string) {
  const value = flags[key];
  return typeof value === 'string' ? value : undefined;
}

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

function render(data: unknown, json = false) {
  if (json) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }

  if (Array.isArray(data)) {
    console.table(data);
    return;
  }

  process.stdout.write(`${inspect(data, { colors: true, depth: 6 })}\n`);
}

function parseCsv(value?: string) {
  return value
    ? value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

async function saveSession(config: CliConfig, token: string) {
  const payload = await exchangeCliToken({
    baseUrl: config.baseUrl,
    token,
  });
  const nextConfig: CliConfig = {
    ...config,
    session: {
      accessToken: payload.session.access_token,
      expiresAt: payload.session.expires_at,
      refreshToken: payload.session.refresh_token,
      tokenType: payload.session.token_type,
    },
  };
  await writeCliConfig(nextConfig);
  process.stdout.write('Logged in with a dedicated Tuturuuu CLI session.\n');
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
    process.stdout.write(`Open this URL and copy the CLI token:\n${url}\n`);
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
  const { flags, positionals } = parseArgs(argv);
  const [group, action, firstId] = positionals;
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
        '  workspaces list|use <id>',
        '  boards list|create|update|delete',
        '  lists list|create|update|delete',
        '  tasks list|get|create|update|delete|move|bulk',
        '  labels list|create',
        '  projects list|create|get|tasks',
        '  relationships list|create|delete',
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
    render(
      {
        baseUrl: config.baseUrl,
        currentWorkspaceId: config.currentWorkspaceId,
        loggedIn: !!config.session?.accessToken,
        session: config.session ? 'Tuturuuu CLI' : null,
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
      render(await client.workspaces.list(), json);
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
      render(await client.tasks.listBoards(workspaceId), json);
      return;
    }
    if (action === 'create') {
      render(
        await client.tasks.createBoard(workspaceId, {
          icon: (getFlag(flags, 'icon') || null) as never,
          name: getFlag(flags, 'name') || 'Untitled Board',
          template_id: getFlag(flags, 'template-id'),
        }),
        json
      );
      return;
    }
    if (action === 'update' && firstId) {
      render(
        await client.tasks.updateBoard(workspaceId, firstId, getPayload(flags)),
        json
      );
      return;
    }
    if (action === 'delete' && firstId) {
      render(await client.tasks.deleteBoard(workspaceId, firstId), json);
      return;
    }
  }

  if (group === 'lists') {
    const boardId = getFlag(flags, 'board') || getFlag(flags, 'board-id');
    if (!boardId) throw new Error('Missing --board.');
    if (action === 'list') {
      render(await client.tasks.listLists(workspaceId, boardId), json);
      return;
    }
    if (action === 'create') {
      render(
        await client.tasks.createList(workspaceId, boardId, {
          color: getFlag(flags, 'color'),
          name: getFlag(flags, 'name') || 'Untitled List',
          status: getFlag(flags, 'status'),
        }),
        json
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
        json
      );
      return;
    }
  }

  if (group === 'tasks') {
    if (action === 'list') {
      render(
        await client.tasks.list(workspaceId, {
          boardId: getFlag(flags, 'board'),
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
        json
      );
      return;
    }
    if (action === 'get' && firstId) {
      render(await client.tasks.get(workspaceId, firstId), json);
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
        json
      );
      return;
    }
    if (action === 'update' && firstId) {
      render(
        await client.tasks.update(workspaceId, firstId, getPayload(flags)),
        json
      );
      return;
    }
    if (action === 'delete' && firstId) {
      render(await client.tasks.delete(workspaceId, firstId), json);
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
        json
      );
      return;
    }
    if (action === 'bulk') {
      render(
        await client.tasks.bulk(workspaceId, {
          operation: getPayload(flags) as never,
          taskIds: parseCsv(getFlag(flags, 'ids')),
        }),
        json
      );
      return;
    }
  }

  if (group === 'labels') {
    if (action === 'list') {
      render(await client.tasks.listLabels(workspaceId), json);
      return;
    }
    if (action === 'create') {
      render(
        await client.tasks.createLabel(workspaceId, {
          color: getFlag(flags, 'color') || 'gray',
          name: getFlag(flags, 'name') || 'Untitled Label',
        }),
        json
      );
      return;
    }
  }

  if (group === 'projects') {
    if (action === 'list') {
      render(await client.tasks.listProjects(workspaceId), json);
      return;
    }
    if (action === 'create') {
      render(
        await client.tasks.createProject(workspaceId, {
          description: getFlag(flags, 'description'),
          name: getFlag(flags, 'name') || 'Untitled Project',
        }),
        json
      );
      return;
    }
    if (action === 'get' && firstId) {
      render(await client.tasks.getProject(workspaceId, firstId), json);
      return;
    }
    if (action === 'tasks' && firstId) {
      render(await client.tasks.getProjectTasks(workspaceId, firstId), json);
      return;
    }
  }

  if (group === 'relationships') {
    const taskId = firstId || getFlag(flags, 'task');
    if (!taskId) throw new Error('Missing task id.');
    if (action === 'list') {
      render(await client.tasks.getRelationships(workspaceId, taskId), json);
      return;
    }
    if (action === 'create') {
      render(
        await client.tasks.createRelationship(
          workspaceId,
          taskId,
          getPayload(flags) as never
        ),
        json
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
        json
      );
      return;
    }
  }

  throw new Error(
    `Unknown command: ${[group, action].filter(Boolean).join(' ')}`
  );
}
