import type { TypedSupabaseClient } from '@tuturuuu/supabase/next/client';
import type { Tool, ToolSet } from 'ai';
import { z } from 'zod';
import { tool } from './core';
import {
  executeCheckE2EEStatus,
  executeCreateEvent,
  executeDeleteEvent,
  executeEnableE2EE,
  executeGetUpcomingEvents,
  executeUpdateEvent,
} from './executors/calendar';
import { executeSetImmersiveMode } from './executors/chat';
import {
  executeCreateTransactionCategory,
  executeCreateTransactionTag,
  executeCreateWallet,
  executeDeleteTransaction,
  executeDeleteTransactionCategory,
  executeDeleteTransactionTag,
  executeDeleteWallet,
  executeGetSpendingSummary,
  executeGetTransaction,
  executeListTransactionCategories,
  executeListTransactions,
  executeListTransactionTags,
  executeListWallets,
  executeLogTransaction,
  executeSetDefaultCurrency,
  executeUpdateTransaction,
  executeUpdateTransactionCategory,
  executeUpdateTransactionTag,
  executeUpdateWallet,
} from './executors/finance';
import { executeGenerateImage } from './executors/image';
import {
  executeDeleteMemory,
  executeListMemories,
  executeMergeMemories,
  executeRecall,
  executeRemember,
} from './executors/memory';
import { executeUpdateMySettings } from './executors/settings';
import {
  executeAddTaskAssignee,
  executeAddTaskLabels,
  executeAddTaskToProject,
  executeCompleteTask,
  executeCreateBoard,
  executeCreateProject,
  executeCreateTask,
  executeCreateTaskLabel,
  executeCreateTaskList,
  executeDeleteBoard,
  executeDeleteProject,
  executeDeleteTask,
  executeDeleteTaskLabel,
  executeDeleteTaskList,
  executeGetMyTasks,
  executeListBoards,
  executeListProjects,
  executeListTaskLabels,
  executeListTaskLists,
  executeRemoveTaskAssignee,
  executeRemoveTaskFromProject,
  executeRemoveTaskLabels,
  executeUpdateBoard,
  executeUpdateProject,
  executeUpdateTask,
  executeUpdateTaskLabel,
  executeUpdateTaskList,
} from './executors/tasks';
import { executeSetTheme } from './executors/theme';
import {
  executeCreateTimeTrackingEntry,
  executeCreateTimeTrackingRequest,
  executeDeleteTimeTrackingSession,
  executeGetTimeTrackingSession,
  executeListTimeTrackingSessions,
  executeMoveTimeTrackingSession,
  executeStartTimer,
  executeStopTimer,
  executeUpdateTimeTrackingSession,
} from './executors/timer';
import { executeUpdateUserName } from './executors/user';
import { executeListWorkspaceMembers } from './executors/workspace';
// ── Executor imports ──
import { dashboardCatalog } from './json-render-catalog';

// ── Tool Directory (name → one-line description for system prompt) ──

export const MIRA_TOOL_DIRECTORY: Record<string, string> = {
  // Tasks
  get_my_tasks: 'Get your tasks by status (overdue, today, upcoming)',
  create_task: 'Create a new task',
  complete_task: 'Mark a task as completed',
  update_task: 'Update task fields (name, priority, dates, etc.)',
  delete_task: 'Soft-delete a task',
  list_boards: 'List all task boards in the workspace',
  create_board: 'Create a new task board',
  update_board: 'Update a task board name',
  delete_board: 'Delete a task board',
  list_task_lists: 'List columns/lists within a board',
  create_task_list: 'Create a new list in a board',
  update_task_list: 'Update a task list',
  delete_task_list: 'Delete a task list',
  list_task_labels: 'List workspace task labels',
  create_task_label: 'Create a task label',
  update_task_label: 'Update a task label',
  delete_task_label: 'Delete a task label',
  add_task_labels: 'Assign labels to a task',
  remove_task_labels: 'Remove labels from a task',
  list_projects: 'List workspace projects',
  create_project: 'Create a project',
  update_project: 'Update a project',
  delete_project: 'Delete a project',
  add_task_to_project: 'Link a task to a project',
  remove_task_from_project: 'Unlink a task from a project',
  add_task_assignee: 'Assign a user to a task',
  remove_task_assignee: 'Remove a user from a task',
  // Calendar
  get_upcoming_events: 'Get calendar events for the next N days',
  create_event: 'Create a calendar event',
  check_e2ee_status: 'Check E2EE encryption status for calendar',
  enable_e2ee: 'Enable end-to-end encryption for calendar events',
  // Finance
  log_transaction: 'Log an income or expense transaction',
  get_spending_summary: 'Get spending/income summary for N days',
  list_wallets: 'List workspace wallets',
  create_wallet: 'Create a new wallet',
  update_wallet: 'Update wallet details',
  delete_wallet: 'Delete a wallet',
  list_transactions: 'List recent transactions (with filters)',
  get_transaction: 'Get a single transaction by ID',
  update_transaction: 'Update a transaction',
  delete_transaction: 'Delete a transaction',
  list_transaction_categories: 'List transaction categories',
  create_transaction_category: 'Create a transaction category',
  update_transaction_category: 'Update a transaction category',
  delete_transaction_category: 'Delete a transaction category',
  list_transaction_tags: 'List transaction tags',
  create_transaction_tag: 'Create a transaction tag',
  update_transaction_tag: 'Update a transaction tag',
  delete_transaction_tag: 'Delete a transaction tag',
  set_default_currency: 'Set the default currency for the workspace',
  // Time tracking
  start_timer: 'Start a time tracking session',
  stop_timer: 'Stop the running time tracking session',
  list_time_tracking_sessions:
    'List your time tracking history with pagination and filters',
  get_time_tracking_session: 'Get one time tracking session by ID',
  create_time_tracking_entry:
    'Create a stopped/manual time tracking history entry. If approval is required, include imagePaths to submit a request instead.',
  update_time_tracking_session: 'Update a time tracking history session',
  delete_time_tracking_session: 'Delete a time tracking history session',
  move_time_tracking_session:
    'Move a session to another workspace if you are a member of both',
  // Memory
  remember: 'Save a fact/preference about the user',
  recall: 'Search saved memories',
  // Image
  create_image: 'Generate an image from a text description',
  // Self-configuration
  update_my_settings: "Update the assistant's personality settings",
  // Appearance
  set_theme: 'Switch dark mode, light mode, or system theme',
  // Generative UI
  render_ui:
    'Generate an interactive, actionable UI component or widget instead of plain text when it significantly improves user experience (e.g. for forms, dashboards, or data visualization).',
  // Workspace
  list_workspace_members: 'List all members of the workspace',
  // User
  update_user_name: "Update the user's display name or full name",
  // Chat
  set_immersive_mode: 'Enter or exit immersive fullscreen mode for the chat',
  // Meta (always active)
  no_action_needed: 'Conversational message — no tool action required',
};

