import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTaskActions } from '../use-task-actions';
import type { Task } from '@tuturuuu/types/primitives/Task';
import type { TaskList } from '@tuturuuu/types/primitives/TaskList';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Mock dependencies
vi.mock('@tuturuuu/supabase/next/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn() })) })),
    })),
  })),
}));

vi.mock('@tuturuuu/ui/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@tuturuuu/utils/task-helper', () => ({
  moveTask: vi.fn(),
  useUpdateTask: () => ({
    mutate: vi.fn((_, options) => options?.onSuccess?.()),
    mutateAsync: vi.fn(() => Promise.resolve()),
  }),
  useDeleteTask: () => ({
    mutate: vi.fn((_, options) => options?.onSuccess?.()),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useTaskActions', () => {
  const mockTask: Task = {
    id: 'task-1',
    name: 'Test Task',
    list_id: 'list-1',
    archived: false,
    priority: 'normal',
    estimation_points: null,
    assignees: [],
    labels: [],
    projects: [],
  } as Task;

  const mockCompletionList: TaskList = {
    id: 'completion-list',
    name: 'Done',
    status: 'done',
  } as TaskList;

  const mockClosedList: TaskList = {
    id: 'closed-list',
    name: 'Closed',
    status: 'closed',
  } as TaskList;

  const mockSetIsLoading = vi.fn();
  const mockSetMenuOpen = vi.fn();
  const mockOnUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with correct handlers', () => {
    const { result } = renderHook(
      () =>
        useTaskActions({
          task: mockTask,
          boardId: 'board-1',
          targetCompletionList: mockCompletionList,
          targetClosedList: mockClosedList,
          onUpdate: mockOnUpdate,
          setIsLoading: mockSetIsLoading,
          setMenuOpen: mockSetMenuOpen,
        }),
      { wrapper: createWrapper() }
    );

    expect(result.current.handleArchiveToggle).toBeDefined();
    expect(result.current.handleMoveToCompletion).toBeDefined();
    expect(result.current.handleMoveToClose).toBeDefined();
    expect(result.current.handleDelete).toBeDefined();
    expect(result.current.handleRemoveAllAssignees).toBeDefined();
    expect(result.current.handleRemoveAssignee).toBeDefined();
    expect(result.current.handleMoveToList).toBeDefined();
    expect(result.current.handleDueDateChange).toBeDefined();
    expect(result.current.handlePriorityChange).toBeDefined();
    expect(result.current.updateEstimationPoints).toBeDefined();
    expect(result.current.handleCustomDateChange).toBeDefined();
  });

  it('should handle archive toggle', async () => {
    const { result } = renderHook(
      () =>
        useTaskActions({
          task: mockTask,
          boardId: 'board-1',
          targetCompletionList: mockCompletionList,
          targetClosedList: mockClosedList,
          onUpdate: mockOnUpdate,
          setIsLoading: mockSetIsLoading,
          setMenuOpen: mockSetMenuOpen,
        }),
      { wrapper: createWrapper() }
    );

    await result.current.handleArchiveToggle();

    await waitFor(() => {
      expect(mockSetIsLoading).toHaveBeenCalledWith(true);
    });
  });

  it('should handle priority change', async () => {
    const { result } = renderHook(
      () =>
        useTaskActions({
          task: mockTask,
          boardId: 'board-1',
          targetCompletionList: mockCompletionList,
          targetClosedList: mockClosedList,
          onUpdate: mockOnUpdate,
          setIsLoading: mockSetIsLoading,
          setMenuOpen: mockSetMenuOpen,
        }),
      { wrapper: createWrapper() }
    );

    result.current.handlePriorityChange('high');

    await waitFor(() => {
      expect(mockSetIsLoading).toHaveBeenCalledWith(true);
    });
  });

  it('should not change priority if same as current', () => {
    const { result } = renderHook(
      () =>
        useTaskActions({
          task: mockTask,
          boardId: 'board-1',
          targetCompletionList: mockCompletionList,
          targetClosedList: mockClosedList,
          onUpdate: mockOnUpdate,
          setIsLoading: mockSetIsLoading,
          setMenuOpen: mockSetMenuOpen,
        }),
      { wrapper: createWrapper() }
    );

    result.current.handlePriorityChange('normal');

    expect(mockSetIsLoading).not.toHaveBeenCalled();
  });

  it('should handle due date change', async () => {
    const { result } = renderHook(
      () =>
        useTaskActions({
          task: mockTask,
          boardId: 'board-1',
          targetCompletionList: mockCompletionList,
          targetClosedList: mockClosedList,
          onUpdate: mockOnUpdate,
          setIsLoading: mockSetIsLoading,
          setMenuOpen: mockSetMenuOpen,
        }),
      { wrapper: createWrapper() }
    );

    result.current.handleDueDateChange(7);

    await waitFor(() => {
      expect(mockSetIsLoading).toHaveBeenCalledWith(true);
    });
  });

  it('should handle custom date change with default time', async () => {
    const { result } = renderHook(
      () =>
        useTaskActions({
          task: mockTask,
          boardId: 'board-1',
          targetCompletionList: mockCompletionList,
          targetClosedList: mockClosedList,
          onUpdate: mockOnUpdate,
          setIsLoading: mockSetIsLoading,
          setMenuOpen: mockSetMenuOpen,
        }),
      { wrapper: createWrapper() }
    );

    const testDate = new Date('2024-01-01T00:00:00');
    result.current.handleCustomDateChange(testDate);

    await waitFor(() => {
      expect(mockSetIsLoading).toHaveBeenCalledWith(true);
    });
  });

  it('should handle estimation points update', async () => {
    const { result } = renderHook(
      () =>
        useTaskActions({
          task: mockTask,
          boardId: 'board-1',
          targetCompletionList: mockCompletionList,
          targetClosedList: mockClosedList,
          onUpdate: mockOnUpdate,
          setIsLoading: mockSetIsLoading,
          setMenuOpen: mockSetMenuOpen,
        }),
      { wrapper: createWrapper() }
    );

    await result.current.updateEstimationPoints(5);

    // Should not throw error
    expect(true).toBe(true);
  });

  it('should not update estimation if same as current', async () => {
    const taskWithEstimation = { ...mockTask, estimation_points: 5 };
    const { result } = renderHook(
      () =>
        useTaskActions({
          task: taskWithEstimation,
          boardId: 'board-1',
          targetCompletionList: mockCompletionList,
          targetClosedList: mockClosedList,
          onUpdate: mockOnUpdate,
          setIsLoading: mockSetIsLoading,
          setMenuOpen: mockSetMenuOpen,
        }),
      { wrapper: createWrapper() }
    );

    await result.current.updateEstimationPoints(5);

    expect(mockSetIsLoading).not.toHaveBeenCalled();
  });

  it('should handle move to list with list not found', async () => {
    const { result } = renderHook(
      () =>
        useTaskActions({
          task: mockTask,
          boardId: 'board-1',
          targetCompletionList: mockCompletionList,
          targetClosedList: mockClosedList,
          onUpdate: mockOnUpdate,
          setIsLoading: mockSetIsLoading,
          setMenuOpen: mockSetMenuOpen,
        }),
      { wrapper: createWrapper() }
    );

    await result.current.handleMoveToList('new-list', []);

    await waitFor(() => {
      expect(mockSetIsLoading).toHaveBeenCalled();
    });
  });

  it('should skip move if target list is same as current', async () => {
    const { result } = renderHook(
      () =>
        useTaskActions({
          task: mockTask,
          boardId: 'board-1',
          targetCompletionList: mockCompletionList,
          targetClosedList: mockClosedList,
          onUpdate: mockOnUpdate,
          setIsLoading: mockSetIsLoading,
          setMenuOpen: mockSetMenuOpen,
        }),
      { wrapper: createWrapper() }
    );

    await result.current.handleMoveToList('list-1', []);

    expect(mockSetMenuOpen).toHaveBeenCalledWith(false);
    expect(mockSetIsLoading).not.toHaveBeenCalled();
  });
});
