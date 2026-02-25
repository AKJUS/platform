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
import {
  buildRenderUiRecoverySpec,
  isRenderableRenderUiSpec,
} from './mira-tool-render-ui';
import type { MiraToolContext } from './mira-tool-types';

export async function executeMiraTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: MiraToolContext
): Promise<unknown> {
  switch (toolName) {
    case 'select_tools':
      return { ok: true, selectedTools: args.tools };
    case 'no_action_needed':
      return { ok: true };

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

    case 'create_image':
      return executeGenerateImage(args, ctx);

    case 'update_my_settings':
      return executeUpdateMySettings(args, ctx);

    case 'set_default_currency':
      return executeSetDefaultCurrency(args, ctx);

    case 'set_theme':
      return executeSetTheme(args, ctx);

    case 'render_ui':
      if (!isRenderableRenderUiSpec(args)) {
        return {
          spec: buildRenderUiRecoverySpec(args),
          recoveredFromInvalidSpec: true,
          warning:
            'Invalid render_ui spec was auto-recovered because elements was empty or root was missing.',
        };
      }
      return { spec: args };

    case 'list_workspace_members':
      return executeListWorkspaceMembers(args, ctx);

    case 'update_user_name':
      return executeUpdateUserName(args, ctx);

    case 'set_immersive_mode':
      return executeSetImmersiveMode(args, ctx);

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
