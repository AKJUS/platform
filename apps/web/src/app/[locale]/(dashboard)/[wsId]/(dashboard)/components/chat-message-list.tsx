'use client';

import { registry } from '@/components/json-render/dashboard-registry';
import { Renderer } from '@json-render/react';
import { cjk } from '@streamdown/cjk';
import { code } from '@streamdown/code';
import { math } from '@streamdown/math';
import { mermaid } from '@streamdown/mermaid';
import type { UIMessage } from '@tuturuuu/ai/types';
import {
  AlertCircle,
  Brain,
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
import 'katex/dist/katex.min.css';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Streamdown } from 'streamdown';

interface ChatMessageListProps {
  messages: UIMessage[];
  isStreaming: boolean;
  assistantName?: string;
  userAvatarUrl?: string | null;
  /** Optional ref for the scrollable container (e.g. for scroll-based UI) */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

const plugins = { code, mermaid, math, cjk };

function hasTextContent(message: UIMessage): boolean {
  return (
    message.parts?.some(
      (p) =>
        (p.type === 'text' && p.text.trim().length > 0) ||
        (p.type === 'reasoning' &&
          (p as { text: string }).text.trim().length > 0)
    ) ?? false
  );
}

function hasToolParts(message: UIMessage): boolean {
  return (
    message.parts?.some(
      (p) => isToolUIPart(p) && getToolName(p as never) !== 'no_action_needed'
    ) ?? false
  );
}

/** True if the message has at least one text (output) part — used to treat reasoning as "done" once reply text exists */
function hasOutputText(message: UIMessage): boolean {
  return (
    message.parts?.some(
      (p) => p.type === 'text' && (p as { text: string }).text.trim().length > 0
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
  | { kind: 'reasoning'; text: string; index: number }
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
      } else if (
        part.type === 'reasoning' &&
        (part as { text: string }).text.trim()
      ) {
        groups.push({
          kind: 'reasoning',
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
    <div className="wrap-break-word min-w-0 max-w-full overflow-hidden [&_code]:break-all [&_pre]:max-w-full [&_pre]:overflow-x-auto">
      <MarkdownErrorBoundary
        fallback={<p className="wrap-break-word whitespace-pre-wrap">{text}</p>}
      >
        <Streamdown
          plugins={plugins}
          caret="block"
          isAnimating={isAnimating}
          controls={{
            code: !isAnimating,
            mermaid: !isAnimating,
          }}
          linkSafety={{ enabled: false }}
        >
          {text}
        </Streamdown>
      </MarkdownErrorBoundary>
    </div>
  );
}

function getLatestReasoningHeader(text: string): string | null {
  if (!text) return null;
  const headers = [...text.matchAll(/^#+\s+(.+)$/gm)];
  if (headers.length > 0) return headers[headers.length - 1][1]?.trim() || null;
  const bolds = [...text.matchAll(/^\*\*([^*]+)\*\*$/gm)];
  if (bolds.length > 0) return bolds[bolds.length - 1][1]?.trim() || null;
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  for (let i = blocks.length - 1; i >= 0; i--) {
    const blockLines = blocks[i]
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (
      blockLines.length === 1 &&
      blockLines[0].length < 65 &&
      !/[.!?:]$/.test(blockLines[0])
    ) {
      return blockLines[0];
    }
  }
  return null;
}

function ReasoningPart({
  text,
  isAnimating,
}: {
  text: string;
  isAnimating: boolean;
}) {
  const t = useTranslations('dashboard.mira_chat');
  const [expanded, setExpanded] = useState(false);
  const latestHeader = useMemo(() => getLatestReasoningHeader(text), [text]);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
      >
        {isAnimating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Brain className="h-3 w-3" />
        )}
        <span className="font-medium">
          {isAnimating ? t('reasoning') : t('reasoned')}
        </span>
        {latestHeader && (
          <>
            <span className="text-muted-foreground/40">•</span>
            <span className="max-w-50 truncate text-muted-foreground/80 sm:max-w-75">
              {latestHeader}
            </span>
          </>
        )}
        <ChevronRight
          className={cn(
            'ml-1 h-3 w-3 transition-transform',
            expanded && 'rotate-90'
          )}
        />
      </button>
      {expanded && (
        <div className="border-dynamic-purple/20 border-l-2 pl-3 text-muted-foreground text-xs">
          <MarkdownErrorBoundary
            fallback={<p className="whitespace-pre-wrap">{text}</p>}
          >
            <Streamdown
              plugins={plugins}
              caret="block"
              isAnimating={isAnimating}
              controls={{
                code: !isAnimating,
                mermaid: false,
              }}
              linkSafety={{ enabled: false }}
            >
              {text}
            </Streamdown>
          </MarkdownErrorBoundary>
        </div>
      )}
    </div>
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

type JsonToken =
  | { t: 'key'; v: string }
  | { t: 'string'; v: string }
  | { t: 'number'; v: string }
  | { t: 'keyword'; v: string }
  | { t: 'punct'; v: string }
  | { t: 'plain'; v: string };

function tokenizeJson(line: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let i = 0;
  const n = line.length;
  const skipWs = () => {
    const start = i;
    while (i < n && /[\s]/.test(line[i]!)) i++;
    if (i > start) tokens.push({ t: 'plain', v: line.slice(start, i) });
  };
  while (i < n) {
    skipWs();
    if (i >= n) break;
    const c = line[i];
    if (c === '"') {
      const start = i;
      i++;
      while (i < n) {
        if (line[i] === '\\') i += 2;
        else if (line[i] === '"') {
          i++;
          break;
        } else i++;
      }
      const value = line.slice(start, i);
      const rest = line.slice(i);
      const isKey = /^\s*:/.test(rest);
      tokens.push(isKey ? { t: 'key', v: value } : { t: 'string', v: value });
      continue;
    }
    if (/[{}[\],:]/.test(c!)) {
      tokens.push({ t: 'punct', v: c! });
      i++;
      continue;
    }
    const numMatch = line.slice(i).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (numMatch) {
      tokens.push({ t: 'number', v: numMatch[0]! });
      i += numMatch[0]!.length;
      continue;
    }
    if (line.slice(i).startsWith('true')) {
      tokens.push({ t: 'keyword', v: 'true' });
      i += 4;
      continue;
    }
    if (line.slice(i).startsWith('false')) {
      tokens.push({ t: 'keyword', v: 'false' });
      i += 5;
      continue;
    }
    if (line.slice(i).startsWith('null')) {
      tokens.push({ t: 'keyword', v: 'null' });
      i += 4;
      continue;
    }
    tokens.push({ t: 'plain', v: line[i]! });
    i++;
  }
  return tokens;
}

function JsonHighlight({
  text,
  isError,
}: {
  text: string;
  isError?: boolean;
}): ReactNode {
  const trimmed = text.trim();
  const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  if (isError || !looksLikeJson) {
    return (
      <span className="wrap-break-word whitespace-pre-wrap text-muted-foreground">
        {text}
      </span>
    );
  }
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, idx) => (
        <span key={idx} className="block">
          {tokenizeJson(line).map((tok, i) => {
            const key = `${idx}-${i}`;
            if (tok.t === 'plain') return <span key={key}>{tok.v}</span>;
            if (tok.t === 'key')
              return (
                <span key={key} className="text-dynamic-blue">
                  {tok.v}
                </span>
              );
            if (tok.t === 'string')
              return (
                <span key={key} className="text-dynamic-green">
                  {tok.v}
                </span>
              );
            if (tok.t === 'number')
              return (
                <span key={key} className="text-dynamic-orange">
                  {tok.v}
                </span>
              );
            if (tok.t === 'keyword')
              return (
                <span key={key} className="text-dynamic-purple">
                  {tok.v}
                </span>
              );
            return (
              <span key={key} className="text-muted-foreground">
                {tok.v}
              </span>
            );
          })}
          {idx < lines.length - 1 ? '\n' : null}
        </span>
      ))}
    </>
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

  // Apply theme change when set_theme tool completes
  const { setTheme } = useTheme();
  useEffect(() => {
    if (rawToolName !== 'set_theme' || !isDone) return;
    const action = (output as { action?: string } | undefined)?.action;
    const theme = (output as { theme?: string } | undefined)?.theme;
    if (action === 'set_theme' && theme) {
      setTheme(theme);
    }
  }, [rawToolName, isDone, output, setTheme]);

  // Compact display for select_tools when only no_action_needed was selected
  if (rawToolName === 'select_tools') {
    const selected = (output as { selectedTools?: string[] } | undefined)
      ?.selectedTools;
    const isNoAction =
      selected?.length === 1 && selected[0] === 'no_action_needed';
    if (isNoAction) {
      return (
        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
          {isDone ? (
            <Check className="h-3 w-3 text-dynamic-green" />
          ) : isError ? (
            <AlertCircle className="h-3 w-3 text-dynamic-red" />
          ) : (
            <Loader2 className="h-3 w-3 animate-spin" />
          )}
          <span>{t('no_tools_needed')}</span>
        </div>
      );
    }
  }

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

  // Generative UI tool: render the output natively instead of showing JSON
  if (rawToolName === 'render_ui' && hasOutput) {
    if (isDone && output) {
      // The output of render_ui is just the spec `{ spec: ... }` returned from mira-tools executor
      const spec = (output as { spec?: any })?.spec;
      if (spec) {
        return (
          <div className="my-2 w-full max-w-full">
            <Renderer spec={spec} registry={registry} />
          </div>
        );
      }
    }
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
            <pre className="max-h-40 select-text overflow-auto whitespace-pre-wrap rounded bg-foreground/5 p-2 pr-6 font-mono text-[11px]">
              <JsonHighlight text={outputText} isError={isError} />
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
            <pre className="max-h-40 select-text overflow-auto whitespace-pre-wrap rounded bg-foreground/5 p-2 pr-6 font-mono text-[11px]">
              <JsonHighlight text={combinedOutput} />
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
  scrollContainerRef,
}: ChatMessageListProps) {
  const t = useTranslations('dashboard.mira_chat');

  const containerRef = useRef<HTMLDivElement>(null);

  const setScrollContainerRef = useCallback(
    (el: HTMLDivElement | null) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current =
        el;
      if (scrollContainerRef) {
        (
          scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>
        ).current = el;
      }
    },
    [scrollContainerRef]
  );

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
      ref={setScrollContainerRef}
      className={cn(
        'scrollbar-none flex min-w-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden px-1 py-3',
        scrollContainerRef && 'pb-48'
      )}
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

            {/* Message content — min-w-0 so bubble can shrink and wrap inside chat area */}
            <div
              className={cn(
                'flex min-w-0 max-w-[85%] flex-col sm:max-w-[80%]',
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
                  'flex min-w-0 items-end gap-1',
                  isUser ? 'flex-row-reverse' : ''
                )}
              >
                <div
                  className={cn(
                    'wrap-break-word min-w-0 max-w-full overflow-hidden rounded-2xl px-3.5 py-2.5 text-sm',
                    isUser
                      ? 'bg-foreground text-background'
                      : 'bg-muted/50 text-foreground'
                  )}
                >
                  {isUser ? (
                    <p className="wrap-break-word whitespace-pre-wrap">
                      {messageText}
                    </p>
                  ) : (
                    <div className="flex min-w-0 max-w-full flex-col gap-2 overflow-hidden *:min-w-0 *:max-w-full">
                      {(() => {
                        const groups = groupMessageParts(message.parts);
                        const lastReasoningIdx = groups.findLastIndex(
                          (g) => g.kind === 'reasoning'
                        );
                        return groups.map((group, gi) => {
                          if (group.kind === 'reasoning') {
                            const isLatestReasoning = gi === lastReasoningIdx;
                            // Only show "reasoning..." on the latest assistant message while it has no text yet
                            const isReasoningInProgress =
                              isLatestReasoning &&
                              isStreaming &&
                              isLastAssistant &&
                              !hasOutputText(message);
                            return (
                              <ReasoningPart
                                key={`reasoning-${group.index}`}
                                text={group.text}
                                isAnimating={isReasoningInProgress}
                              />
                            );
                          }
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
                        });
                      })()}
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
