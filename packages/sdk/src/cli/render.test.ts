import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from './render';

describe('CLI rendering', () => {
  afterEach(() => {
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
});