import type { PermissionId } from '@tuturuuu/types';

export const MIRA_TOOL_PERMISSIONS: Partial<
  Record<string, PermissionId | PermissionId[]>
> = {
  // Tasks
  get_my_tasks: [],
  create_task: 'manage_projects',
  complete_task: 'manage_projects',
  update_task: 'manage_projects',
  delete_task: 'manage_projects',
  list_boards: [],
  create_board: 'manage_projects',
  update_board: 'manage_projects',
  delete_board: 'manage_projects',
  list_task_lists: [],
  create_task_list: 'manage_projects',
  update_task_list: 'manage_projects',
  delete_task_list: 'manage_projects',
  list_task_labels: [],
  create_task_label: 'manage_projects',
  update_task_label: 'manage_projects',
  delete_task_label: 'manage_projects',
  add_task_labels: 'manage_projects',
  remove_task_labels: 'manage_projects',
  list_projects: [],
  create_project: 'manage_projects',
  update_project: 'manage_projects',
  delete_project: 'manage_projects',
  add_task_to_project: 'manage_projects',
  remove_task_from_project: 'manage_projects',
  add_task_assignee: 'manage_projects',
  remove_task_assignee: 'manage_projects',

  // Calendar
  get_upcoming_events: 'manage_calendar',
  create_event: 'manage_calendar',
  check_e2ee_status: 'manage_calendar',
  enable_e2ee: 'manage_calendar',

  // Finance
  log_transaction: 'manage_finance',
  get_spending_summary: 'manage_finance',
  list_wallets: 'manage_finance',
  create_wallet: 'manage_finance',
  update_wallet: 'manage_finance',
  delete_wallet: 'manage_finance',
  list_transactions: 'manage_finance',
  get_transaction: 'manage_finance',
  update_transaction: 'manage_finance',
  delete_transaction: 'manage_finance',
  list_transaction_categories: 'manage_finance',
  create_transaction_category: 'manage_finance',
  update_transaction_category: 'manage_finance',
  delete_transaction_category: 'manage_finance',
  list_transaction_tags: 'manage_finance',
  create_transaction_tag: 'manage_finance',
  update_transaction_tag: 'manage_finance',
  delete_transaction_tag: 'manage_finance',
  set_default_currency: 'manage_finance',

  // Time Tracking
  // (Available to everyone internally or those who have tracking access, skipping strict perm here for now unless needed)

  // Memory
  // Memories are personal to the user mostly, skip strict perm

  // Generative UI & Metadata
  render_ui: [],
  select_tools: [],
  no_action_needed: [],
};

// ── Tool Definitions (schemas only, passed to streamText) ──

