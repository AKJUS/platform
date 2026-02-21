'use client';

import { code } from '@streamdown/code';
import { math } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';
import type { UIMessage } from '@tuturuuu/ai/types';
import {
  AlertCircle,
  Check,
  ChevronRight,
  ClipboardCopy,
  Loader2,
  Sparkles,
  UserIcon,
} from '@tuturuuu/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@tuturuuu/ui/avatar';
import { Dialog, DialogContent, DialogTitle } from '@tuturuuu/ui/dialog';
import { cn } from '@tuturuuu/utils/format';
import { getToolName, isToolUIPart } from 'ai';
import { useTranslations } from 'next-intl';
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Streamdown } from 'streamdown';

interface ChatMessageListProps {
  messages: UIMessage[];
  isStreaming: boolean;
  assistantName?: string;
  userAvatarUrl?: string | null;
}

const plugins = { code, mermaid, math };

function hasTextContent(message: UIMessage): boolean {
  return (
    message.parts?.some((p) => p.type === 'text' && p.text.trim().length > 0) ??
    false
  );
}

function hasToolParts(message: UIMessage): boolean {
  return (
    message.parts?.some(
      (p) => isToolUIPart(p) && getToolName(p as never) !== 'no_action_needed'
    ) ?? false
  );
}

/** Humanize a tool name: "get_my_tasks" → "Get my tasks" */
function humanizeToolName(name: string): string {
  const words = name.replace(/[-_]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Extract plain text from a message for copying */
function getMessageText(message: UIMessage): string {
  return (
    message.parts
      ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('') || ''
  );
}

type ToolPartData = { type: string; [key: string]: unknown };

/**
 * Groups consecutive tool parts with the same tool name into render groups.
 * Text parts remain individual; adjacent tool parts of the same name collapse.
 */
type RenderGroup =
  | { kind: 'text'; text: string; index: number }
  | {
      kind: 'tool';
      toolName: string;
      parts: ToolPartData[];
      startIndex: number;
    }
  | { kind: 'other'; index: number };

function groupMessageParts(parts: UIMessage['parts']): RenderGroup[] {
  if (!parts) return [];

  const groups: RenderGroup[] = [];
  let currentToolGroup: {
    toolName: string;
    parts: ToolPartData[];
    startIndex: number;
  } | null = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;

    if (isToolUIPart(part)) {
      const name = getToolName(part as never);
      // Skip the escape-hatch tool — it's invisible to the user
      if (name === 'no_action_needed') continue;
      if (currentToolGroup && currentToolGroup.toolName === name) {
        currentToolGroup.parts.push(part as ToolPartData);
      } else {
        if (currentToolGroup) {
          groups.push({ kind: 'tool', ...currentToolGroup });
        }
        currentToolGroup = {
          toolName: name,
          parts: [part as ToolPartData],
          startIndex: i,
        };
      }
    } else {
      if (currentToolGroup) {
        groups.push({ kind: 'tool', ...currentToolGroup });
        currentToolGroup = null;
      }
      if (part.type === 'text' && (part as { text: string }).text.trim()) {
        groups.push({
          kind: 'text',
          text: (part as { text: string }).text,
          index: i,
        });
      } else {
        groups.push({ kind: 'other', index: i });
      }
    }
  }

  if (currentToolGroup) {
    groups.push({ kind: 'tool', ...currentToolGroup });
  }

  return groups;
}

// Error boundary to catch Streamdown crashes and fall back to plain text
class MarkdownErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Streamdown render error:', error, info);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function AssistantMarkdown({
  text,
  isAnimating,
}: {
  text: string;
  isAnimating: boolean;
}) {
  return (
    <MarkdownErrorBoundary
      fallback={<p className="whitespace-pre-wrap">{text}</p>}
    >
      <div className="prose prose-sm dark:prose-invert wrap-break-word max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <Streamdown
          plugins={plugins}
          caret="block"
          isAnimating={isAnimating}
          controls={{ code: true }}
          linkSafety={{ enabled: false }}
        >
          {text}
        </Streamdown>
      </div>
    </MarkdownErrorBoundary>
  );
}

