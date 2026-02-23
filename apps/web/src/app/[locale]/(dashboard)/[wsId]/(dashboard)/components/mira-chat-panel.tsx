'use client';

import { setByPath } from '@json-render/core';
import { ActionProvider, StateProvider } from '@json-render/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DefaultChatTransport } from '@tuturuuu/ai/core';
import {
  defaultModel,
  getGatewayModelId,
  type Model,
} from '@tuturuuu/ai/models';
import { useChat } from '@tuturuuu/ai/react';
import type { UIMessage } from '@tuturuuu/ai/types';
import {
  Eye,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  PanelBottomOpen,
  Sparkles,
} from '@tuturuuu/icons';
import { createClient } from '@tuturuuu/supabase/next/client';
import type { AIChat } from '@tuturuuu/types';
import { Button } from '@tuturuuu/ui/button';
import { toast } from '@tuturuuu/ui/sonner';
import { cn } from '@tuturuuu/utils/format';
import { generateRandomUUID } from '@tuturuuu/utils/uuid-helper';
import { getToolName, isToolUIPart } from 'ai';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { handlers as jsonRenderHandlers } from '@/components/json-render/dashboard-registry';
import { resolveTimezone } from '@/lib/calendar-settings-resolver';
import ChatInputBar from './chat-input-bar';
import ChatMessageList from './chat-message-list';
import type { ChatFile, MessageFileAttachment } from './file-preview-chips';
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

/** Upload a file to Supabase Storage via a server-generated signed upload URL.
 *  1. POST /api/ai/chat/upload-url to obtain a signed URL + token
 *  2. PUT the file directly to Supabase Storage using that URL
 *
 *  Path logic lives server-side:
 *  - No chatId → temp path `{wsId}/chats/ai/resources/temp/{userId}/…`
 *  - With chatId → chat path `{wsId}/chats/ai/resources/{chatId}/…`
 *  The AI route automatically moves temp files on the first message. */
/** Fetch signed read URLs for the given storage paths.
 *  Returns a Map from path → signedUrl. Non-critical — returns empty map on failure. */
