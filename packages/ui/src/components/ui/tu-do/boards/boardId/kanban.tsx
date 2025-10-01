'use client';

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
} from '@dnd-kit/sortable';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@tuturuuu/supabase/next/client';
import type { Workspace } from '@tuturuuu/types/db';
import type { Task } from '@tuturuuu/types/primitives/Task';
import type { TaskList } from '@tuturuuu/types/primitives/TaskList';
import { Badge } from '@tuturuuu/ui/badge';
import { Button } from '@tuturuuu/ui/button';
import { Card, CardContent } from '@tuturuuu/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tuturuuu/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@tuturuuu/ui/dropdown-menu';
import { useHorizontalScroll } from '@tuturuuu/ui/hooks/useHorizontalScroll';
import { toast } from '@tuturuuu/ui/sonner';
import { coordinateGetter } from '@tuturuuu/utils/keyboard-preset';
import { useMoveTask, useMoveTaskToBoard } from '@tuturuuu/utils/task-helper';
import { hasDraggableData } from '@tuturuuu/utils/task-helpers';
import { ArrowRightLeft, Flag, MinusCircle, Tags, Timer } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildEstimationIndices,
  mapEstimationPoints,
} from '../../shared/estimation-mapping';
import { TaskEditDialog } from '../../shared/task-edit-dialog';
import { BoardSelector } from '../board-selector';
import { LightweightTaskCard } from './task';
import { BoardColumn } from './task-list';
import { TaskListForm } from './task-list-form';

// Wrapper for BoardContainer with horizontal scroll functionality
function ScrollableBoardContainer({
  children,
  isDragActive,
}: {
  children: React.ReactNode;
  isDragActive?: () => boolean;
}) {
  const { scrollContainerRef } = useHorizontalScroll({
    enableTouchScroll: true,
    enableMouseWheel: true,
    isDragActive,
  });

  return (
    <div
      ref={scrollContainerRef}
      className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent relative flex h-full w-full gap-4 overflow-x-auto"
    >
      {children}
    </div>
  );
}

interface Props {
  workspace: Workspace;
  boardId: string;
  tasks: Task[];
  lists: TaskList[];
  isLoading: boolean;
}

