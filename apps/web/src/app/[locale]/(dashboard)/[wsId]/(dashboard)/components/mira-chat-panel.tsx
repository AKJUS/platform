'use client';

import { useQueryClient } from '@tanstack/react-query';
import { DefaultChatTransport } from '@tuturuuu/ai/core';
import {
  defaultModel,
  getGatewayModelId,
  type Model,
} from '@tuturuuu/ai/models';
import { useChat } from '@tuturuuu/ai/react';
import type { UIMessage } from '@tuturuuu/ai/types';
import {
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  Sparkles,
} from '@tuturuuu/icons';
import { createClient } from '@tuturuuu/supabase/next/client';
import type { AIChat } from '@tuturuuu/types';
import { Button } from '@tuturuuu/ui/button';
import { toast } from '@tuturuuu/ui/sonner';
import { generateRandomUUID } from '@tuturuuu/utils/uuid-helper';
import { getToolName, isToolUIPart } from 'ai';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChatInputBar from './chat-input-bar';
import ChatMessageList from './chat-message-list';
import MiraCreditBar from './mira-credit-bar';
import MiraModelSelector from './mira-model-selector';
import QuickActionChips from './quick-action-chips';

interface MiraChatPanelProps {
  wsId: string;
  assistantName: string;
  userAvatarUrl?: string | null;
  onVoiceToggle?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const STORAGE_KEY_PREFIX = 'mira-dashboard-chat-';
const INITIAL_MODEL = defaultModel!;

/** Debounce window for message queueing (ms). Messages sent within this window
 *  after the last one are batched into a single user turn. */
const QUEUE_DEBOUNCE_MS = 500;

export default function MiraChatPanel({
  wsId,
  assistantName,
  userAvatarUrl,
  onVoiceToggle,
  isFullscreen,
  onToggleFullscreen,
}: MiraChatPanelProps) {
  const t = useTranslations('dashboard.mira_chat');
  const [chat, setChat] = useState<Partial<AIChat> | undefined>();
  const [model, setModel] = useState<Model>(INITIAL_MODEL);
  const [input, setInput] = useState('');
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Message queue for debounced batching ──
  const messageQueueRef = useRef<string[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [queuedText, setQueuedText] = useState<string | null>(null);

  // Ref to always hold the latest sendMessage (avoids stale closures in callbacks)
  const sendMessageRef = useRef<typeof sendMessage>(null!);

  // Generate a stable chat ID so useChat's internal Chat instance is never
  // recreated due to id: undefined → auto-generated UUID mismatch.
  // Regenerated when the user starts a new conversation.
  const [fallbackChatId, setFallbackChatId] = useState(generateRandomUUID);

  const gatewayModelId = useMemo(
    () => getGatewayModelId(model.value, model.provider),
    [model]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/chat',
        credentials: 'include',
        body: {
          wsId,
          model: gatewayModelId,
          isMiraMode: true,
        },
      }),
    [wsId, gatewayModelId]
  );

  // Use the server-assigned chat ID when available, otherwise use the stable
  // fallback. This prevents useChat from recreating its internal Chat instance
  // on every render (which would discard streamed messages).
  const stableChatId = chat?.id ?? fallbackChatId;

  const queryClient = useQueryClient();

  const {
    id: chatId,
    messages,
    sendMessage,
    status,
  } = useChat({
    id: stableChatId,
    generateId: generateRandomUUID,
    messages: initialMessages,
    transport,
    onError(error) {
      console.error('[Mira Chat] Stream error:', error);
      toast.error(error?.message || t('error'));
    },
  });

  // Keep ref in sync so callbacks always use the latest sendMessage
  sendMessageRef.current = sendMessage;