export const miraToolDefinitions = {
  // ── Meta: select_tools (step-0 routing tool) ──
  select_tools: tool({
    description:
      'Pick which tools you need for this request. You MUST call this as your FIRST action every turn. Choose from the available tool names listed in the system prompt. For pure conversation, pick no_action_needed.',
    inputSchema: z.object({
      tools: z
        .array(z.string())
        .min(1)
        .describe(
          'Array of tool names to activate (e.g. ["get_my_tasks", "create_task"]). Include all tools you expect to call.'
        ),
    }),
  }),

  // ── Tasks ──
  get_my_tasks: tool({
    description:
      "Get the current user's tasks organized by status. Returns overdue, due today, and upcoming tasks with priority and dates. Use category (or status) with values: all, overdue, today, upcoming.",
    inputSchema: z.object({
      category: z
        .enum(['all', 'overdue', 'today', 'upcoming'])
        .optional()
        .describe(
          'Filter tasks by time category. Use "all" to get everything.'
        ),
      status: z
        .enum(['all', 'overdue', 'today', 'upcoming'])
        .optional()
        .describe('Alias for category. Use either category or status.'),
    }),
  }),

  create_task: tool({
    description:
      "Create a new task in the user's workspace. By default the task is assigned to the current user.",
    inputSchema: z.object({
      name: z.string().describe('Task title'),
      description: z
        .string()
        .nullish()
        .describe('Task description (plain text), or null/omit'),
      priority: z
        .enum(['low', 'normal', 'high', 'critical'])
        .nullish()
        .describe('Task priority level, or null/omit for no priority'),
      assignToSelf: z
        .boolean()
        .optional()
        .describe('Assign to current user. Defaults to true.'),
    }),
  }),

  complete_task: tool({
    description: 'Mark a task as completed by its ID.',
    inputSchema: z.object({
      taskId: z.string().describe('UUID of the task to complete'),
    }),
  }),

  update_task: tool({
    description:
      'Update fields on an existing task. Use taskId (or id) for the task UUID and endDate (or dueDate) for due date (ISO). Only pass fields that need changing.',
    inputSchema: z.object({
      taskId: z.string().optional().describe('UUID of the task'),
      id: z
        .string()
        .optional()
        .describe('Alias for taskId. Use either taskId or id.'),
      name: z.string().optional().describe('New task name'),
      description: z.string().nullable().optional().describe('New description'),
      priority: z
        .enum(['low', 'normal', 'high', 'critical'])
        .nullable()
        .optional()
        .describe('New priority'),
      startDate: z.string().nullable().optional().describe('Start date ISO'),
      endDate: z
        .string()
        .nullable()
        .optional()
        .describe('Due date ISO (use for due date)'),
      dueDate: z
        .string()
        .nullable()
        .optional()
        .describe('Alias for endDate. Use either endDate or dueDate.'),
      estimationPoints: z
        .number()
        .int()
        .min(0)
        .max(7)
        .optional()
        .describe('Estimation point index (0-7)'),
      listId: z.string().optional().describe('Move to a different list'),
    }),
  }),

  delete_task: tool({
    description: 'Soft-delete a task by ID.',
    inputSchema: z.object({
      taskId: z.string().describe('UUID of the task to delete'),
    }),
  }),

  list_boards: tool({
    description: 'List all task boards in the workspace.',
    inputSchema: z.object({}),
  }),

  create_board: tool({
    description: 'Create a new task board.',
    inputSchema: z.object({
      name: z.string().describe('Board name'),
    }),
  }),

  update_board: tool({
    description: 'Update a board name.',
    inputSchema: z.object({
      boardId: z.string().describe('Board UUID'),
      name: z.string().describe('New board name'),
    }),
  }),

  delete_board: tool({
    description: 'Delete a task board.',
    inputSchema: z.object({
      boardId: z.string().describe('Board UUID'),
    }),
  }),

  list_task_lists: tool({
    description: 'List columns/lists within a specific board.',
    inputSchema: z.object({
      boardId: z.string().describe('Board UUID'),
    }),
  }),

  create_task_list: tool({
    description: 'Create a new list/column in a board.',
    inputSchema: z.object({
      boardId: z.string().describe('Board UUID'),
      name: z.string().describe('List name'),
      color: z.string().optional().describe('Color hex code'),
    }),
  }),

  update_task_list: tool({
    description: 'Update a task list.',
    inputSchema: z.object({
      listId: z.string().describe('List UUID'),
      name: z.string().optional().describe('New name'),
      color: z.string().optional().describe('New color'),
      position: z.number().int().optional().describe('New sort position'),
    }),
  }),

  delete_task_list: tool({
    description: 'Delete a task list.',
    inputSchema: z.object({
      listId: z.string().describe('List UUID'),
    }),
  }),

  list_task_labels: tool({
    description: 'List all task labels in the workspace.',
    inputSchema: z.object({}),
  }),

  create_task_label: tool({
    description: 'Create a task label.',
    inputSchema: z.object({
      name: z.string().describe('Label name'),
      color: z.string().optional().describe('Color hex code'),
    }),
  }),

  update_task_label: tool({
    description: 'Update a task label.',
    inputSchema: z.object({
      labelId: z.string().describe('Label UUID'),
      name: z.string().optional().describe('New name'),
      color: z.string().optional().describe('New color'),
    }),
  }),

  delete_task_label: tool({
    description: 'Delete a task label.',
    inputSchema: z.object({
      labelId: z.string().describe('Label UUID'),
    }),
  }),

  add_task_labels: tool({
    description: 'Assign one or more labels to a task.',
    inputSchema: z.object({
      taskId: z.string().describe('Task UUID'),
      labelIds: z.array(z.string()).min(1).describe('Label UUIDs to add'),
    }),
  }),

  remove_task_labels: tool({
    description: 'Remove one or more labels from a task.',
    inputSchema: z.object({
      taskId: z.string().describe('Task UUID'),
      labelIds: z.array(z.string()).min(1).describe('Label UUIDs to remove'),
    }),
  }),

  list_projects: tool({
    description: 'List all projects in the workspace.',
    inputSchema: z.object({}),
  }),

  create_project: tool({
    description: 'Create a new project.',
    inputSchema: z.object({
      name: z.string().describe('Project name'),
      description: z.string().optional().describe('Project description'),
    }),
  }),

  update_project: tool({
    description: 'Update a project.',
    inputSchema: z.object({
      projectId: z.string().describe('Project UUID'),
      name: z.string().optional().describe('New name'),
      description: z.string().optional().describe('New description'),
    }),
  }),

  delete_project: tool({
    description: 'Delete a project.',
    inputSchema: z.object({
      projectId: z.string().describe('Project UUID'),
    }),
  }),

  add_task_to_project: tool({
    description: 'Link a task to a project.',
    inputSchema: z.object({
      taskId: z.string().describe('Task UUID'),
      projectId: z.string().describe('Project UUID'),
    }),
  }),

  remove_task_from_project: tool({
    description: 'Unlink a task from a project.',
    inputSchema: z.object({
      taskId: z.string().describe('Task UUID'),
      projectId: z.string().describe('Project UUID'),
    }),
  }),

  add_task_assignee: tool({
    description:
      'Assign a user to a task. Use list_workspace_members to find user IDs.',
    inputSchema: z.object({
      taskId: z.string().describe('Task UUID'),
      userId: z.string().describe('User UUID to assign'),
    }),
  }),

  remove_task_assignee: tool({
    description: 'Remove a user from a task.',
    inputSchema: z.object({
      taskId: z.string().describe('Task UUID'),
      userId: z.string().describe('User UUID to remove'),
    }),
  }),

  // ── Calendar ──
  get_upcoming_events: tool({
    description:
      'Get upcoming calendar events for the next N days. Events are automatically decrypted if E2EE is enabled.',
    inputSchema: z.object({
      days: z
        .number()
        .int()
        .min(1)
        .max(30)
        .optional()
        .describe('Number of days to look ahead (default: 7)'),
    }),
  }),

  create_event: tool({
    description:
      'Create a new calendar event. Events are automatically encrypted if E2EE is enabled.',
    inputSchema: z.object({
      title: z.string().describe('Event title'),
      startAt: z.string().describe('Start time ISO 8601'),
      endAt: z.string().describe('End time ISO 8601'),
      description: z
        .string()
        .nullish()
        .describe('Event description, or null/omit'),
      location: z.string().nullish().describe('Event location, or null/omit'),
    }),
  }),

  check_e2ee_status: tool({
    description:
      'Check whether end-to-end encryption is enabled for calendar events in this workspace.',
    inputSchema: z.object({}),
  }),

  enable_e2ee: tool({
    description:
      'Enable end-to-end encryption for calendar events. Once enabled, new events will be encrypted automatically.',
    inputSchema: z.object({}),
  }),

  // ── Finance ──
  log_transaction: tool({
    description:
      'Log a financial transaction. Positive amount = income, negative = expense.',
    inputSchema: z.object({
      amount: z.number().describe('Amount (positive=income, negative=expense)'),
      description: z.string().nullish().describe('What was this for?'),
      walletId: z
        .string()
        .nullish()
        .describe('Wallet UUID. If null, uses the first wallet.'),
    }),
  }),

  get_spending_summary: tool({
    description: 'Get income/expense summary for the past N days.',
    inputSchema: z.object({
      days: z
        .number()
        .int()
        .min(1)
        .max(365)
        .optional()
        .describe('Number of past days to summarize (default: 30)'),
    }),
  }),

  list_wallets: tool({
    description: 'List all wallets in the workspace.',
    inputSchema: z.object({}),
  }),

  create_wallet: tool({
    description: 'Create a new wallet.',
    inputSchema: z.object({
      name: z.string().describe('Wallet name'),
      currency: z.string().optional().describe('Currency code (e.g. USD, VND)'),
      balance: z.number().optional().describe('Initial balance'),
      type: z.string().optional().describe('Wallet type'),
    }),
  }),

  update_wallet: tool({
    description: 'Update wallet details.',
    inputSchema: z.object({
      walletId: z.string().describe('Wallet UUID'),
      name: z.string().optional().describe('New name'),
      currency: z.string().optional().describe('New currency'),
      balance: z.number().optional().describe('New balance'),
    }),
  }),

  delete_wallet: tool({
    description: 'Delete a wallet.',
    inputSchema: z.object({
      walletId: z.string().describe('Wallet UUID'),
    }),
  }),

  list_transactions: tool({
    description: 'List transactions with optional filters.',
    inputSchema: z.object({
      walletId: z.string().optional().describe('Filter by wallet UUID'),
      categoryId: z.string().optional().describe('Filter by category UUID'),
      days: z.number().int().optional().describe('Only last N days'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Max results (default 50)'),
    }),
  }),

  get_transaction: tool({
    description: 'Get a single transaction by ID.',
    inputSchema: z.object({
      transactionId: z.string().describe('Transaction UUID'),
    }),
  }),

  update_transaction: tool({
    description: 'Update a transaction.',
    inputSchema: z.object({
      transactionId: z.string().describe('Transaction UUID'),
      amount: z.number().optional().describe('New amount'),
      description: z.string().optional().describe('New description'),
      categoryId: z.string().optional().describe('New category UUID'),
    }),
  }),

  delete_transaction: tool({
    description: 'Delete a transaction.',
    inputSchema: z.object({
      transactionId: z.string().describe('Transaction UUID'),
    }),
  }),

  list_transaction_categories: tool({
    description: 'List all transaction categories.',
    inputSchema: z.object({}),
  }),

  create_transaction_category: tool({
    description: 'Create a transaction category.',
    inputSchema: z.object({
      name: z.string().describe('Category name'),
      isExpense: z
        .boolean()
        .optional()
        .describe('Is this an expense category? Default true.'),
    }),
  }),

  update_transaction_category: tool({
    description: 'Update a transaction category.',
    inputSchema: z.object({
      categoryId: z.string().describe('Category UUID'),
      name: z.string().optional().describe('New name'),
      isExpense: z.boolean().optional().describe('Is expense?'),
    }),
  }),

  delete_transaction_category: tool({
    description: 'Delete a transaction category.',
    inputSchema: z.object({
      categoryId: z.string().describe('Category UUID'),
    }),
  }),

  list_transaction_tags: tool({
    description: 'List all transaction tags.',
    inputSchema: z.object({}),
  }),

  create_transaction_tag: tool({
    description: 'Create a transaction tag.',
    inputSchema: z.object({
      name: z.string().describe('Tag name'),
      color: z.string().optional().describe('Color hex'),
      description: z.string().optional().describe('Tag description'),
    }),
  }),

  update_transaction_tag: tool({
    description: 'Update a transaction tag.',
    inputSchema: z.object({
      tagId: z.string().describe('Tag UUID'),
      name: z.string().optional().describe('New name'),
      color: z.string().optional().describe('New color'),
      description: z.string().optional().describe('New description'),
    }),
  }),

  delete_transaction_tag: tool({
    description: 'Delete a transaction tag.',
    inputSchema: z.object({
      tagId: z.string().describe('Tag UUID'),
    }),
  }),

  // ── Time Tracking ──
  start_timer: tool({
    description:
      'Start a time tracking session. Stops any currently running timer first.',
    inputSchema: z.object({
      title: z.string().describe('What are you working on?'),
      description: z
        .string()
        .nullish()
        .describe('Additional details, or null/omit'),
    }),
  }),

  stop_timer: tool({
    description: 'Stop the currently running time tracking session.',
    inputSchema: z.object({
      sessionId: z
        .string()
        .nullish()
        .describe('Session UUID, or null/omit for active session'),
    }),
  }),

  list_time_tracking_sessions: tool({
    description:
      'List your time tracking sessions with cursor pagination. By default pending approval sessions are excluded.',
    inputSchema: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe('Page size (default 20, max 50)'),
      cursor: z
        .string()
        .optional()
        .describe('Pagination cursor from previous response (start_time|id)'),
      includePending: z
        .boolean()
        .optional()
        .describe('Whether to include pending approval sessions'),
    }),
  }),

  get_time_tracking_session: tool({
    description:
      'Get one specific time tracking session by ID in the current workspace.',
    inputSchema: z.object({
      sessionId: z.string().optional().describe('Session UUID'),
      id: z
        .string()
        .optional()
        .describe('Alias for sessionId. Use either sessionId or id.'),
    }),
  }),

  create_time_tracking_entry: tool({
    description:
      'Create a manual (stopped) time tracking entry. If approval is required and imagePaths are provided, it submits a pending approval request. If approval is required but no imagePaths are provided, it returns requiresApproval=true with guidance.',
    inputSchema: z.object({
      title: z.string().describe('Entry title'),
      description: z
        .string()
        .nullish()
        .describe('Entry description, or null/omit'),
      categoryId: z
        .string()
        .nullish()
        .describe('Time tracking category UUID, or null/omit'),
      taskId: z.string().nullish().describe('Task UUID, or null/omit'),
      startTime: z
        .iso
        .datetime()
        .describe('Start time (ISO 8601, YYYY-MM-DD HH:mm, or HH:mm with date)'),
      endTime: z
        .iso
        .datetime()
        .describe('End time (ISO 8601, YYYY-MM-DD HH:mm, or HH:mm with date)'),
      requestId: z
        .string()
        .uuid()
        .optional()
        .describe(
          'Optional request UUID used for evidence path prefix when approval request is needed'
        ),
      breakTypeId: z
        .string()
        .nullish()
        .describe('Break type UUID, or null/omit'),
      breakTypeName: z
        .string()
        .nullish()
        .describe('Break type name, or null/omit'),
      linkedSessionId: z
        .string()
        .nullish()
        .describe('Linked session UUID, or null/omit'),
      imagePaths: z
        .array(z.string())
        .max(5)
        .optional()
        .describe(
          'Uploaded image storage paths for proof. Required only when approval is needed.'
        ),
    }),
  }),

  create_time_tracking_request: tool({
    description:
      'Deprecated compatibility alias. Prefer create_time_tracking_entry with imagePaths for approval-required entries.',
    inputSchema: z.object({
      requestId: z
        .uuid()
        .optional()
        .describe('Optional request UUID, generated if omitted'),
      title: z.string().describe('Request title'),
      description: z
        .string()
        .nullish()
        .describe('Request description, or null/omit'),
      categoryId: z.string().nullish().describe('Category UUID, or null/omit'),
      taskId: z.string().nullish().describe('Task UUID, or null/omit'),
      date: z
        .string()
        .optional()
        .describe('Optional base date (YYYY-MM-DD) when using HH:mm time inputs'),
      startTime: z
        .iso
        .datetime()
        .describe('Start time (ISO 8601, YYYY-MM-DD HH:mm, or HH:mm with date)'),
      endTime: z
        .iso
        .datetime()
        .describe('End time (ISO 8601, YYYY-MM-DD HH:mm, or HH:mm with date)'),
      breakTypeId: z
        .string()
        .nullish()
        .describe('Break type UUID, or null/omit'),
      breakTypeName: z
        .string() 
        .nullish()
        .describe('Break type name, or null/omit'),
      linkedSessionId: z
        .string()
        .nullish()
        .describe('Linked session UUID, or null/omit'),
      imagePaths: z
        .array(z.string())
        .max(5)
        .describe('Uploaded image storage paths for proof'),
    }),
  }),

  update_time_tracking_session: tool({
    description:
      'Update fields of an existing time tracking session. Recomputes duration when times change.',
    inputSchema: z.object({
      sessionId: z.string().optional().describe('Session UUID'),
      id: z
        .string()
        .optional()
        .describe('Alias for sessionId. Use either sessionId or id.'),
      title: z.string().optional().describe('Updated title'),
      description: z
        .string()
        .nullable()
        .optional()
        .describe('Updated description'),
      categoryId: z
        .string()
        .nullable()
        .optional()
        .describe('Updated category UUID'),
      taskId: z.string().nullable().optional().describe('Updated task UUID'),
      startTime: z
        .iso
        .datetime()
        .optional()
        .describe(
          'Updated start time (ISO 8601, YYYY-MM-DD HH:mm, or HH:mm with date)'
        ),
      endTime: z
        .iso
        .datetime()
        .optional()
        .describe(
          'Updated end time (ISO 8601, YYYY-MM-DD HH:mm, or HH:mm with date)'
        ),
    }),
  }),

  delete_time_tracking_session: tool({
    description: 'Delete a time tracking session by ID.',
    inputSchema: z.object({
      sessionId: z.string().optional().describe('Session UUID'),
      id: z
        .string()
        .optional()
        .describe('Alias for sessionId. Use either sessionId or id.'),
    }),
  }),

  move_time_tracking_session: tool({
    description:
      'Move a stopped session to another workspace after membership checks, with category/task remapping by name.',
    inputSchema: z.object({
      sessionId: z.string().optional().describe('Session UUID'),
      id: z
        .string()
        .optional()
        .describe('Alias for sessionId. Use either sessionId or id.'),
      targetWorkspaceId: z.string().describe('Destination workspace UUID'),
    }),
  }),

  // ── Memory ──
  remember: tool({
    description:
      'Save a memory or fact about the user. Store rich, contextual values. For people use key format person_<name>.',
    inputSchema: z.object({
      key: z
        .string()
        .describe('Short label (e.g. "user_birthday", "person_quoc")'),
      value: z.string().describe('Detailed contextual content to remember'),
      category: z
        .enum(['preference', 'fact', 'conversation_topic', 'event', 'person'])
        .describe('Memory category'),
    }),
  }),

  recall: tool({
    description:
      'Search saved memories. Pass null query with high maxResults for "everything" requests.',
    inputSchema: z.object({
      query: z
        .string()
        .nullish()
        .describe('Search keywords, or null/omit for all'),
      category: z
        .enum(['preference', 'fact', 'conversation_topic', 'event', 'person'])
        .nullish()
        .describe('Filter by category, or null/omit'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe(
          'Max results (default: 10, use 20-50 for broad queries, 5-10 for specific)'
        ),
    }),
  }),

  delete_memory: tool({
    description: 'Delete a single memory by its exact key.',
    inputSchema: z.object({
      key: z.string().describe('The exact key of the memory to delete'),
    }),
  }),

  list_memories: tool({
    description:
      'List all stored memories, optionally filtered by category. Used for memory hygiene and review.',
    inputSchema: z.object({
      category: z
        .enum(['preference', 'fact', 'conversation_topic', 'event', 'person'])
        .nullish()
        .describe('Category to filter memories by'),
    }),
  }),

  merge_memories: tool({
    description:
      'Consolidate multiple existing memories into a single new memory. The old memories will be deleted.',
    inputSchema: z.object({
      keysToDelete: z
        .array(z.string())
        .describe('Array of exact keys to delete'),
      newKey: z.string().describe('The key for the new consolidated memory'),
      newValue: z
        .string()
        .describe('The value for the new consolidated memory'),
      newCategory: z
        .enum(['preference', 'fact', 'conversation_topic', 'event', 'person'])
        .describe('Category for the new memory'),
    }),
  }),

  // ── Image Generation ──
  create_image: tool({
    description: 'Generate an image from a text description.',
    inputSchema: z.object({
      prompt: z.string().describe('Detailed image description'),
      aspectRatio: z
        .enum(['1:1', '3:4', '4:3', '9:16', '16:9'])
        .optional()
        .describe('Aspect ratio (default 1:1)'),
      model: z
        .enum([
          'google/imagen-4.0-fast-generate-001',
          'google/imagen-4.0-generate-001',
          'google/gemini-2.5-flash-image',
        ])
        .optional()
        .describe('Image model (auto-selected by plan if omitted)'),
    }),
  }),

  // ── Self-Configuration ──
  update_my_settings: tool({
    description:
      "Update YOUR OWN (the assistant's) personality. The `name` field is YOUR name, not the user's. Use `remember` for user's name.",
    inputSchema: z.object({
      name: z.string().max(50).nullish().describe('New assistant name'),
      tone: z
        .enum([
          'balanced',
          'casual',
          'formal',
          'friendly',
          'playful',
          'professional',
          'warm',
        ])
        .nullish()
        .describe('Communication tone'),
      personality: z
        .string()
        .max(2000)
        .nullish()
        .describe('Personality description / behavioral preferences'),
      boundaries: z.string().max(2000).nullish().describe('Custom boundaries'),
      vibe: z
        .enum([
          'calm',
          'energetic',
          'friendly',
          'neutral',
          'playful',
          'warm',
          'witty',
        ])
        .nullish()
        .describe('Energy/vibe'),
      chat_tone: z
        .enum(['thorough', 'concise', 'detailed', 'brief'])
        .nullish()
        .describe('Response verbosity'),
    }),
  }),

  // ── Finance Settings ──
  set_default_currency: tool({
    description:
      'Set the default currency for the workspace. Use standard currency codes.',
    inputSchema: z.object({
      currency: z
        .string()
        .describe(
          'Currency code (e.g. USD, VND, EUR, JPY, GBP, KRW, THB, SGD)'
        ),
    }),
  }),

  // ── Appearance ──
  set_theme: tool({
    description:
      'Switch the UI theme. Use when user asks for dark mode, light mode, or system theme.',
    inputSchema: z.object({
      theme: z.enum(['light', 'dark', 'system']).describe('Theme to apply'),
    }),
  }),

  // ── Generative UI (json-render) ──
  render_ui: tool({
    description:
      'Generate an interactive, actionable UI component or widget using json-render instead of plain text. Use this when the user asks for a dashboard, a form, or whenever a beautifully rendered visual response would complement and significantly improve the user experience (e.g. for status summaries, lists, or visualizations). You MUST output a JSON object matching the schema exactly.',
    inputSchema: dashboardCatalog.zodSchema(),
  }),

  // ── Workspace ──
  list_workspace_members: tool({
    description: 'List all members of the current workspace with their roles.',
    inputSchema: z.object({}),
  }),

  // ── User ──
  update_user_name: tool({
    description: "Update the user's display name or full name.",
    inputSchema: z.object({
      displayName: z.string().nullish().describe('New display name'),
      fullName: z.string().nullish().describe('New full name'),
    }),
  }),

  // ── Chat ──
  set_immersive_mode: tool({
    description:
      'Enter or exit immersive fullscreen mode for the current chat.',
    inputSchema: z.object({
      enabled: z.boolean().describe('Whether to enable immersive mode'),
    }),
  }),

  // ── Escape-hatch ──
  no_action_needed: tool({
    description:
      'Call when the message is purely conversational and requires NO real action.',
    inputSchema: z.object({
      reason: z.string().describe('Brief reason (e.g. "user said thanks")'),
    }),
  }),
} as const;