export function KanbanBoard({
  workspace,
  boardId,
  tasks,
  lists,
  isLoading,
}: Props) {
  const [activeColumn, setActiveColumn] = useState<TaskList | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [hoverTargetListId, setHoverTargetListId] = useState<string | null>(
    null
  );
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [boardSelectorOpen, setBoardSelectorOpen] = useState(false);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [createDialog, setCreateDialog] = useState<{
    open: boolean;
    list: TaskList | null;
  }>({ open: false, list: null });
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const pickedUpTaskColumn = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const moveTaskMutation = useMoveTask(boardId);
  const moveTaskToBoardMutation = useMoveTaskToBoard(boardId);
  const [boardConfig, setBoardConfig] = useState<any>(null);

  const columns: TaskList[] = lists.map((list) => ({
    ...list,
    title: list.name, // Maintain backward compatibility for title property
  }));
  // Ref for the Kanban board container
  const boardRef = useRef<HTMLDivElement>(null);
  const dragStartCardLeft = useRef<number | null>(null);
  const overlayWidth = 350; // Column width

  const handleUpdate = useCallback(() => {
    // Invalidate the tasks query to trigger a refetch
    queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
    queryClient.invalidateQueries({ queryKey: ['task_lists', boardId] });
  }, [queryClient, boardId]);

  // Clean up selectedTasks when tasks are deleted
  useEffect(() => {
    const currentTasks = queryClient.getQueryData(['tasks', boardId]) as
      | Task[]
      | undefined;
    if (currentTasks) {
      const currentTaskIds = new Set(currentTasks.map((task) => task.id));
      setSelectedTasks((prev) => {
        const validSelectedTasks = new Set(
          [...prev].filter((taskId) => currentTaskIds.has(taskId))
        );
        return validSelectedTasks.size !== prev.size
          ? validSelectedTasks
          : prev;
      });
    }
  }, [queryClient, boardId]);

  // Multi-select handlers
  const handleTaskSelect = useCallback(
    (taskId: string, event: React.MouseEvent) => {
      const isCtrlPressed = event.ctrlKey || event.metaKey;
      const isShiftPressed = event.shiftKey;

      if (isCtrlPressed || isShiftPressed) {
        event.preventDefault();
        event.stopPropagation();

        setIsMultiSelectMode(true);

        if (isCtrlPressed) {
          // Toggle selection
          setSelectedTasks((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(taskId)) {
              newSet.delete(taskId);
            } else {
              newSet.add(taskId);
            }
            return newSet;
          });
        } else if (isShiftPressed) {
          // Range selection (if there's a last selected task)
          // For now, just add to selection
          setSelectedTasks((prev) => new Set([...prev, taskId]));
        }
      } else {
        // Single click - clear selection and select only this task
        setSelectedTasks(new Set([taskId]));
        setIsMultiSelectMode(false);
      }
    },
    []
  );

  const clearSelection = useCallback(() => {
    setSelectedTasks(new Set());
    setIsMultiSelectMode(false);
  }, []);

  // Cross-board move handler
  const handleCrossBoardMove = useCallback(() => {
    if (selectedTasks.size > 0) {
      setBoardSelectorOpen(true);
    }
  }, [selectedTasks]);

  // Handle the actual cross-board move
  const handleBoardMove = useCallback(
    async (targetBoardId: string, targetListId: string) => {
      if (selectedTasks.size === 0) return;

      const tasksToMove = Array.from(selectedTasks);

      try {
        console.log('🚀 Starting batch cross-board move');
        console.log('📋 Tasks to move:', tasksToMove);
        console.log('🎯 Target board:', targetBoardId);
        console.log('📋 Target list:', targetListId);

        // Move all selected tasks in parallel for better performance
        const movePromises = tasksToMove.map((taskId) =>
          moveTaskToBoardMutation.mutateAsync({
            taskId,
            newListId: targetListId,
            targetBoardId,
          })
        );

        await Promise.allSettled(movePromises);

        console.log('✅ Batch cross-board move completed');

        // Clear selection and close dialog after moves
        clearSelection();
        setBoardSelectorOpen(false);
      } catch (error) {
        console.error('Failed to move tasks:', error);
        // Don't close the dialog on error so user can retry
      }
    },
    [selectedTasks, moveTaskToBoardMutation, clearSelection]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSelection();
      }

      // Ctrl/Cmd + M to move selected tasks to another board
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'm' &&
        selectedTasks.size > 0
      ) {
        event.preventDefault();
        event.stopPropagation();
        handleCrossBoardMove();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection, handleCrossBoardMove, selectedTasks]);

  const processDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) {
        if ((processDragOver as any).lastTargetListId) {
          (processDragOver as any).lastTargetListId = null;
          setHoverTargetListId(null);
        }
        return;
      }

      const activeType = active.data?.current?.type;
      if (!activeType) return;

      if (activeType === 'Task') {
        const activeTask = active.data?.current?.task;
        if (!activeTask) return;

        let targetListId: string;
        if (over.data?.current?.type === 'Column') {
          targetListId = String(over.id);
        } else if (over.data?.current?.type === 'Task') {
          targetListId = String(over.data.current.task.list_id);
        } else if (over.data?.current?.type === 'ColumnSurface') {
          const columnId = over.data.current.columnId || over.id;
          if (!columnId) return;
          targetListId = String(columnId);
        } else {
          return;
        }

        const originalListId = pickedUpTaskColumn.current;
        if (!originalListId) return;

        const sourceListExists = columns.some(
          (col) => String(col.id) === originalListId
        );
        const targetListExists = columns.some(
          (col) => String(col.id) === targetListId
        );

        if (!sourceListExists || !targetListExists) return;

        // Skip if target list unchanged for current drag set to avoid redundant cache writes
        // Stash lastTargetListId directly on function to skip redundant writes
        if ((processDragOver as any).lastTargetListId === targetListId) {
          if (hoverTargetListId !== targetListId) {
            setHoverTargetListId(targetListId);
          }
          return;
        }
        (processDragOver as any).lastTargetListId = targetListId;
        setHoverTargetListId(targetListId);

        console.log('🔄 onDragOver - hovering list:', targetListId);
      }
    },
    [columns.some, hoverTargetListId]
  );

  // Global drag state reset on mouseup/touchend
  useEffect(() => {
    function handleGlobalPointerUp() {
      setActiveColumn(null);
      setActiveTask(null);
      setHoverTargetListId(null);
      pickedUpTaskColumn.current = null;
      (processDragOver as any).lastTargetListId = null;
    }
    window.addEventListener('mouseup', handleGlobalPointerUp);
    window.addEventListener('touchend', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalPointerUp);
      window.removeEventListener('touchend', handleGlobalPointerUp);
    };
  }, [processDragOver]);

  const columnsId = useMemo(() => columns.map((col) => col.id), [columns]);
  const hoverTargetColumn = useMemo(() => {
    if (!hoverTargetListId) return null;
    return columns.find((col) => String(col.id) === hoverTargetListId) || null;
  }, [columns, hoverTargetListId]);

  // Fetch board config for estimation settings (estimation_type, extended_estimation, allow_zero_estimates)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('workspace_boards')
          .select(
            'id, estimation_type, extended_estimation, allow_zero_estimates'
          )
          .eq('id', boardId)
          .single();
        if (error) throw error;
        if (active) setBoardConfig(data);
      } catch (e) {
        console.error('Failed loading board config for estimation', e);
      }
    })();
    return () => {
      active = false;
    };
  }, [boardId]);

  const estimationOptions = useMemo(() => {
    if (!boardConfig?.estimation_type) return [] as number[];
    // Always build full index list respecting extended flag; disabling for >5 handled in UI.
    return buildEstimationIndices({
      extended: boardConfig.extended_estimation,
      allowZero: boardConfig.allow_zero_estimates,
    });
  }, [
    boardConfig?.estimation_type,
    boardConfig?.extended_estimation,
    boardConfig?.allow_zero_estimates,
  ]);

  // Workspace labels for bulk operations
  const { data: workspaceLabels = [] } = useQuery({
    queryKey: ['workspace_task_labels', workspace.id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workspace_task_labels')
        .select('id, name, color, created_at')
        .eq('ws_id', workspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as {
        id: string;
        name: string;
        color: string;
        created_at: string;
      }[];
    },
    staleTime: 30000,
    enabled: isMultiSelectMode && selectedTasks.size > 0,
  });

  // Bulk helpers -----------------------------------------------------------
  const applyOptimistic = (updater: (t: Task) => Task) => {
    queryClient.setQueryData(['tasks', boardId], (old: Task[] | undefined) => {
      if (!old) return old;
      return old.map((t) => (selectedTasks.has(t.id) ? updater(t) : t));
    });
  };

  async function bulkUpdatePriority(priority: Task['priority'] | null) {
    if (selectedTasks.size === 0) return;
    setBulkWorking(true);
    const supabase = createClient();
    const ids = Array.from(selectedTasks);
    const prev = queryClient.getQueryData(['tasks', boardId]) as
      | Task[]
      | undefined;
    try {
      applyOptimistic((t) => ({ ...t, priority }));
      const { error } = await supabase
        .from('tasks')
        .update({ priority })
        .in('id', ids);
      if (error) throw error;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tasks', boardId] }),
      ]);
    } catch (e) {
      console.error('Bulk priority update failed', e);
      // revert
      if (prev) queryClient.setQueryData(['tasks', boardId], prev);
    } finally {
      setBulkWorking(false);
    }
  }

  async function bulkUpdateEstimation(points: number | null) {
    if (selectedTasks.size === 0) return;
    setBulkWorking(true);
    const supabase = createClient();
    const ids = Array.from(selectedTasks);
    const prev = queryClient.getQueryData(['tasks', boardId]) as
      | Task[]
      | undefined;
    try {
      applyOptimistic((t) => ({ ...t, estimation_points: points }));
      const { error } = await supabase
        .from('tasks')
        .update({ estimation_points: points })
        .in('id', ids);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
    } catch (e) {
      console.error('Bulk estimation update failed', e);
      if (prev) queryClient.setQueryData(['tasks', boardId], prev);
    } finally {
      setBulkWorking(false);
    }
  }

  async function bulkUpdateDueDate(
    preset: 'today' | 'tomorrow' | 'week' | 'clear'
  ) {
    if (selectedTasks.size === 0) return;
    setBulkWorking(true);
    const supabase = createClient();
    const ids = Array.from(selectedTasks);
    const prev = queryClient.getQueryData(['tasks', boardId]) as
      | Task[]
      | undefined;
    try {
      let newDate: string | null = null;
      if (preset !== 'clear') {
        const d = new Date();
        if (preset === 'tomorrow') d.setDate(d.getDate() + 1);
        if (preset === 'week') d.setDate(d.getDate() + 7);
        d.setHours(23, 59, 59, 999);
        newDate = d.toISOString();
      }
      const end_date = newDate;
      applyOptimistic((t) => ({ ...t, end_date }));
      const { error } = await supabase
        .from('tasks')
        .update({ end_date })
        .in('id', ids);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
    } catch (e) {
      console.error('Bulk due date update failed', e);
      if (prev) queryClient.setQueryData(['tasks', boardId], prev);
    } finally {
      setBulkWorking(false);
    }
  }

  function getListIdByStatus(status: 'done' | 'closed') {
    const list = columns.find((c) => c.status === status);
    return list ? String(list.id) : null;
  }

  async function bulkMoveToStatus(status: 'done' | 'closed') {
    if (selectedTasks.size === 0) return;
    const targetListId = getListIdByStatus(status);
    if (!targetListId) return; // silently no-op if list missing
    setBulkWorking(true);
    const supabase = createClient();
    const ids = Array.from(selectedTasks);
    const prev = queryClient.getQueryData(['tasks', boardId]) as
      | Task[]
      | undefined;
    try {
      applyOptimistic((t) => ({ ...t, list_id: targetListId }));
      const { error } = await supabase
        .from('tasks')
        .update({ list_id: targetListId })
        .in('id', ids);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
    } catch (e) {
      console.error('Bulk status move failed', e);
      if (prev) queryClient.setQueryData(['tasks', boardId], prev);
    } finally {
      setBulkWorking(false);
    }
  }

  async function bulkAddLabel(labelId: string) {
    if (selectedTasks.size === 0) return;
    setBulkWorking(true);
    const supabase = createClient();
    const ids = Array.from(selectedTasks);
    const prev = queryClient.getQueryData(['tasks', boardId]) as
      | Task[]
      | undefined;
    try {
      // Pre-compute tasks missing the label to avoid duplicate inserts / conflicts
      const current =
        (queryClient.getQueryData(['tasks', boardId]) as Task[] | undefined) ||
        [];
      const labelMeta = workspaceLabels.find((l) => l.id === labelId);
      const missingTaskIds = ids.filter((id) => {
        const t = current.find((ct) => ct.id === id);
        return !t?.labels?.some((l) => l.id === labelId);
      });

      if (missingTaskIds.length === 0) {
        setBulkWorking(false);
        return; // Nothing to add
      }

      applyOptimistic((t) => {
        if (!missingTaskIds.includes(t.id)) return t;
        return {
          ...t,
          labels: [
            ...(t.labels || []),
            {
              id: labelId,
              name: labelMeta?.name || 'Label',
              color: labelMeta?.color || '#3b82f6',
              created_at: new Date().toISOString(),
            },
          ],
        } as Task;
      });

      const rows = missingTaskIds.map((taskId) => ({
        task_id: taskId,
        label_id: labelId,
      }));
      // Insert ignoring duplicates (Supabase will error on conflict unless policy). We attempt and swallow duplicate errors.
      const { error } = await supabase
        .from('task_labels')
        .insert(rows, { count: 'exact' });
      if (error && !String(error.message).toLowerCase().includes('duplicate'))
        throw error;
      await queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
    } catch (e) {
      console.error('Bulk add label failed', e);
      if (prev) queryClient.setQueryData(['tasks', boardId], prev);
    } finally {
      setBulkWorking(false);
    }
  }

  async function bulkRemoveLabel(labelId: string) {
    if (selectedTasks.size === 0) return;
    setBulkWorking(true);
    const supabase = createClient();
    const ids = Array.from(selectedTasks);
    const prev = queryClient.getQueryData(['tasks', boardId]) as
      | Task[]
      | undefined;
    try {
      applyOptimistic((t) => ({
        ...t,
        labels: (t.labels || []).filter((l) => l.id !== labelId),
      }));
      const { error } = await supabase
        .from('task_labels')
        .delete()
        .in('task_id', ids)
        .eq('label_id', labelId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
    } catch (e) {
      console.error('Bulk remove label failed', e);
      if (prev) queryClient.setQueryData(['tasks', boardId], prev);
    } finally {
      setBulkWorking(false);
    }
  }

  async function bulkDeleteTasks() {
    if (selectedTasks.size === 0) return;
    setBulkWorking(true);
    const supabase = createClient();
    const ids = Array.from(selectedTasks);
    const prev = queryClient.getQueryData(['tasks', boardId]) as
      | Task[]
      | undefined;
    try {
      if (prev) {
        queryClient.setQueryData(
          ['tasks', boardId],
          prev.filter((t) => !ids.includes(t.id))
        );
      }
      const { error } = await supabase.from('tasks').delete().in('id', ids);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['tasks', boardId] });
      clearSelection();
      setBulkDeleteOpen(false);
      toast.success('Deleted selected tasks');
    } catch (e) {
      console.error('Bulk delete failed', e);
      if (prev) queryClient.setQueryData(['tasks', boardId], prev);
      toast.error('Failed to delete selected tasks');
    } finally {
      setBulkWorking(false);
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: coordinateGetter,
    })
  );

  // Capture drag start card left position
  function onDragStart(event: DragStartEvent) {
    if (!hasDraggableData(event.active)) return;
    const { active } = event;
    if (!active.data?.current) return;

    const { type } = active.data.current;
    if (type === 'Column') {
      setActiveColumn(active.data.current.column);
      return;
    }
    if (type === 'Task') {
      const task = active.data.current.task;
      console.log('🎯 onDragStart - Task:', task);
      console.log('📋 Task list_id:', task.list_id);
      console.log('📋 Selected tasks:', selectedTasks);
      console.log('📋 Is multi-select mode:', isMultiSelectMode);

      // If this is a multi-select drag, include all selected tasks
      if (isMultiSelectMode && selectedTasks.has(task.id)) {
        console.log('📋 Multi-select drag detected');
        console.log('📋 Number of selected tasks:', selectedTasks.size);
        setActiveTask(task); // Set the dragged task as active for overlay
      } else {
        setActiveTask(task);
      }

      pickedUpTaskColumn.current = String(task.list_id);
      console.log('📋 pickedUpTaskColumn set to:', pickedUpTaskColumn.current);
      setHoverTargetListId(String(task.list_id));

      // Use more specific selector for better reliability
      // Prefer data-id selector over generic querySelector
      const cardNode = document.querySelector(
        `[data-id="${task.id}"]`
      ) as HTMLElement;
      if (cardNode) {
        const cardRect = cardNode.getBoundingClientRect();
        dragStartCardLeft.current = cardRect.left;
      } else {
        // Fallback: try to find the card by task ID in a more specific way
        const taskCards = document.querySelectorAll('[data-id]');
        const targetCard = Array.from(taskCards).find(
          (card) => card.getAttribute('data-id') === task.id
        ) as HTMLElement;
        if (targetCard) {
          const cardRect = targetCard.getBoundingClientRect();
          dragStartCardLeft.current = cardRect.left;
        }
      }
      return;
    }
  }

  // rAF throttling for onDragOver to reduce cache churn
  const dragOverRaf = useRef<number | null>(null);
  const lastOverArgs = useRef<DragOverEvent | null>(null);

  function onDragOver(event: DragOverEvent) {
    lastOverArgs.current = event;
    if (dragOverRaf.current != null) return; // already queued
    dragOverRaf.current = requestAnimationFrame(() => {
      dragOverRaf.current = null;
      if (lastOverArgs.current) processDragOver(lastOverArgs.current);
    });
  }

  useEffect(() => {
    return () => {
      if (dragOverRaf.current) cancelAnimationFrame(dragOverRaf.current);
    };
  }, []);

  // Memoized DragOverlay content to minimize re-renders
  const MemoizedTaskOverlay = useMemo(() => {
    if (!activeTask) return null;

    // If multi-select mode and multiple tasks selected, show stacked overlay
    if (isMultiSelectMode && selectedTasks.size > 1) {
      return (
        <div className="relative">
          {/* Single card with stacked effect */}
          <div
            className="relative"
            style={{
              transform: 'rotate(-2deg)',
              boxShadow:
                '0 8px 32px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)',
            }}
          >
            <LightweightTaskCard
              task={activeTask}
              destination={hoverTargetColumn}
            />

            {/* Stacked effect layers */}
            <div
              className="-z-10 absolute inset-0 rounded-lg bg-background/80"
              style={{
                transform: 'translateY(4px) translateX(2px) rotate(-1deg)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
              }}
            />
            <div
              className="-z-20 absolute inset-0 rounded-lg bg-background/60"
              style={{
                transform: 'translateY(8px) translateX(4px) rotate(-2deg)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            />
          </div>

          {/* Count badge */}
          <div className="-top-2 -right-2 absolute flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary font-bold text-primary-foreground text-xs shadow-lg">
            {selectedTasks.size}
          </div>
        </div>
      );
    }

    // Single task overlay
    return (
      <LightweightTaskCard task={activeTask} destination={hoverTargetColumn} />
    );
  }, [activeTask, hoverTargetColumn, isMultiSelectMode, selectedTasks]);

  const MemoizedColumnOverlay = useMemo(
    () =>
      activeColumn ? (
        <BoardColumn
          column={activeColumn}
          boardId={boardId}
          tasks={tasks.filter((task) => task.list_id === activeColumn.id)}
          isOverlay
          isPersonalWorkspace={workspace.personal}
          onUpdate={handleUpdate}
        />
      ) : null,
    [activeColumn, tasks, boardId, workspace.personal, handleUpdate]
  );

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    console.log('🔄 onDragEnd triggered');
    console.log('📦 Active:', active);
    console.log('🎯 Over:', over);

    // Store the original list ID before resetting drag state
    const originalListId = pickedUpTaskColumn.current;

    // Always reset drag state, even on invalid drop
    setActiveColumn(null);
    setActiveTask(null);
    setHoverTargetListId(null);
    pickedUpTaskColumn.current = null;
    dragStartCardLeft.current = null;
    (processDragOver as any).lastTargetListId = null;

    if (!over) {
      console.log('❌ No drop target detected, state reset.');
      return;
    }

    const activeType = active.data?.current?.type;
    console.log('🏷️ Active type:', activeType);

    if (!activeType) {
      console.log('❌ No activeType, state reset.');
      return;
    }

    if (activeType === 'Task') {
      const activeTask = active.data?.current?.task;
      console.log('📋 Active task:', activeTask);

      if (!activeTask) {
        console.log('❌ No activeTask, state reset.');
        return;
      }

      let targetListId: string;
      const overType = over.data?.current?.type;
      console.log('🎯 Over type:', overType);

      if (overType === 'Column') {
        targetListId = String(over.id);
        console.log('📋 Dropping on column, targetListId:', targetListId);
      } else if (overType === 'Task') {
        // When dropping on a task, use the list_id of the target task
        const targetTask = over.data?.current?.task;
        if (!targetTask) {
          console.log('❌ No target task data, state reset.');
          return;
        }
        targetListId = String(targetTask.list_id);
        console.log('📋 Dropping on task, targetListId:', targetListId);
        console.log('📋 Target task details:', targetTask);
      } else if (overType === 'ColumnSurface') {
        const columnId = over.data?.current?.columnId || over.id;
        if (!columnId) {
          console.log('❌ No column surface id, state reset.');
          return;
        }
        targetListId = String(columnId);
        console.log(
          '📋 Dropping on column surface, targetListId:',
          targetListId
        );
      } else {
        console.log('❌ Invalid drop type:', overType, 'state reset.');
        return;
      }

      // Use the stored original list ID from drag start
      console.log('🏠 Original list ID (from drag start):', originalListId);
      console.log('🎯 Target list ID:', targetListId);
      console.log(
        '📋 Active task full data:',
        event.active.data?.current?.task
      );

      if (!originalListId) {
        console.log('❌ No originalListId, state reset.');
        return;
      }

      const sourceListExists = columns.some(
        (col) => String(col.id) === originalListId
      );
      const targetListExists = columns.some(
        (col) => String(col.id) === targetListId
      );

      console.log('🔍 Source list exists:', sourceListExists);
      console.log('🔍 Target list exists:', targetListExists);
      console.log(
        '📊 Available columns:',
        columns.map((col) => ({ id: col.id, name: col.name }))
      );
      console.log(
        '📋 Tasks in source list:',
        tasks
          .filter((t) => t.list_id === originalListId)
          .map((t) => ({ id: t.id, name: t.name }))
      );
      console.log(
        '📋 Tasks in target list:',
        tasks
          .filter((t) => t.list_id === targetListId)
          .map((t) => ({ id: t.id, name: t.name }))
      );

      if (!sourceListExists || !targetListExists) {
        console.log('❌ Source or target list missing, state reset.');
        return;
      }

      // Only move if actually changing lists
      if (targetListId !== originalListId) {
        console.log('✅ Lists are different, initiating move mutation');

        // Check if this is a multi-select drag
        if (isMultiSelectMode && selectedTasks.size > 1) {
          console.log(
            '📤 Batch moving tasks:',
            Array.from(selectedTasks),
            'from',
            originalListId,
            'to',
            targetListId
          );

          // Move all selected tasks
          const tasksToMove = Array.from(selectedTasks);
          tasksToMove.forEach((taskId) => {
            moveTaskMutation.mutate({
              taskId,
              newListId: targetListId,
            });
          });

          // Clear selection after batch move
          clearSelection();
        } else {
          console.log(
            '📤 Moving single task:',
            activeTask.id,
            'from',
            originalListId,
            'to',
            targetListId
          );

          moveTaskMutation.mutate({
            taskId: activeTask.id,
            newListId: targetListId,
          });
        }
      } else {
        console.log('ℹ️ Same list detected, no move needed');
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        {/* Loading skeleton for search bar */}
        <Card className="mb-4 border-dynamic-blue/20 bg-dynamic-blue/5">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-md flex-1">
                <div className="h-9 w-full animate-pulse rounded-md bg-dynamic-blue/10"></div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-16 animate-pulse rounded-md bg-dynamic-blue/10"></div>
                <div className="h-8 w-20 animate-pulse rounded-md bg-dynamic-blue/10"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading skeleton for kanban columns */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full gap-4 p-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-full w-[350px] animate-pulse">
                <div className="p-4">
                  <div className="mb-4 h-6 w-32 rounded bg-gray-200"></div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((j) => (
                      <div
                        key={j}
                        className="h-24 w-full rounded bg-gray-100"
                      ></div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Multi-select indicator */}
      {isMultiSelectMode && selectedTasks.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
            <span className="font-medium">
              {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''}{' '}
              selected
            </span>
            <span className="hidden text-muted-foreground sm:inline">
              Drag to move • Ctrl+M board move • Esc clear
            </span>
            {bulkWorking && (
              <Badge
                variant="outline"
                className="animate-pulse border-dynamic-blue/40 text-[10px]"
              >
                Working...
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  disabled={bulkWorking}
                >
                  <Tags className="mr-1 h-3 w-3" /> Bulk
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {boardConfig?.estimation_type && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Timer className="mr-2 h-3.5 w-3.5 text-dynamic-purple" />
                      Estimation
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-48">
                      <DropdownMenuItem
                        disabled={bulkWorking}
                        onClick={() => bulkUpdateEstimation(null)}
                      >
                        Clear
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {estimationOptions.map((p) => {
                        const disabledByExtended =
                          !boardConfig?.extended_estimation && p > 5;
                        return (
                          <DropdownMenuItem
                            key={p}
                            disabled={bulkWorking || disabledByExtended}
                            onClick={() => bulkUpdateEstimation(p)}
                          >
                            {mapEstimationPoints(
                              p,
                              boardConfig?.estimation_type
                            )}
                            {disabledByExtended && (
                              <span className="ml-1 text-[10px] text-muted-foreground/60">
                                (upgrade)
                              </span>
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Flag className="mr-2 h-3.5 w-3.5 text-dynamic-green" />
                    Due Date
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-40">
                    <DropdownMenuItem
                      disabled={bulkWorking}
                      onClick={() => bulkUpdateDueDate('today')}
                    >
                      Today
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={bulkWorking}
                      onClick={() => bulkUpdateDueDate('tomorrow')}
                    >
                      Tomorrow
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={bulkWorking}
                      onClick={() => bulkUpdateDueDate('week')}
                    >
                      In 7 Days
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={bulkWorking}
                      onClick={() => bulkUpdateDueDate('clear')}
                    >
                      Clear
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Flag className="mr-2 h-3.5 w-3.5 text-dynamic-blue" />
                    Status
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-44">
                    <DropdownMenuItem
                      disabled={
                        bulkWorking || !columns.some((c) => c.status === 'done')
                      }
                      onClick={() => bulkMoveToStatus('done')}
                    >
                      Mark Done
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={
                        bulkWorking ||
                        !columns.some((c) => c.status === 'closed')
                      }
                      onClick={() => bulkMoveToStatus('closed')}
                    >
                      Mark Closed
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Flag className="mr-2 h-3.5 w-3.5 text-dynamic-orange" />
                    Priority
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-40">
                    <DropdownMenuItem
                      disabled={bulkWorking}
                      onClick={() => bulkUpdatePriority(null)}
                    >
                      Clear
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={bulkWorking}
                      onClick={() => bulkUpdatePriority('critical')}
                    >
                      Critical
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={bulkWorking}
                      onClick={() => bulkUpdatePriority('high')}
                    >
                      High
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={bulkWorking}
                      onClick={() => bulkUpdatePriority('normal')}
                    >
                      Normal
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={bulkWorking}
                      onClick={() => bulkUpdatePriority('low')}
                    >
                      Low
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Tags className="mr-2 h-3.5 w-3.5 text-dynamic-cyan" />
                    Add Label
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-60 w-52 overflow-auto">
                    {workspaceLabels.length === 0 && (
                      <div className="px-2 py-1 text-[11px] text-muted-foreground">
                        No labels
                      </div>
                    )}
                    {workspaceLabels.map((l) => (
                      <DropdownMenuItem
                        key={l.id}
                        disabled={bulkWorking}
                        onClick={() => bulkAddLabel(l.id)}
                        className="flex items-center gap-2"
                      >
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: l.color, opacity: 0.9 }}
                        />
                        {l.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <MinusCircle className="mr-2 h-3.5 w-3.5 text-dynamic-red" />
                    Remove Label
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-60 w-52 overflow-auto">
                    {workspaceLabels.length === 0 && (
                      <div className="px-2 py-1 text-[11px] text-muted-foreground">
                        No labels
                      </div>
                    )}
                    {workspaceLabels.map((l) => (
                      <DropdownMenuItem
                        key={l.id}
                        disabled={bulkWorking}
                        onClick={() => bulkRemoveLabel(l.id)}
                        className="flex items-center gap-2"
                      >
                        <span
                          className="h-3 w-3 rounded-full ring-1 ring-border"
                          style={{ backgroundColor: l.color, opacity: 0.3 }}
                        />
                        {l.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setBulkDeleteOpen(true)}
                  className="text-dynamic-red focus:text-dynamic-red"
                  disabled={bulkWorking}
                >
                  Delete selected…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCrossBoardMove}
              className="h-6 px-2 text-xs"
              disabled={selectedTasks.size === 0 || bulkWorking}
            >
              <ArrowRightLeft className="mr-1 h-3 w-3" />
              Move
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="h-6 px-2 text-xs"
              disabled={bulkWorking}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.Always,
            },
          }}
          modifiers={[
            (args) => {
              const { transform } = args;
              if (!boardRef.current || dragStartCardLeft.current === null)
                return transform;
              const boardRect = boardRef.current.getBoundingClientRect();
              // Clamp overlay within board
              const minX = boardRect.left - dragStartCardLeft.current;
              const maxX =
                boardRect.right - dragStartCardLeft.current - overlayWidth;
              return {
                ...transform,
                x: Math.max(minX, Math.min(transform.x, maxX)),
              };
            },
          ]}
        >
          <ScrollableBoardContainer
            isDragActive={() => activeColumn !== null || activeTask !== null}
          >
            <SortableContext
              items={columnsId}
              strategy={horizontalListSortingStrategy}
            >
              <div ref={boardRef} className="flex h-full gap-4 p-2 md:px-4">
                {columns
                  .sort((a, b) => {
                    // First sort by status priority, then by position within status
                    const statusOrder = {
                      not_started: 0,
                      active: 1,
                      done: 2,
                      closed: 3,
                    };
                    const statusA =
                      statusOrder[a.status as keyof typeof statusOrder] ?? 999;
                    const statusB =
                      statusOrder[b.status as keyof typeof statusOrder] ?? 999;
                    if (statusA !== statusB) return statusA - statusB;
                    return (a.position || 0) - (b.position || 0);
                  })
                  .map((column) => {
                    const columnTasks = tasks.filter(
                      (task) => task.list_id === column.id
                    );
                    return (
                      <BoardColumn
                        key={column.id}
                        column={column}
                        boardId={boardId}
                        tasks={columnTasks}
                        isPersonalWorkspace={workspace.personal}
                        onUpdate={handleUpdate}
                        onAddTask={(list) =>
                          setCreateDialog({ open: true, list })
                        }
                        selectedTasks={selectedTasks}
                        isMultiSelectMode={isMultiSelectMode}
                        onTaskSelect={handleTaskSelect}
                      />
                    );
                  })}
                <TaskListForm boardId={boardId} onListCreated={handleUpdate} />
              </div>
            </SortableContext>
          </ScrollableBoardContainer>
          <DragOverlay
            wrapperElement="div"
            style={{
              width: 'min(350px, 90vw)',
              maxWidth: '350px',
              pointerEvents: 'none',
            }}
          >
            {MemoizedColumnOverlay}
            {MemoizedTaskOverlay}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Board Selector Dialog */}
      <BoardSelector
        open={boardSelectorOpen}
        onOpenChange={setBoardSelectorOpen}
        wsId={workspace.id}
        currentBoardId={boardId}
        taskCount={selectedTasks.size}
        onMove={handleBoardMove}
        isMoving={moveTaskToBoardMutation.isPending}
      />

      {/* Central Create Task Dialog to avoid clipping/stacking issues */}
      <TaskEditDialog
        task={
          {
            id: 'new',
            name: '',
            description: '',
            priority: null,
            start_date: null,
            end_date: null,
            estimation_points: null,
            list_id: createDialog.list?.id || (columns[0]?.id as any),
            labels: [],
            archived: false,
            assignees: [],
          } as any
        }
        boardId={boardId}
        isOpen={createDialog.open}
        onClose={() => setCreateDialog({ open: false, list: null })}
        onUpdate={handleUpdate}
        availableLists={columns}
        mode="create"
      />

      {/* Bulk delete confirmation */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete selected tasks</DialogTitle>
            <DialogDescription>
              This action cannot be undone. It will permanently remove{' '}
              {selectedTasks.size} selected task
              {selectedTasks.size === 1 ? '' : 's'}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              disabled={bulkWorking}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={bulkDeleteTasks}
              disabled={bulkWorking}
            >
              {bulkWorking ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
