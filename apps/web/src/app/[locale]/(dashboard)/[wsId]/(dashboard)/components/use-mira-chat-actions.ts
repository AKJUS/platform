'use client';

import type { UIMessage } from '@tuturuuu/ai/types';
import { toast } from '@tuturuuu/ui/sonner';
import { generateRandomUUID } from '@tuturuuu/utils/uuid-helper';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';
import { resetGenerativeUIStore } from '@/components/json-render/generative-ui-store';
import type { MessageFileAttachment } from './file-preview-chips';
import { STORAGE_KEY_PREFIX, type ThinkingMode } from './mira-chat-constants';
import { exportMiraChat } from './mira-chat-export';

interface UseMiraChatActionsParams {
  chat?: {
    id?: string | null;
    title?: string | null;
    is_public?: boolean | null;
    model?: string | null;
  };
  chatId: string;
  clearAttachedFiles: () => void;
  fallbackChatId: string;
  gatewayModelId: string;
  messageAttachments: Map<string, MessageFileAttachment[]>;
  messages: UIMessage[];
  model: unknown;
  sendMessageWithCurrentConfig: (message: UIMessage) => void;
  setChat: (
    chat:
      | {
          id: string;
          title?: string;
          is_public: boolean;
          model: string;
        }
      | undefined
  ) => void;
  setFallbackChatId: (value: string) => void;
  setInput: (value: string) => void;
  setMessageAttachments: Dispatch<
    SetStateAction<Map<string, MessageFileAttachment[]>>
  >;
  setPendingPrompt: (value: string | null) => void;
  setStoredChatId: (value: string | null) => void;
  stableChatId: string;
  status: string;
  t: (...args: any[]) => string;
  thinkingMode: ThinkingMode;
  wsId: string;
}

export function useMiraChatActions({
  chat,
  chatId,
  clearAttachedFiles,
  fallbackChatId,
  gatewayModelId,
  messageAttachments,
  messages,
  model,
  sendMessageWithCurrentConfig,
  setChat,
  setFallbackChatId,
  setInput,
  setMessageAttachments,
  setPendingPrompt,
  setStoredChatId,
  stableChatId,
  status,
  t,
  thinkingMode,
  wsId,
}: UseMiraChatActionsParams) {
  const createChat = useCallback(
    async (userInput: string) => {
      setPendingPrompt(userInput);

      try {
        const res = await fetch('/api/ai/chat/new', {
          credentials: 'include',
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: stableChatId,
            model: gatewayModelId,
            message: userInput,
            isMiraMode: true,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            thinkingMode,
          }),
        });

        if (!res.ok) {
          toast.error(t('error'));
          setPendingPrompt(null);
          return;
        }

        const { id, title } = (await res.json()) as {
          id: string;
          title?: string;
        };
        if (!id) {
          console.error('[Mira Chat] Chat creation returned no id', {
            stableChatId,
            gatewayModelId,
          });
          toast.error(t('error'));
          setPendingPrompt(null);
          return;
        }

        setChat({
          id,
          title,
          model: gatewayModelId,
          is_public: false,
        });
        setStoredChatId(id);
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${wsId}`, id);
        sendMessageWithCurrentConfig({
          id: generateRandomUUID(),
          role: 'user',
          parts: [{ type: 'text', text: userInput }],
        });
        setPendingPrompt(null);
      } catch {
        toast.error(t('error'));
        setPendingPrompt(null);
      }
    },
    [
      gatewayModelId,
      sendMessageWithCurrentConfig,
      setChat,
      setPendingPrompt,
      setStoredChatId,
      stableChatId,
      t,
      thinkingMode,
      wsId,
    ]
  );

  const resetConversationState = useCallback(() => {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${wsId}`);
    setChat(undefined);
    setStoredChatId(null);
    setPendingPrompt(null);
    setInput('');
    clearAttachedFiles();
    setMessageAttachments(new Map());
    resetGenerativeUIStore();
    setFallbackChatId(generateRandomUUID());
  }, [
    clearAttachedFiles,
    setChat,
    setFallbackChatId,
    setInput,
    setMessageAttachments,
    setPendingPrompt,
    setStoredChatId,
    wsId,
  ]);

  const handleExportChat = useCallback(() => {
    exportMiraChat({
      chat,
      chatId,
      fallbackChatId,
      messageAttachments,
      messages,
      model,
      status,
      t,
      thinkingMode,
      wsId,
    });
  }, [
    chat,
    chatId,
    fallbackChatId,
    messageAttachments,
    messages,
    model,
    status,
    t,
    thinkingMode,
    wsId,
  ]);

  return {
    createChat,
    handleExportChat,
    resetConversationState,
  };
}