// ── Types ──

export type MiraToolContext = {
  userId: string;
  wsId: string;
  supabase: TypedSupabaseClient;
  timezone?: string;
};

export type MiraToolName = keyof typeof miraToolDefinitions;

// ── Stream Tools Factory ──

export function createMiraStreamTools(
  ctx: MiraToolContext,
  withoutPermission?: (p: PermissionId) => boolean
): ToolSet {
  const tools: ToolSet = {};
  for (const [name, def] of Object.entries(miraToolDefinitions)) {
    // Check permissions
    const requiredPerm = MIRA_TOOL_PERMISSIONS[name];
    let isMissingPermission = false;
    let missingPermissionsStr = '';

    if (requiredPerm && withoutPermission) {
      if (Array.isArray(requiredPerm)) {
        const missing = requiredPerm.filter((p) => withoutPermission(p));
        if (missing.length > 0) {
          isMissingPermission = true;
          missingPermissionsStr = missing.join(', ');
        }
      } else {
        if (withoutPermission(requiredPerm)) {
          isMissingPermission = true;
          missingPermissionsStr = requiredPerm;
        }
      }
    }

    if (isMissingPermission) {
      tools[name] = {
        ...def,
        execute: async () => ({
          ok: false,
          error: `You do not have the required permissions to use this tool. Missing permission(s): ${missingPermissionsStr}. Please inform the user.`,
        }),
      } as Tool;
    } else {
      tools[name] = {
        ...def,
        execute: async (args: Record<string, unknown>) =>
          executeMiraTool(name, args, ctx),
      } as Tool;
    }
  }
  return tools;
}

