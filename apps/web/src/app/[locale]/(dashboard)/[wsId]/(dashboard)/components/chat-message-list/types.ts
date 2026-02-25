import type { UIMessage } from '@tuturuuu/ai/types';
import type { RefObject } from 'react';
import type { MessageFileAttachment } from '../file-preview-chips';

export interface ChatMessageListProps {
  messages: UIMessage[];
  isStreaming: boolean;
  assistantName?: string;
  userName?: string;
  userAvatarUrl?: string | null;
  onAutoSubmitMermaidFix?: (prompt: string) => void;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  messageAttachments?: Map<string, MessageFileAttachment[]>;
}

export type ToolPartData = { type: string; [key: string]: unknown };

export type JsonObject = Record<string, unknown>;

export type ApprovalRequestUiData = {
  startTime: string;
  endTime: string;
  titleHint?: string | null;
  descriptionHint?: string | null;
};

export type RenderGroup =
  | { kind: 'text'; text: string | unknown; index: number }
  | { kind: 'reasoning'; text: string | unknown; index: number }
  | {
      kind: 'tool';
      toolName: string;
      parts: ToolPartData[];
      startIndex: number;
    }
  | { kind: 'other'; index: number };
