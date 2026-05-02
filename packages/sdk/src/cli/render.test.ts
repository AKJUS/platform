import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, sortTaskResponseForCli } from './render';

describe('CLI rendering', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders single task mutation responses as task rows', () => {
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});

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

    expect(table).toHaveBeenCalledWith({
      '1': expect.objectContaining({
        Board: 'Tasks',
        Key: 'task-1',
        List: 'In Progress',
        Title: 'Add Tuturuuu CLI',
      }),
    });
  });

  it('falls back to task list and board ids when names are absent', () => {
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});

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

    expect(table).toHaveBeenCalledWith({
      '1': expect.objectContaining({
        Board: 'board-1',
        List: 'list-1',
      }),
    });
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
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});

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

    expect(table).toHaveBeenCalledWith({
      '1': expect.objectContaining({
        Due: 'Tomorrow',
        Title: 'Due tomorrow',
      }),
      '2': expect.objectContaining({
        Due: 'May 10',
        Title: 'Due later',
      }),
    });
  });
});