// ── Tool Dispatcher ──

export async function executeMiraTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: MiraToolContext
): Promise<unknown> {
  switch (toolName) {
    // Meta
    case 'select_tools':
      return { ok: true, selectedTools: args.tools };
    case 'no_action_needed':
      return { ok: true };

    // Tasks
    case 'get_my_tasks':
      return executeGetMyTasks(args, ctx);
    case 'create_task':
      return executeCreateTask(args, ctx);
    case 'complete_task':
      return executeCompleteTask(args, ctx);
    case 'update_task':
      return executeUpdateTask(args, ctx);
    case 'delete_task':
      return executeDeleteTask(args, ctx);
    case 'list_boards':
      return executeListBoards(args, ctx);
    case 'create_board':
      return executeCreateBoard(args, ctx);
    case 'update_board':
      return executeUpdateBoard(args, ctx);
    case 'delete_board':
      return executeDeleteBoard(args, ctx);
    case 'list_task_lists':
      return executeListTaskLists(args, ctx);
    case 'create_task_list':
      return executeCreateTaskList(args, ctx);
    case 'update_task_list':
      return executeUpdateTaskList(args, ctx);
    case 'delete_task_list':
      return executeDeleteTaskList(args, ctx);
    case 'list_task_labels':
      return executeListTaskLabels(args, ctx);
    case 'create_task_label':
      return executeCreateTaskLabel(args, ctx);
    case 'update_task_label':
      return executeUpdateTaskLabel(args, ctx);
    case 'delete_task_label':
      return executeDeleteTaskLabel(args, ctx);
    case 'add_task_labels':
      return executeAddTaskLabels(args, ctx);
    case 'remove_task_labels':
      return executeRemoveTaskLabels(args, ctx);
    case 'list_projects':
      return executeListProjects(args, ctx);
    case 'create_project':
      return executeCreateProject(args, ctx);
    case 'update_project':
      return executeUpdateProject(args, ctx);
    case 'delete_project':
      return executeDeleteProject(args, ctx);
    case 'add_task_to_project':
      return executeAddTaskToProject(args, ctx);
    case 'remove_task_from_project':
      return executeRemoveTaskFromProject(args, ctx);
    case 'add_task_assignee':
      return executeAddTaskAssignee(args, ctx);
    case 'remove_task_assignee':
      return executeRemoveTaskAssignee(args, ctx);

    // Calendar
    case 'get_upcoming_events':
      return executeGetUpcomingEvents(args, ctx);
    case 'create_event':
      return executeCreateEvent(args, ctx);
    case 'update_event':
      return executeUpdateEvent(args, ctx);
    case 'delete_event':
      return executeDeleteEvent(args, ctx);
    case 'check_e2ee_status':
      return executeCheckE2EEStatus(args, ctx);
    case 'enable_e2ee':
      return executeEnableE2EE(args, ctx);

    // Finance
    case 'log_transaction':
      return executeLogTransaction(args, ctx);
    case 'get_spending_summary':
      return executeGetSpendingSummary(args, ctx);
    case 'list_wallets':
      return executeListWallets(args, ctx);
    case 'create_wallet':
      return executeCreateWallet(args, ctx);
    case 'update_wallet':
      return executeUpdateWallet(args, ctx);
    case 'delete_wallet':
      return executeDeleteWallet(args, ctx);
    case 'list_transactions':
      return executeListTransactions(args, ctx);
    case 'get_transaction':
      return executeGetTransaction(args, ctx);
    case 'update_transaction':
      return executeUpdateTransaction(args, ctx);
    case 'delete_transaction':
      return executeDeleteTransaction(args, ctx);
    case 'list_transaction_categories':
      return executeListTransactionCategories(args, ctx);
    case 'create_transaction_category':
      return executeCreateTransactionCategory(args, ctx);
    case 'update_transaction_category':
      return executeUpdateTransactionCategory(args, ctx);
    case 'delete_transaction_category':
      return executeDeleteTransactionCategory(args, ctx);
    case 'list_transaction_tags':
      return executeListTransactionTags(args, ctx);
    case 'create_transaction_tag':
      return executeCreateTransactionTag(args, ctx);
    case 'update_transaction_tag':
      return executeUpdateTransactionTag(args, ctx);
    case 'delete_transaction_tag':
      return executeDeleteTransactionTag(args, ctx);

    // Time tracking
    case 'start_timer':
      return executeStartTimer(args, ctx);
    case 'stop_timer':
      return executeStopTimer(args, ctx);
    case 'list_time_tracking_sessions':
      return executeListTimeTrackingSessions(args, ctx);
    case 'get_time_tracking_session':
      return executeGetTimeTrackingSession(args, ctx);
    case 'create_time_tracking_entry':
      return executeCreateTimeTrackingEntry(args, ctx);
    case 'create_time_tracking_request':
      return executeCreateTimeTrackingRequest(args, ctx);
    case 'update_time_tracking_session':
      return executeUpdateTimeTrackingSession(args, ctx);
    case 'delete_time_tracking_session':
      return executeDeleteTimeTrackingSession(args, ctx);
    case 'move_time_tracking_session':
      return executeMoveTimeTrackingSession(args, ctx);

    // Memory
    case 'remember':
      return executeRemember(args, ctx);
    case 'recall':
      return executeRecall(args, ctx);
    case 'list_memories':
      return executeListMemories(args, ctx);
    case 'delete_memory':
      return executeDeleteMemory(args, ctx);
    case 'merge_memories':
      return executeMergeMemories(args, ctx);

    // Image
    case 'create_image':
      return executeGenerateImage(args, ctx);

    // Self-configuration
    case 'update_my_settings':
      return executeUpdateMySettings(args, ctx);

    // Finance Settings
    case 'set_default_currency':
      return executeSetDefaultCurrency(args, ctx);

    // Appearance
    case 'set_theme':
      return executeSetTheme(args, ctx);

    // Generative UI
    case 'render_ui':
      // The model generates the UI spec according to the json-render catalog.
      // We return it as is, so the client can render it natively.
      return { spec: args };

    // Workspace
    case 'list_workspace_members':
      return executeListWorkspaceMembers(args, ctx);

    // User
    case 'update_user_name':
      return executeUpdateUserName(args, ctx);

    // Chat
    case 'set_immersive_mode':
      return executeSetImmersiveMode(args, ctx);

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