async function fetchSignedReadUrls(
  paths: string[]
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  try {
    const res = await fetch('/api/ai/chat/signed-read-url', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) return new Map();
    const { urls } = (await res.json()) as {
      urls: Array<{ path: string; signedUrl: string | null }>;
    };
    const map = new Map<string, string>();
    for (const u of urls) {
      if (u.signedUrl) map.set(u.path, u.signedUrl);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function uploadChatFileViaSignedUrl(
  wsId: string,
  chatId: string | undefined,
  file: File
): Promise<{ path: string | null; error: string | null }> {
  try {
    // 1. Obtain a signed upload URL from our API
    const res = await fetch('/api/ai/chat/upload-url', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, wsId, chatId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg =
        (body as { message?: string }).message ?? `HTTP ${res.status}`;
      console.error('[Mira Chat] Failed to get signed URL:', msg);
      return { path: null, error: msg };
    }

    const { signedUrl, token, path } = (await res.json()) as {
      signedUrl: string;
      token: string;
      path: string;
    };

    // 2. Upload the file directly to Supabase Storage
    const uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => '');
      console.error('[Mira Chat] Signed upload failed:', text);
      return { path: null, error: `Upload failed (${uploadRes.status})` };
    }

    return { path, error: null };
  } catch (err) {
    console.error('[Mira Chat] File upload exception:', err);
    return {
      path: null,
      error: err instanceof Error ? err.message : 'Upload failed',
    };
  }
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lift state for Generative UI so action handlers can access it
  const [generativeState, setGenerativeState] = useState<Record<string, any>>(
    {}
  );
  const generativeStateRef = useRef(generativeState);
  generativeStateRef.current = generativeState;

  const sendMessageRef = useRef<typeof sendMessage>(null!);

  // json-render action handlers factory expecting state accessors
  const actionHandlers = useMemo(
    () =>
      jsonRenderHandlers(
        () => (updater: any) => {
          // Provide a setState implementation that updates our lifted state
          setGenerativeState((prev) => {
            if (typeof updater === 'function') {
              return updater(prev);
            }
            if (updater && typeof updater === 'object') {
              return { ...prev, ...updater };
            }
            return prev;
          });
        },
        () => ({
          // Provide the current state plus extra context
          ...generativeStateRef.current,
          sendMessage: sendMessageRef.current,
        })
      ),
    [] // Stable handlers
  );

  // Bottom bar (suggested prompts + input) visibility: hide while scrolling, show after scroll stops
  const [bottomBarVisible, setBottomBarVisible] = useState(true);
  // Fullscreen only: view-only mode hides the input panel for a clean read-only view
  const [viewOnly, setViewOnly] = useState(false);

  // ── Message queue for debounced batching ──
  const messageQueueRef = useRef<string[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [queuedText, setQueuedText] = useState<string | null>(null);

  // ── File attachment state ──
  const [attachedFiles, setAttachedFiles] = useState<ChatFile[]>([]);
  // Maps message IDs → file metadata so chat-message-list can render previews
  const [messageAttachments, setMessageAttachments] = useState<
    Map<string, MessageFileAttachment[]>
  >(new Map());

  // Keep a ref in sync so callbacks (clearAttachedFiles, handleFileRemove)
  // always see the latest snapshot even within the same React batch.
  const messageAttachmentsRef = useRef(messageAttachments);
  messageAttachmentsRef.current = messageAttachments;

  // Generate a stable chat ID so useChat's internal Chat instance is never
  // recreated due to id: undefined → auto-generated UUID mismatch.
  // Regenerated when the user starts a new conversation.
  const [fallbackChatId, setFallbackChatId] = useState(generateRandomUUID);

  const gatewayModelId = useMemo(
    () => getGatewayModelId(model.value, model.provider),
    [model]
  );

  // User and workspace calendar settings for task CRUD timezone
  const { data: userCalendarSettings } = useQuery({
    queryKey: ['users', 'calendar-settings'],
    queryFn: async () => {
      const res = await fetch('/api/v1/users/calendar-settings', {
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data as { timezone?: string | null };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: workspaceCalendarSettings } = useQuery({
    queryKey: ['workspace-calendar-settings', wsId],
    queryFn: async () => {
      const res = await fetch(`/api/v1/workspaces/${wsId}/calendar-settings`, {
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data as { timezone?: string | null };
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });

  const timezoneForChat = useMemo(
    () =>
      resolveTimezone(
        userCalendarSettings ?? null,
        workspaceCalendarSettings ?? null
      ),
    [userCalendarSettings, workspaceCalendarSettings]
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
          timezone: timezoneForChat,
        },
      }),
    [wsId, gatewayModelId, timezoneForChat]
  );

  // Use the server-assigned chat ID when available, otherwise use the stable
  // fallback. This prevents useChat from recreating its internal Chat instance
  // on every render (which would discard streamed messages).
  const stableChatId = chat?.id ?? fallbackChatId;

  const queryClient = useQueryClient();
  const router = useRouter();

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

  // Refresh widgets & credits when the assistant finishes responding.
  // Track the previous status so we only trigger once per completion cycle.
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    const wasBusy = prev === 'submitted' || prev === 'streaming';
    if (wasBusy && status === 'ready') {
      queryClient.invalidateQueries({ queryKey: ['ai-credits'] });
      router.refresh();
    }
  }, [status, queryClient, router]);

  // Keep ref in sync so callbacks always use the latest sendMessage
  sendMessageRef.current = sendMessage;

  // Invalidate the mira-soul query when Mira updates its own settings via tool.
  // This ensures the UI (name in header, placeholder, etc.) refreshes immediately.
  const lastToolHandled = useRef<string | null>(null);
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts ?? []) {
        if (!isToolUIPart(part)) continue;
        const toolName = getToolName(part as never);
        const state = (part as { state?: string }).state;

        if (state !== 'output-available') continue;

        const key = `${msg.id}-${toolName}`;
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
  }, [messages, queryClient, isFullscreen, onToggleFullscreen]);

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
                (msg.metadata as Record<string, unknown>)?.toolCalls ||
                (msg.metadata as Record<string, unknown>)?.reasoning
            )
            .map((msg) => {
              const parts: UIMessage['parts'] = [];
              const meta = msg.metadata as Record<string, unknown> | null;

              // Reconstruct reasoning part (appears before text)
              const reasoning = meta?.reasoning as string | undefined;
              if (reasoning) {
                parts.push({
                  type: 'reasoning' as const,
                  text: reasoning,
                } as UIMessage['parts'][number]);
              }

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

        // Fetch file attachments from storage and associate with user messages.
        // Files uploaded to the chat are stored under the chat's resource path.
        try {
          const fileUrlsRes = await fetch('/api/ai/chat/file-urls', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wsId, chatId: chatData.id }),
          });
          if (fileUrlsRes.ok) {
            const { files } = (await fileUrlsRes.json()) as {
              files: Array<{
                path: string;
                name: string;
                size: number;
                type: string;
                signedUrl: string | null;
                createdAt: string | null;
              }>;
            };
            if (files.length > 0) {
              // Associate all files with the first user message (best-effort).
              // A more precise approach would store per-message metadata server-side.
              const firstUserMsg = messagesData?.find(
                (m) => m.role.toLowerCase() === 'user'
              );
              if (firstUserMsg) {
                const attachments: MessageFileAttachment[] = files.map(
                  (f, idx) => ({
                    id: `stored-${idx}`,
                    name: f.name,
                    size: f.size,
                    type: f.type,
                    previewUrl: null,
                    storagePath: f.path,
                    signedUrl: f.signedUrl,
                  })
                );
                setMessageAttachments((prev) =>
                  new Map(prev).set(firstUserMsg.id, attachments)
                );
              }
            }
          }
        } catch {
          // Non-critical: files simply won't show previews for old messages
          console.warn('[Mira Chat] Failed to load chat file URLs');
        }
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
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
  // ── File attachment handlers ──
  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      // Create ChatFile entries in 'pending' state with preview URLs
      const newChatFiles: ChatFile[] = files.map((file) => ({
        id: generateRandomUUID(),
        file,
        previewUrl:
          file.type.startsWith('image/') || file.type.startsWith('video/')
            ? URL.createObjectURL(file)
            : null,
        storagePath: null,
        signedUrl: null,
        status: 'pending' as const,
      }));

      setAttachedFiles((prev) => [...prev, ...newChatFiles]);

      // Upload each file via signed URL, then fetch a persistent signed read URL
      for (const chatFile of newChatFiles) {
        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.id === chatFile.id ? { ...f, status: 'uploading' } : f
          )
        );

        const { path, error } = await uploadChatFileViaSignedUrl(
          wsId,
          chat?.id,
          chatFile.file
        );

        if (error || !path) {
          setAttachedFiles((prev) =>
            prev.map((f) =>
              f.id === chatFile.id
                ? { ...f, storagePath: path, status: 'error' }
                : f
            )
          );
          toast.error(`Failed to upload ${chatFile.file.name}`);
          continue;
        }

        // Fetch a signed read URL so the preview survives blob URL revocation
        const readUrls = await fetchSignedReadUrls([path]);
        const signedUrl = readUrls.get(path) ?? null;

        setAttachedFiles((prev) =>
          prev.map((f) =>
            f.id === chatFile.id
              ? { ...f, storagePath: path, signedUrl, status: 'uploaded' }
              : f
          )
        );
      }
    },
    [wsId, chat?.id]
  );

  const handleFileRemove = useCallback(
    (id: string) => {
      setAttachedFiles((prev) => {
        const file = prev.find((f) => f.id === id);
        // Revoke preview URL to avoid memory leaks — but only if NOT already
        // snapshotted into messageAttachments (otherwise the chat display breaks).
        // Read from ref to avoid stale closure issues.
        if (file?.previewUrl) {
          const isSnapshotted = Array.from(
            messageAttachmentsRef.current.values()
          ).some((attachments) =>
            attachments.some((a) => a.previewUrl === file.previewUrl)
          );
          if (!isSnapshotted) URL.revokeObjectURL(file.previewUrl);
        }
        return prev.filter((f) => f.id !== id);
      });
    },
    [] // Reads from ref — no stale closure
  );

  /** Snapshot the current attached files as serializable metadata and associate
   *  them with a message ID so the chat list can render inline previews.
   *  Also updates the ref immediately so subsequent callbacks in the same
   *  React batch (e.g. clearAttachedFiles) see the new snapshot. */
  const snapshotAttachmentsForMessage = useCallback(
    (messageId: string) => {
      if (attachedFiles.length === 0) return;
      const meta: MessageFileAttachment[] = attachedFiles
        .filter((f) => f.status === 'uploaded')
        .map((f) => ({
          id: f.id,
          name: f.file.name,
          size: f.file.size,
          type: f.file.type,
          previewUrl: f.previewUrl,
          storagePath: f.storagePath,
          signedUrl: f.signedUrl ?? null,
        }));
      if (meta.length > 0) {
        setMessageAttachments((prev) => {
          const next = new Map(prev).set(messageId, meta);
          // Update ref immediately so clearAttachedFiles (called in the same
          // synchronous batch) sees the preserved URLs.
          messageAttachmentsRef.current = next;
          return next;
        });
      }
    },
    [attachedFiles]
  );

  const clearAttachedFiles = useCallback(() => {
    setAttachedFiles((prev) => {
      // Collect all preview URLs that are currently referenced by
      // messageAttachments so we don't revoke them prematurely.
      // Read from ref to avoid stale closure (snapshot may have been
      // added in the same synchronous batch).
      const preservedUrls = new Set<string>();
      for (const attachments of messageAttachmentsRef.current.values()) {
        for (const a of attachments) {
          if (a.previewUrl) preservedUrls.add(a.previewUrl);
        }
      }
      for (const f of prev) {
        if (f.previewUrl && !preservedUrls.has(f.previewUrl)) {
          URL.revokeObjectURL(f.previewUrl);
        }
      }
      return [];
    });
  }, []); // Reads from ref — no stale closure

  const flushQueue = useCallback(() => {
    const queue = [...messageQueueRef.current];
    messageQueueRef.current = [];
    debounceTimerRef.current = null;
    setQueuedText(null);

    // Deduplicate exact matches while preserving order
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const msg of queue) {
      if (!seen.has(msg)) {
        seen.add(msg);
        unique.push(msg);
      }
    }

    const hasUploadedFiles = attachedFiles.some((f) => f.status === 'uploaded');

    // Nothing to send — no text and no files
    if (unique.length === 0 && !hasUploadedFiles) return;

    // If the user sent only files with no text, use a short placeholder so the
    // AI route still triggers and picks up the uploaded files from storage.
    const combined =
      unique.length > 0
        ? unique.join('\n\n')
        : 'Please analyze the attached file(s).';

    if (!chat?.id) {
      // Snapshot files for the 'pending' synthetic message shown while creating.
      // Also snapshot under '__latest_user_upload' so the re-keying effect can
      // transfer attachments to the real message ID once useChat assigns one.
      snapshotAttachmentsForMessage('pending');
      snapshotAttachmentsForMessage('__latest_user_upload');
      createChat(combined);
    } else {
      // Snapshot under a stable key for re-keying to the real message ID
      snapshotAttachmentsForMessage('__latest_user_upload');
      sendMessage({
        role: 'user',
        parts: [{ type: 'text', text: combined }],
      });
    }

    // Clear files after sending (they are already uploaded to storage)
    clearAttachedFiles();
  }, [
    chat?.id,
    attachedFiles,
    createChat,
    sendMessage,
    clearAttachedFiles,
    snapshotAttachmentsForMessage,
  ]);

  // Re-key attachment metadata from synthetic IDs ('pending', 'queued',
  // '__latest_user_upload') to real message IDs assigned by useChat.
  // This runs after React commits state updates so new messages are visible.
  const prevMessageIdsRef = useRef(new Set<string>());
  useEffect(() => {
    const prevIds = prevMessageIdsRef.current;
    const currentIds = new Set(messages.map((m) => m.id));
    prevMessageIdsRef.current = currentIds;

    for (const msg of messages) {
      if (msg.role !== 'user') continue;
      if (prevIds.has(msg.id)) continue; // Not a new message

      // New user message appeared — transfer attachments from synthetic keys
      const current = messageAttachmentsRef.current;
      const latestUpload = current.get('__latest_user_upload');
      if (latestUpload && latestUpload.length > 0) {
        setMessageAttachments((prev) => {
          const next = new Map(prev);
          next.set(msg.id, latestUpload);
          // Clean up all synthetic keys
          next.delete('__latest_user_upload');
          next.delete('pending');
          next.delete('queued');
          messageAttachmentsRef.current = next;
          return next;
        });
        break; // Only transfer once per flush
      }
    }
  }, [messages]);

  const handleSubmit = useCallback(
    (value: string) => {
      // Allow submitting with only files (empty text)
      if (!value.trim() && attachedFiles.length === 0) return;

      if (value.trim()) {
        messageQueueRef.current.push(value.trim());
      }

      // Update preview with deduplicated queue
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const msg of messageQueueRef.current) {
        if (!seen.has(msg)) {
          seen.add(msg);
          unique.push(msg);
        }
      }
      setQueuedText(unique.length > 0 ? unique.join('\n\n') : null);

      // Snapshot attachment metadata for the queued display message
      if (attachedFiles.length > 0) {
        snapshotAttachmentsForMessage('queued');
      }

      // Reset debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(flushQueue, QUEUE_DEBOUNCE_MS);
    },
    [flushQueue, attachedFiles, snapshotAttachmentsForMessage]
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
    clearAttachedFiles();
    setMessageAttachments(new Map());
    // Generate a fresh fallback ID so useChat creates a new Chat instance
    setFallbackChatId(generateRandomUUID());
  }, [wsId, clearAttachedFiles]);

  const isStreaming = status === 'streaming';
  const isBusy = status === 'submitted' || isStreaming;
  // queuedText = messages accumulating during debounce (not yet sent)
  // pendingPrompt = first message waiting for chat creation
  const pendingDisplay = queuedText ?? pendingPrompt;
  const hasFileOnlyPending =
    !pendingDisplay && messageAttachments.size > 0 && messages.length === 0;
  const hasMessages =
    messages.length > 0 || !!pendingDisplay || hasFileOnlyPending;

  // Hide bottom bar while scrolling, show again after scroll stops
  const SCROLL_END_DELAY_MS = 700;
  useEffect(() => {
    if (!hasMessages) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    const onScroll = () => {
      if (!el) return;

      // Calculate how far we are from the bottom
      const isNearBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight < 50;

      // If we are artificially scrolling down (e.g. streaming snap), or user is at bottom, keep visible.
      // Only hide if the user specifically scrolls way up into history.
      if (isNearBottom) {
        setBottomBarVisible(true);
        if (scrollEndTimerRef.current) {
          clearTimeout(scrollEndTimerRef.current);
          scrollEndTimerRef.current = null;
        }
        return;
      }

      setBottomBarVisible(false);
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
      scrollEndTimerRef.current = setTimeout(() => {
        scrollEndTimerRef.current = null;
        setBottomBarVisible(true);
      }, SCROLL_END_DELAY_MS);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
        scrollEndTimerRef.current = null;
      }
    };
  }, [hasMessages]);

  const viewOnlyButtonTitle = viewOnly
    ? (() => {
        try {
          return t('show_input_panel');
        } catch {
          return 'Show input panel';
        }
      })()
    : (() => {
        try {
          return t('view_only');
        } catch {
          return 'View only';
        }
      })();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Header: model selector + new conversation; wraps on narrow screens */}
      <div className="flex min-w-0 flex-wrap items-center gap-2 pb-2">
        <div className="min-w-0 flex-1 sm:min-w-0">
          <MiraModelSelector
            wsId={wsId}
            model={model}
            onChange={setModel}
            disabled={isBusy}
          />
        </div>
        {isFullscreen && <MiraCreditBar wsId={wsId} />}
        <div className="hidden flex-1 sm:block" />
        <div className="flex shrink-0 items-center gap-0.5">
          {hasMessages && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNewConversation}
              title={t('new_conversation')}
            >
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewOnly((v) => !v)}
            title={viewOnlyButtonTitle}
          >
            {viewOnly ? (
              <PanelBottomOpen className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          {onToggleFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleFullscreen}
              title={isFullscreen ? t('exit_fullscreen') : t('fullscreen')}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Messages area + floating bottom bar container; overflow hidden so content stays inside chat area */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {hasMessages ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <StateProvider
              initialState={generativeState}
              onStateChange={(path, value) => {
                setGenerativeState((prev) => {
                  const next = { ...prev };
                  setByPath(next, path, value);
                  return next;
                });
              }}
            >
              <ActionProvider handlers={actionHandlers}>
                <ChatMessageList
                  messages={
                    (pendingDisplay || hasFileOnlyPending) &&
                    messages.length === 0
                      ? [
                          {
                            id: 'pending',
                            role: 'user' as const,
                            parts: pendingDisplay
                              ? [
                                  {
                                    type: 'text' as const,
                                    text: pendingDisplay,
                                  },
                                ]
                              : [],
                          },
                        ]
                      : queuedText
                        ? [
                            ...messages,
                            {
                              id: 'queued',
                              role: 'user' as const,
                              parts: [
                                { type: 'text' as const, text: queuedText },
                              ],
                            },
                          ]
                        : messages
                  }
                  isStreaming={isBusy || !!pendingPrompt}
                  assistantName={assistantName}
                  userAvatarUrl={userAvatarUrl}
                  scrollContainerRef={scrollContainerRef}
                  messageAttachments={messageAttachments}
                />
              </ActionProvider>
            </StateProvider>
          </div>
        ) : (
          <div className="m-auto flex w-full max-w-2xl flex-col items-center justify-center gap-8 px-4 py-12 sm:px-8 sm:py-16">
            <div className="flex w-full flex-col items-center gap-5 text-center">
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-dynamic-purple/20 to-dynamic-purple/5 shadow-dynamic-purple/10 shadow-lg ring-1 ring-dynamic-purple/20">
                <div className="absolute inset-0 rounded-2xl bg-dynamic-purple/10 blur-xl" />
                <Sparkles className="relative z-10 h-8 w-8 animate-pulse text-dynamic-purple duration-2000" />
              </div>
              <div className="max-w-lg space-y-1.5">
                <h2 className="bg-linear-to-br from-foreground to-foreground/70 bg-clip-text font-bold text-2xl text-transparent tracking-tight sm:text-3xl">
                  {assistantName}
                </h2>
                <p className="font-medium text-muted-foreground text-sm sm:text-base">
                  {t('empty_state', { name: assistantName })}
                </p>
              </div>
            </div>
            <div className="flex w-full justify-center">
              <QuickActionChips
                onSend={handleSubmit}
                disabled={isBusy}
                variant="cards"
              />
            </div>
          </div>
        )}
        {/* Floating bottom bar: suggested prompts + input (overlays content) */}
        <div
          className={cn(
            'absolute right-0 bottom-0 left-0 z-10 flex min-w-0 max-w-full flex-col gap-2 p-3 transition-transform duration-300 ease-out sm:p-4',
            (!bottomBarVisible || viewOnly) &&
              'pointer-events-none translate-y-full'
          )}
        >
          {hasMessages && !isBusy && (
            <div className="min-w-0 overflow-x-auto overflow-y-hidden">
              <QuickActionChips onSend={handleSubmit} disabled={isBusy} />
            </div>
          )}
          <div className="min-w-0">
            <ChatInputBar
              input={input}
              setInput={setInput}
              onSubmit={handleSubmit}
              isStreaming={isBusy}
              assistantName={assistantName}
              onVoiceToggle={onVoiceToggle}
              inputRef={inputRef}
              files={attachedFiles}
              onFilesSelected={handleFilesSelected}
              onFileRemove={handleFileRemove}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
