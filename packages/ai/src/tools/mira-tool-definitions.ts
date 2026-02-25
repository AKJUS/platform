import { calendarToolDefinitions } from './definitions/calendar';
import { financeToolDefinitions } from './definitions/finance';
import { imageToolDefinitions } from './definitions/image';
import { memoryToolDefinitions } from './definitions/memory';
import { metaToolDefinitions } from './definitions/meta';
import { renderUiToolDefinitions } from './definitions/render-ui';
import { taskToolDefinitions } from './definitions/tasks';
import { timeTrackingToolDefinitions } from './definitions/time-tracking';
import { workspaceUserChatToolDefinitions } from './definitions/workspace-user-chat';

export const miraToolDefinitions = {
  ...metaToolDefinitions,
  ...taskToolDefinitions,
  ...calendarToolDefinitions,
  ...financeToolDefinitions,
  ...timeTrackingToolDefinitions,
  ...memoryToolDefinitions,
  ...imageToolDefinitions,
  ...workspaceUserChatToolDefinitions,
  ...renderUiToolDefinitions,
} as const;
