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

function asTimestamp(value: unknown) {
  if (typeof value !== 'string' || !value.trim())
    return Number.POSITIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function getNestedRecord(value: unknown, key: string) {
  return asRecord(asRecord(value)[key]);
}

function getTaskListName(task: unknown) {
  const record = asRecord(task);
  return asString(
    getNestedRecord(task, 'task_lists').name,
    asString(record.list_name, asString(record.list_id, 'No list'))
  );
}

function getTaskBoardName(task: unknown) {
  const record = asRecord(task);
  return asString(record.board_name, asString(record.board_id, 'No board'));
}

function getTaskStatus(task: unknown) {
  const record = asRecord(task);
  if (record.closed_at) return 'closed';
  if (record.completed_at || record.completed === true) return 'done';
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

function getTaskPriorityRank(task: unknown) {
  const priority = asString(asRecord(task).priority).toLowerCase();
  const rankByPriority: Record<string, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };

  return rankByPriority[priority] ?? 4;
}

function compareTasksForCli(left: unknown, right: unknown) {
  const priorityDiff = getTaskPriorityRank(left) - getTaskPriorityRank(right);
  if (priorityDiff !== 0) return priorityDiff;

  const dueDiff =
    asTimestamp(asRecord(left).end_date) -
    asTimestamp(asRecord(right).end_date);
  if (dueDiff !== 0) return dueDiff;

  const createdDiff =
    asTimestamp(asRecord(right).created_at) -
    asTimestamp(asRecord(left).created_at);
  if (createdDiff !== 0) return createdDiff;

  return asString(asRecord(left).name).localeCompare(
    asString(asRecord(right).name)
  );
}

export function sortTasksForCli(tasks: unknown[]) {
  return [...tasks].sort(compareTasksForCli);
}

export function sortTaskResponseForCli(data: unknown) {
  const record = asRecord(data);
  const tasks = asArray(record.tasks);
  return tasks.length > 0 ? { ...record, tasks: sortTasksForCli(tasks) } : data;
}

function formatDueDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const startOfDueDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const dayDiff = Math.round(
    (startOfDueDate.getTime() - startOfToday.getTime()) / 86_400_000
  );

  if (dayDiff === -1) return 'Yesterday';
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';

  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

function renderTable(rows: RenderableRecord[]) {
  if (rows.length === 0) {
    process.stdout.write('No results.\n');
    return;
  }

  console.table(
    Object.fromEntries(rows.map((row, index) => [String(index + 1), row]))
  );
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

function getTaskRows(tasks: unknown[]) {
  return sortTasksForCli(tasks).map((task) => {
    const record = asRecord(task);
    return {
      Key: getTaskKey(task),
      Title: asString(record.name, 'Untitled task'),
      List: getTaskListName(task),
      Board: getTaskBoardName(task),
      Status: getTaskStatus(task),
      Priority: asString(record.priority),
      Due: formatDueDate(record.end_date),
    };
  });
}

function renderTasks(data: unknown, options: RenderOptions) {
  const record = asRecord(data);
  const task = record.task;
  const tasks = task ? [task] : asArray(record.tasks);

  if (tasks.length === 0 && record.message) {
    process.stdout.write(`${asString(record.message)}\n`);
    return;
  }

  if (options.compact) {
    renderTable(
      sortTasksForCli(tasks).map((task) => ({
        Title: asString(asRecord(task).name, 'Untitled task'),
        List: getTaskListName(task),
        Workspace: options.workspaceName || options.currentWorkspaceId || '',
      }))
    );
    return;
  }

  renderTable(getTaskRows(tasks));

  const count = record.count;
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
