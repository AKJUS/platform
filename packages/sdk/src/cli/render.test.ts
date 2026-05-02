import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, sortTaskResponseForCli } from './render';

describe('CLI rendering', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders single task mutation responses as task rows', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    render(
      {
        task: {
          board_name: 'Tasks',
          id: 'task-1',
          name: 'Add Tuturuuu CLI',
          priority: 'normal',
          task_lists: { name: 'In Progress' },
        },
      },
      { group: 'tasks' }
    );

    const output = write.mock.calls.map(([value]) => String(value)).join('');
    expect(output).toContain('Tasks');
    expect(output).toContain('task-1');
    expect(output).toContain('In Progress');
    expect(output).toContain('Add Tuturuuu CLI');
  });

  it('falls back to task list and board ids when names are absent', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    render(
      {
        task: {
          board_id: 'board-1',
          id: 'task-1',
          list_id: 'list-1',
          name: 'Add Tuturuuu CLI',
        },
      },
      { group: 'tasks' }
    );

    const output = write.mock.calls.map(([value]) => String(value)).join('');
    expect(output).toContain('board-1');
    expect(output).toContain('list-1');
  });

  it('renders task command success messages without a table', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    render({ message: 'Task deleted.' }, { group: 'tasks' });

    expect(write).toHaveBeenCalledWith('Task deleted.\n');
  });

  it('orders task lists by priority and due date', () => {
    expect(
      sortTaskResponseForCli({
        tasks: [
          {
            id: 'low-overdue',
            name: 'Low overdue',
            priority: 'low',
            end_date: '2026-05-01T00:00:00.000Z',
          },
          {
            id: 'critical-later',
            name: 'Critical later',
            priority: 'critical',
            end_date: '2026-05-10T00:00:00.000Z',
          },
          {
            id: 'critical-sooner',
            name: 'Critical sooner',
            priority: 'critical',
            end_date: '2026-05-03T00:00:00.000Z',
          },
          {
            id: 'normal-undated',
            name: 'Normal undated',
            priority: 'normal',
          },
        ],
      })
    ).toMatchObject({
      tasks: [
        { id: 'critical-sooner' },
        { id: 'critical-later' },
        { id: 'normal-undated' },
        { id: 'low-overdue' },
      ],
    });
  });

  it('formats task due dates for table output', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-03T12:00:00.000+07:00'));
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    render(
      {
        tasks: [
          {
            id: 'task-1',
            name: 'Due tomorrow',
            end_date: '2026-05-04T23:59:59.000+07:00',
          },
          {
            id: 'task-2',
            name: 'Due later',
            end_date: '2026-05-10T00:00:00.000+07:00',
          },
        ],
      },
      { group: 'tasks' }
    );

    const output = write.mock.calls.map(([value]) => String(value)).join('');
    expect(output).toContain('Tomorrow');
    expect(output).toContain('Due tomorrow');
    expect(output).toContain('May 10');
    expect(output).toContain('Due later');
  });

  it('renders configured task list colors in task rows', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    render(
      {
        tasks: [
          {
            id: 'task-1',
            name: 'Colorful list',
            task_lists: { color: 'GREEN', name: 'Done' },
          },
        ],
      },
      { group: 'tasks' }
    );

    const output = write.mock.calls.map(([value]) => String(value)).join('');
    expect(output).toContain('■ Done');
  });

  it('renders configured colors in task list rows', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    render(
      {
        lists: [
          {
            color: 'PURPLE',
            id: 'list-1',
            name: 'Upcoming',
            status: 'active',
          },
        ],
      },
      { group: 'lists' }
    );

    const output = write.mock.calls.map(([value]) => String(value)).join('');
    expect(output).toContain('■ Upcoming');
    expect(output).toContain('■ PURPLE');
  });
});