function CopyButton({ text }: { text: string }) {
  const t = useTranslations('dashboard.mira_chat');
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
  }, [text]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'rounded-md p-1 transition-all',
        'opacity-0 group-hover:opacity-100',
        'text-muted-foreground hover:bg-foreground/10 hover:text-foreground',
        copied && 'text-dynamic-green opacity-100 hover:text-dynamic-green'
      )}
      title={t('copy_message')}
    >
      {copied ? (
        <Check className="h-3 w-3" />
      ) : (
        <ClipboardCopy className="h-3 w-3" />
      )}
    </button>
  );
}

/** Extract status info from a single tool part */
function getToolPartStatus(part: ToolPartData) {
  const state = (part as { state?: string }).state ?? '';
  const isDone = state === 'output-available';
  const isError = state === 'output-error' || state === 'output-denied';
  const isRunning = !isDone && !isError;
  return { isDone, isError, isRunning };
}

function ToolCallPart({ part }: { part: ToolPartData }) {
  const t = useTranslations('dashboard.mira_chat');
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(
    null
  );

  const rawToolName = getToolName(part as never);
  const toolName = humanizeToolName(rawToolName);
  const output = (part as { output?: unknown }).output;
  const errorText = (part as { errorText?: string }).errorText;

  const { isDone, isError, isRunning } = getToolPartStatus(part);
  const hasOutput = isDone || isError;

  // For create_image: the model writes ![](url) in its text response which
  // persists in the DB. We only show a status indicator here to avoid rendering
  // the image twice (once from the tool part and once from the markdown text).
  const isImageTool = rawToolName === 'create_image';

  const outputText = isError
    ? (errorText ?? 'Unknown error')
    : JSON.stringify(output, null, 2);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(outputText);
    setCopied(true);
  }, [outputText]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  // Running state for image tool shows specific message
  if (isImageTool && isRunning) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-foreground/2 px-3 py-2 text-xs">
        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        <span className="flex items-center gap-1.5">
          <span className="font-medium">{toolName}</span>
          <span className="text-muted-foreground">
            {t('tool_generating_image')}
          </span>
        </span>
      </div>
    );
  }

  // Completed image tool: render the image inline from tool output
  if (isImageTool && isDone && output) {
    const imageUrl = (output as { imageUrl?: string }).imageUrl;
    if (imageUrl) {
      return (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-xs">
              <Check className="h-3.5 w-3.5 text-dynamic-green" />
              <span className="font-medium">{toolName}</span>
              <span className="text-muted-foreground">{t('tool_done')}</span>
            </div>
            <button
              type="button"
              onClick={() => setFullscreenImageUrl(imageUrl)}
              className="overflow-hidden rounded-lg border border-border/50 text-left transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-dynamic-blue focus:ring-offset-2"
            >
              {/* biome-ignore lint/performance/noImgElement: Dynamic URL from tool output */}
              <img
                src={imageUrl}
                alt={t('generated_image')}
                className="max-h-80 w-auto cursor-pointer"
                loading="lazy"
              />
            </button>
          </div>
          <Dialog
            open={fullscreenImageUrl !== null}
            onOpenChange={(open) => !open && setFullscreenImageUrl(null)}
          >
            <DialogContent
              className="max-h-[95vh] max-w-[95vw] border-0 bg-black/95 p-0"
              showCloseButton={false}
            >
              <DialogTitle className="sr-only">
                {t('generated_image')}
              </DialogTitle>
              {fullscreenImageUrl && (
                <button
                  type="button"
                  onClick={() => setFullscreenImageUrl(null)}
                  className="flex size-full min-h-[50vh] items-center justify-center p-4 focus:outline-none focus:ring-0"
                >
                  {/* biome-ignore lint/performance/noImgElement: Dynamic URL from tool output */}
                  <img
                    src={fullscreenImageUrl}
                    alt={t('generated_image')}
                    className="max-h-[90vh] max-w-full object-contain"
                    onClick={(e) => e.stopPropagation()}
                  />
                </button>
              )}
            </DialogContent>
          </Dialog>
        </>
      );
    }
  }

  return (
    <div
      className={cn(
        'flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors',
        isError
          ? 'border-dynamic-red/20 bg-dynamic-red/5'
          : 'border-border/50 bg-foreground/2'
      )}
    >
      <span className="mt-0.5 shrink-0">
        {isDone ? (
          <Check className="h-3.5 w-3.5 text-dynamic-green" />
        ) : isError ? (
          <AlertCircle className="h-3.5 w-3.5 text-dynamic-red" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={() => hasOutput && setExpanded((e) => !e)}
          className={cn(
            'flex items-center gap-1.5',
            hasOutput ? 'cursor-pointer' : 'cursor-default'
          )}
        >
          <span className="font-medium">{toolName}</span>
          <span className="text-muted-foreground">
            {isDone
              ? t('tool_done')
              : isError
                ? t('tool_error')
                : t('tool_running')}
          </span>
          {hasOutput && (
            <ChevronRight
              className={cn(
                'ml-auto h-3 w-3 text-muted-foreground transition-transform',
                expanded && 'rotate-90'
              )}
            />
          )}
        </button>

        {expanded && hasOutput && (
          <div className="relative mt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="absolute top-1 right-1 rounded p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
              title={t('copy_output')}
            >
              {copied ? (
                <Check className="h-3 w-3 text-dynamic-green" />
              ) : (
                <ClipboardCopy className="h-3 w-3" />
              )}
            </button>
            <pre className="max-h-40 select-text overflow-auto whitespace-pre-wrap rounded bg-foreground/5 p-2 pr-6 font-mono text-[11px] text-muted-foreground">
              {outputText}
            </pre>
          </div>
        )}
      </span>
    </div>
  );
}

/** Compact display for multiple consecutive tool calls of the same type */
function GroupedToolCallParts({
  parts,
  toolName,
}: {
  parts: ToolPartData[];
  toolName: string;
}) {
  const t = useTranslations('dashboard.mira_chat');
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const humanName = humanizeToolName(toolName);
  const count = parts.length;

  // Aggregate status: all done, any error, or still running
  const allDone = parts.every((p) => getToolPartStatus(p).isDone);
  const anyError = parts.some((p) => getToolPartStatus(p).isError);
  const anyRunning = parts.some((p) => getToolPartStatus(p).isRunning);
  const hasOutput = allDone || anyError;

  // Combine all outputs for copy
  const combinedOutput = parts
    .map((p, i) => {
      const { isError } = getToolPartStatus(p);
      const output = (p as { output?: unknown }).output;
      const errorText = (p as { errorText?: string }).errorText;
      const text = isError
        ? (errorText ?? 'Unknown error')
        : JSON.stringify(output, null, 2);
      return `--- Call ${i + 1} ---\n${text}`;
    })
    .join('\n\n');

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(combinedOutput);
    setCopied(true);
  }, [combinedOutput]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div
      className={cn(
        'flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors',
        anyError
          ? 'border-dynamic-red/20 bg-dynamic-red/5'
          : 'border-border/50 bg-foreground/2'
      )}
    >
      <span className="mt-0.5 shrink-0">
        {allDone ? (
          <Check className="h-3.5 w-3.5 text-dynamic-green" />
        ) : anyError ? (
          <AlertCircle className="h-3.5 w-3.5 text-dynamic-red" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={() => hasOutput && setExpanded((e) => !e)}
          className={cn(
            'flex items-center gap-1.5',
            hasOutput ? 'cursor-pointer' : 'cursor-default'
          )}
        >
          <span className="font-medium">{humanName}</span>
          <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground/10 px-1 font-mono text-[10px] text-muted-foreground">
            {count}
          </span>
          <span className="text-muted-foreground">
            {allDone
              ? t('tool_done')
              : anyError
                ? t('tool_error')
                : anyRunning
                  ? t('tool_running')
                  : t('tool_done')}
          </span>
          {hasOutput && (
            <ChevronRight
              className={cn(
                'ml-auto h-3 w-3 text-muted-foreground transition-transform',
                expanded && 'rotate-90'
              )}
            />
          )}
        </button>

        {expanded && hasOutput && (
          <div className="relative mt-1">
            <button
              type="button"
              onClick={handleCopy}
              className="absolute top-1 right-1 rounded p-0.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
              title={t('copy_output')}
            >
              {copied ? (
                <Check className="h-3 w-3 text-dynamic-green" />
              ) : (
                <ClipboardCopy className="h-3 w-3" />
              )}
            </button>
            <pre className="max-h-40 select-text overflow-auto whitespace-pre-wrap rounded bg-foreground/5 p-2 pr-6 font-mono text-[11px] text-muted-foreground">
              {combinedOutput}
            </pre>
          </div>
        )}
      </span>
    </div>
  );
}

export default function ChatMessageList({
  messages,
  isStreaming,
  assistantName,
  userAvatarUrl,
}: ChatMessageListProps) {
  const t = useTranslations('dashboard.mira_chat');

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or while streaming.
  // Uses scrollTop instead of scrollIntoView to avoid stealing focus from the input.
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages.length and isStreaming are intentional scroll triggers
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  if (messages.length === 0) return null;

  const lastAssistantIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'assistant') return i;
    }
    return -1;
  })();

  return (
    <div
      ref={containerRef}
      className="scrollbar-none flex flex-1 flex-col gap-1 overflow-y-auto px-1 py-3"
    >
      {messages.map((message, index) => {
        const isUser = message.role === 'user';
        const hasText = hasTextContent(message);
        const hasTools = !isUser && hasToolParts(message);

        // Skip messages with no renderable content
        if (!hasText && !hasTools) return null;

        const isLastAssistant = index === lastAssistantIndex;

        // Check if previous visible message has the same role (for grouping)
        const prevMessage = messages[index - 1];
        const isContinuation = prevMessage?.role === message.role;

        const messageText = getMessageText(message);

        return (
          <div
            key={message.id}
            className={cn(
              'group flex gap-2.5',
              isUser ? 'flex-row-reverse' : '',
              isContinuation ? 'mt-0.5' : 'mt-3 first:mt-0'
            )}
          >
            {/* Avatar — show for first message in a group, invisible spacer for continuations */}
            <div className="flex w-7 shrink-0 flex-col items-center">
              {!isContinuation ? (
                isUser && userAvatarUrl ? (
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={userAvatarUrl} alt={t('you')} />
                    <AvatarFallback className="bg-foreground/10 text-xs">
                      <UserIcon className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full',
                      isUser
                        ? 'bg-foreground/10'
                        : 'bg-dynamic-purple/15 text-dynamic-purple'
                    )}
                  >
                    {isUser ? (
                      <UserIcon className="h-3.5 w-3.5" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </div>
                )
              ) : (
                <div className="h-0 w-7" />
              )}
            </div>

            {/* Message content */}
            <div
              className={cn(
                'flex max-w-[80%] flex-col',
                isUser ? 'items-end' : 'items-start'
              )}
            >
              {/* Name label — show for first message in a group */}
              {!isContinuation && (
                <span
                  className={cn(
                    'mb-1 px-1 font-medium text-[11px] text-muted-foreground',
                    isUser && 'text-right'
                  )}
                >
                  {isUser ? t('you') : (assistantName ?? 'Mira')}
                </span>
              )}

              {/* Bubble + actions row */}
              <div
                className={cn(
                  'flex items-end gap-1',
                  isUser ? 'flex-row-reverse' : ''
                )}
              >
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2.5 text-sm',
                    isUser
                      ? 'bg-foreground text-background'
                      : 'bg-muted/50 text-foreground'
                  )}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{messageText}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {groupMessageParts(message.parts).map((group) => {
                        if (group.kind === 'text') {
                          return (
                            <AssistantMarkdown
                              key={`text-${group.index}`}
                              text={group.text}
                              isAnimating={isStreaming && isLastAssistant}
                            />
                          );
                        }
                        if (group.kind === 'tool') {
                          // Single tool call → render normally; multiple → group
                          if (group.parts.length === 1) {
                            return (
                              <ToolCallPart
                                key={`tool-${group.startIndex}`}
                                part={group.parts[0]!}
                              />
                            );
                          }
                          return (
                            <GroupedToolCallParts
                              key={`toolgroup-${group.startIndex}`}
                              parts={group.parts}
                              toolName={group.toolName}
                            />
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>

                {/* Copy button — appears on hover */}
                {hasText && messageText.trim() && (
                  <CopyButton text={messageText} />
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Thinking indicator */}
      {isStreaming &&
        (() => {
          const lastMsg = messages[messages.length - 1];
          const showThinking =
            lastMsg?.role === 'user' ||
            (lastMsg?.role === 'assistant' && !hasTextContent(lastMsg));
          return showThinking ? (
            <div className="mt-3 flex gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-dynamic-purple/15 text-dynamic-purple">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col items-start">
                <span className="mb-1 px-1 font-medium text-[11px] text-muted-foreground">
                  {assistantName ?? 'Mira'}
                </span>
                <div className="flex items-center gap-2 rounded-2xl bg-muted/50 px-3.5 py-2.5 text-muted-foreground text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t('thinking')}
                </div>
              </div>
            </div>
          ) : null;
        })()}
    </div>
  );
}
