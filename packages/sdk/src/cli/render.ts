import { inspect } from 'node:util';

type RenderableRecord = Record<string, unknown>;

export interface RenderOptions {
  compact?: boolean;
  currentWorkspaceId?: string;
  group?: string;
  json?: boolean;
  workspaceName?: string;
}

function asRecord(value: unknown): RenderableRecord {
  return value && typeof value === 'object' ? (value as RenderableRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function getNestedRecord(value: unknown, key: string) {
  return asRecord(asRecord(value)[key]);
}

function getTaskListName(task: unknown) {
  return asString(getNestedRecord(task, 'task_lists').name, 'No list');
}

function getTaskBoardName(task: unknown) {
  return asString(asRecord(task).board_name, 'No board');
}

function getTaskStatus(task: unknown) {
  const record = asRecord(task);
  if (record.closed_at) return 'closed';
  if (record.completed_at) return 'done';
  return 'open';
}

function getTaskKey(task: unknown) {
  const record = asRecord(task);
  const prefix = asString(record.ticket_prefix);
  const displayNumber = record.display_number;

  if (prefix && typeof displayNumber === 'number') {
    return `${prefix}-${displayNumber}`;
  }

  return asString(record.id);
}

function renderTable(rows: RenderableRecord[]) {
  if (rows.length === 0) {
    process.stdout.write('No results.\n');
    return;
  }

  console.table(rows);
}

function renderWorkspaces(data: unknown, currentWorkspaceId?: string) {
  renderTable(
    asArray(data).map((workspace) => {
      const record = asRecord(workspace);
      return {
        Name: asString(record.name, 'Untitled workspace'),
        Id: asString(record.id),
        Current:
          record.id === currentWorkspaceId ||
          (currentWorkspaceId === 'personal' && record.personal === true)
            ? 'yes'
            : '',
        Personal: record.personal === true ? 'yes' : '',
        Tier: asString(record.tier),
      };
    })
  );
}

function renderBoards(data: unknown) {
  const boards = asArray(asRecord(data).boards);
  renderTable(
    boards.map((board) => {
      const record = asRecord(board);
      return {
        Name: asString(record.name, 'Untitled board'),
        Id: asString(record.id),
        Prefix: asString(record.ticket_prefix),
        Lists: record.list_count ?? '',
        Tasks: record.task_count ?? '',
      };
    })
  );
}

function renderLists(data: unknown) {
  renderTable(
    asArray(asRecord(data).lists).map((list) => {
      const record = asRecord(list);
      return {
        Name: asString(record.name, 'Untitled list'),
        Id: asString(record.id),
        Status: asString(record.status),
        Color: asString(record.color),
      };
    })
  );
}

function renderLabels(data: unknown) {
  renderTable(
    asArray(data).map((label) => {
      const record = asRecord(label);
      return {
        Name: asString(record.name, 'Untitled label'),
        Id: asString(record.id),
        Color: asString(record.color),
      };
    })
  );
}

function renderProjects(data: unknown) {
  renderTable(
    asArray(data).map((project) => {
      const record = asRecord(project);
      return {
        Name: asString(record.name, 'Untitled project'),
        Id: asString(record.id),
        Status: asString(record.status),
      };
    })
  );
}

function renderTasks(data: unknown, options: RenderOptions) {
  const tasks = asArray(asRecord(data).tasks);

  if (options.compact) {
    renderTable(
      tasks.map((task) => ({
        Title: asString(asRecord(task).name, 'Untitled task'),
        List: getTaskListName(task),
        Workspace: options.workspaceName || options.currentWorkspaceId || '',
      }))
    );
    return;
  }

  renderTable(
    tasks.map((task) => {
      const record = asRecord(task);
      return {
        Key: getTaskKey(task),
        Title: asString(record.name, 'Untitled task'),
        List: getTaskListName(task),
        Board: getTaskBoardName(task),
        Status: getTaskStatus(task),
        Priority: asString(record.priority),
        Due: asString(record.end_date),
      };
    })
  );

  const count = asRecord(data).count;
  if (typeof count === 'number') {
    process.stdout.write(`${count} total\n`);
  }
}

export function renderWhoami(data: unknown, json = false) {
  if (json) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }

  const record = asRecord(data);
  const user = asRecord(record.user);
  const currentWorkspace = asRecord(record.currentWorkspace);
  const defaultWorkspace = asRecord(record.defaultWorkspace);

  process.stdout.write(
    `${[
      'Tuturuuu CLI',
      `Status: ${record.loggedIn ? 'logged in' : 'not logged in'}`,
      `User: ${asString(user.display_name, asString(user.email, 'unknown'))}`,
      `Email: ${asString(user.email, 'unknown')}`,
      `User ID: ${asString(user.id, 'unknown')}`,
      `Base URL: ${asString(record.baseUrl)}`,
      `Config: ${asString(record.configPath)}`,
      `Current workspace: ${asString(currentWorkspace.name, 'none')}${currentWorkspace.id ? ` (${currentWorkspace.id})` : ''}`,
      `Current board: ${asString(record.currentBoardId, 'none')}`,
      `Current list: ${asString(record.currentListId, 'none')}`,
      `Current task: ${asString(record.currentTaskId, 'none')}`,
      `Current label: ${asString(record.currentLabelId, 'none')}`,
      `Current project: ${asString(record.currentProjectId, 'none')}`,
      `Default workspace: ${asString(defaultWorkspace.name, 'none')}${defaultWorkspace.id ? ` (${defaultWorkspace.id})` : ''}`,
      `Session: ${asString(record.session, 'none')}`,
    ].join('\n')}\n`
  );
}

export function render(data: unknown, options: RenderOptions = {}) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
    return;
  }

  switch (options.group) {
    case 'workspaces':
      renderWorkspaces(data, options.currentWorkspaceId);
      return;
    case 'boards':
      renderBoards(data);
      return;
    case 'lists':
      renderLists(data);
      return;
    case 'tasks':
      renderTasks(data, options);
      return;
    case 'labels':
      renderLabels(data);
      return;
    case 'projects':
      renderProjects(data);
      return;
    default:
      break;
  }

  if (Array.isArray(data)) {
    renderTable(data.map(asRecord));
    return;
  }

  process.stdout.write(`${inspect(data, { colors: true, depth: 6 })}\n`);
}