  // Invalidate the mira-soul query when Mira updates its own settings via tool.
  // This ensures the UI (name in header, placeholder, etc.) refreshes immediately.
  const lastSettingsInvalidation = useRef<string | null>(null);
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts ?? []) {
        if (
          isToolUIPart(part) &&
          getToolName(part as never) === 'update_my_settings' &&
          (part as { state?: string }).state === 'output-available'
        ) {
          // Deduplicate: only invalidate once per unique tool result
          const key = `${msg.id}-update_my_settings`;
          if (lastSettingsInvalidation.current !== key) {
            lastSettingsInvalidation.current = key;
            queryClient.invalidateQueries({
              queryKey: ['mira-soul', 'detail'],
            });
          }
        }
      }
    }
  }, [messages, queryClient]);

  // Load existing chat from localStorage on mount
  useEffect(() => {
    if (initialLoaded) return;

    const loadExistingChat = async () => {
      const storedChatId = localStorage.getItem(`${STORAGE_KEY_PREFIX}${wsId}`);
      if (!storedChatId) {
        setInitialLoaded(true);
        return;
      }

      try {
        const supabase = await createClient();
        const { data: chatData } = await supabase
          .from('ai_chats')
          .select('id, title, model, is_public')
          .eq('id', storedChatId)
          .maybeSingle();

        if (!chatData) {
          localStorage.removeItem(`${STORAGE_KEY_PREFIX}${wsId}`);
          setInitialLoaded(true);
          return;
        }

        // Load messages (include metadata for tool call reconstruction)
        const { data: messagesData } = await supabase
          .from('ai_chat_messages')
          .select('id, role, content, metadata')
          .eq('chat_id', storedChatId)
          .order('created_at', { ascending: true });

        if (messagesData?.length) {
          const uiMessages: UIMessage[] = messagesData
            .filter(
              (msg) =>
                msg.content != null ||
                (msg.metadata as Record<string, unknown>)?.toolCalls
            )
            .map((msg) => {
              const parts: UIMessage['parts'] = [];
              const meta = msg.metadata as Record<string, unknown> | null;

              // Add text part if content exists
              if (msg.content) {
                parts.push({ type: 'text' as const, text: msg.content });
              }

              // Reconstruct tool parts from metadata saved by onFinish.
              // AI SDK v6 serializes tool calls as { toolCallId, toolName, input }
              // and tool results as { toolCallId, toolName, input, output }.
              const toolCalls = meta?.toolCalls as
                | Array<{
                    toolCallId: string;
                    toolName: string;
                    input?: unknown;
                    args?: unknown; // legacy fallback
                  }>
                | undefined;
              const toolResults = meta?.toolResults as
                | Array<{
                    toolCallId: string;
                    output?: unknown;
                    result?: unknown; // legacy fallback
                  }>
                | undefined;

              if (Array.isArray(toolCalls)) {
                for (const tc of toolCalls) {
                  const tr = toolResults?.find(
                    (r) => r.toolCallId === tc.toolCallId
                  );
                  // Use DynamicToolUIPart format (type: 'dynamic-tool')
                  // since we don't know the TOOLS generic at restore time
                  parts.push({
                    type: 'dynamic-tool' as const,
                    toolName: tc.toolName,
                    toolCallId: tc.toolCallId,
                    state: 'output-available' as const,
                    input: tc.input ?? tc.args ?? {},
                    output: tr?.output ?? tr?.result ?? null,
                  });
                }
              }

              return {
                id: msg.id,
                role: msg.role.toLowerCase() as 'user' | 'assistant',
                parts,
              };
            });
          setInitialMessages(uiMessages);
        }

        setChat(chatData);
      } catch {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${wsId}`);
      } finally {
        setInitialLoaded(true);
      }
    };

    loadExistingChat();
  }, [wsId, initialLoaded]);

  // Create a new chat on first message, then send directly via ref
  // (avoids effect-based indirection that could drop the first message)
  const createChat = useCallback(
    async (userInput: string) => {
      setPendingPrompt(userInput);

      try {
        const res = await fetch('/api/ai/chat/new', {
          credentials: 'include',
          method: 'POST',
          body: JSON.stringify({
            id: chatId,
            model: gatewayModelId,
            message: userInput,
            isMiraMode: true,
          }),
        });

        if (!res.ok) {
          toast.error(t('error'));
          setPendingPrompt(null);
          return;
        }

        const { id, title } = (await res.json()) as AIChat;
        if (id) {
          setChat({
            id,
            title,
            model: gatewayModelId,
            is_public: false,
          });
          localStorage.setItem(`${STORAGE_KEY_PREFIX}${wsId}`, id);

          // Send message directly via ref — bypasses stale closure issues
          sendMessageRef.current({
            role: 'user',
            parts: [{ type: 'text', text: userInput }],
          });
          setPendingPrompt(null);
        }
      } catch {
        toast.error(t('error'));
        setPendingPrompt(null);
      }
    },
    [chatId, wsId, t, gatewayModelId]
  );

  // Flush queued messages: deduplicate, combine, send as one user turn.
  const flushQueue = useCallback(() => {
    const queue = [...messageQueueRef.current];
    messageQueueRef.current = [];
    debounceTimerRef.current = null;
    setQueuedText(null);

    if (queue.length === 0) return;

    // Deduplicate exact matches while preserving order
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const msg of queue) {
      if (!seen.has(msg)) {
        seen.add(msg);
        unique.push(msg);
      }
    }

    const combined = unique.join('\n\n');

    if (!chat?.id) {
      createChat(combined);
    } else {
      sendMessage({
        role: 'user',
        parts: [{ type: 'text', text: combined }],
      });
    }
  }, [chat?.id, createChat, sendMessage]);

  const handleSubmit = useCallback(
    (value: string) => {
      if (!value.trim()) return;

      messageQueueRef.current.push(value.trim());

      // Update preview with deduplicated queue
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const msg of messageQueueRef.current) {
        if (!seen.has(msg)) {
          seen.add(msg);
          unique.push(msg);
        }
      }
      setQueuedText(unique.join('\n\n'));

      // Reset debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(flushQueue, QUEUE_DEBOUNCE_MS);
    },
    [flushQueue]
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleNewConversation = useCallback(() => {
    // Clear debounce timer and queue
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    messageQueueRef.current = [];
    setQueuedText(null);

    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${wsId}`);
    setChat(undefined);
    setInitialMessages([]);
    setPendingPrompt(null);
    setInput('');
    // Generate a fresh fallback ID so useChat creates a new Chat instance
    setFallbackChatId(generateRandomUUID());
  }, [wsId]);

  const isStreaming = status === 'streaming';
  // queuedText = messages accumulating during debounce (not yet sent)
  // pendingPrompt = first message waiting for chat creation
  const pendingDisplay = queuedText ?? pendingPrompt;
  const hasMessages = messages.length > 0 || !!pendingDisplay;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header: model selector + new conversation */}
      <div className="flex items-center gap-2 pb-2">
        <MiraModelSelector
          wsId={wsId}
          model={model}
          onChange={setModel}
          disabled={isStreaming}
        />
        {isFullscreen && <MiraCreditBar wsId={wsId} />}
        <div className="flex-1" />
        {hasMessages && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNewConversation}
            title={t('new_conversation')}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
          </Button>
        )}
        {onToggleFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggleFullscreen}
            title={isFullscreen ? t('exit_fullscreen') : t('fullscreen')}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>

      {/* Messages area */}
      {hasMessages ? (
        <ChatMessageList
          messages={
            pendingDisplay && messages.length === 0
              ? [
                  {
                    id: 'pending',
                    role: 'user' as const,
                    parts: [{ type: 'text' as const, text: pendingDisplay }],
                  },
                ]
              : queuedText
                ? [
                    ...messages,
                    {
                      id: 'queued',
                      role: 'user' as const,
                      parts: [{ type: 'text' as const, text: queuedText }],
                    },
                  ]
                : messages
          }
          isStreaming={isStreaming || !!pendingPrompt}
          assistantName={assistantName}
          userAvatarUrl={userAvatarUrl}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-8">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-dynamic-purple/15">
              <Sparkles className="h-6 w-6 text-dynamic-purple" />
            </div>
            <div className="text-center">
              <p className="font-medium text-sm">{assistantName}</p>
              <p className="mt-1 max-w-xs text-muted-foreground text-xs">
                {t('empty_state', { name: assistantName })}
              </p>
            </div>
          </div>
          <QuickActionChips
            onSend={handleSubmit}
            disabled={isStreaming}
            variant="cards"
          />
        </div>
      )}

      {/* Quick actions when there are messages */}
      {hasMessages && !isStreaming && (
        <div className="py-2">
          <QuickActionChips onSend={handleSubmit} disabled={isStreaming} />
        </div>
      )}

      {/* Input bar */}
      <div className="pt-2">
        <ChatInputBar
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          isStreaming={isStreaming}
          assistantName={assistantName}
          onVoiceToggle={onVoiceToggle}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
}
