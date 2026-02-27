'use client';

import type { QueryClient } from '@tanstack/react-query';
import type { UIMessage } from '@tuturuuu/ai/types';
import { getToolName, isToolUIPart } from 'ai';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useEffect, useRef } from 'react';
import type { MessageFileAttachment } from './file-preview-chips';

interface UseMiraChatEffectsParams {
  isFullscreen?: boolean;
  messageAttachmentsRef: MutableRefObject<Map<string, MessageFileAttachment[]>>;
  messages: UIMessage[];
  onToggleFullscreen?: () => void;
  queryClient: QueryClient;
  routerRefresh: () => void;
  setMessageAttachments: Dispatch<
    SetStateAction<Map<string, MessageFileAttachment[]>>
  >;
  status: string;
}

export function useMiraChatEffects({
  isFullscreen,
  messageAttachmentsRef,
  messages,
  onToggleFullscreen,
  queryClient,
  routerRefresh,
  setMessageAttachments,
  status,
}: UseMiraChatEffectsParams) {
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    const wasBusy = prev === 'submitted' || prev === 'streaming';
    if (wasBusy && status === 'ready') {
      queryClient.invalidateQueries({ queryKey: ['ai-credits'] });
      routerRefresh();
    }
  }, [queryClient, routerRefresh, status]);

  const lastToolHandled = useRef<string | null>(null);
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== 'assistant') continue;
      for (const part of message.parts ?? []) {
        if (!isToolUIPart(part)) continue;
        const toolName = getToolName(part as never);
        const state = (part as { state?: string }).state;
        if (state !== 'output-available') continue;

        const key = `${message.id}-${toolName}`;
        if (lastToolHandled.current === key) continue;

        if (toolName === 'update_my_settings') {
          lastToolHandled.current = key;
          queryClient.invalidateQueries({
            queryKey: ['mira-soul', 'detail'],
          });
        } else if (toolName === 'set_immersive_mode') {
          lastToolHandled.current = key;
          const output = (part as { output?: unknown }).output;
          const enabled = (output as { enabled?: boolean })?.enabled;
          if (typeof enabled === 'boolean' && enabled !== isFullscreen) {
            onToggleFullscreen?.();
          }
        }
      }
    }
  }, [isFullscreen, messages, onToggleFullscreen, queryClient]);

  const prevMessageIdsRef = useRef(new Set<string>());
  useEffect(() => {
    const prevIds = prevMessageIdsRef.current;
    const currentIds = new Set(messages.map((message) => message.id));
    prevMessageIdsRef.current = currentIds;

    for (const message of messages) {
      if (message.role !== 'user') continue;
      if (prevIds.has(message.id)) continue;

      const latestUpload = messageAttachmentsRef.current.get(
        '__latest_user_upload'
      );
      if (!latestUpload?.length) continue;

      setMessageAttachments((prev) => {
        const next = new Map(prev);
        next.set(message.id, latestUpload);
        next.delete('__latest_user_upload');
        next.delete('pending');
        next.delete('queued');
        messageAttachmentsRef.current = next;
        return next;
      });
      break;
    }
  }, [messageAttachmentsRef, messages, setMessageAttachments]);
}
