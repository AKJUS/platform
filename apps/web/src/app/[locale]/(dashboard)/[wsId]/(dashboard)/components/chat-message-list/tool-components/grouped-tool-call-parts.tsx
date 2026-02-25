import {
  AlertCircle,
  Check,
  ChevronRight,
  ClipboardCopy,
  Loader2,
} from '@tuturuuu/icons';
import { cn } from '@tuturuuu/utils/format';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { ToolPartData } from '../types';
import { JsonHighlight } from './json-highlight';
import { getToolPartStatus } from './tool-status';

function humanizeToolName(name: string): string {
  const words = name.replace(/[-_]/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function GroupedToolCallParts({
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

  const allDone = parts.every((p) => getToolPartStatus(p).isDone);
  const anyError = parts.some((p) => getToolPartStatus(p).isError);
  const anyRunning = parts.some((p) => getToolPartStatus(p).isRunning);
  const hasOutput = allDone || anyError;

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
        {anyError ? (
          <AlertCircle className="h-3.5 w-3.5 text-dynamic-red" />
        ) : allDone ? (
          <Check className="h-3.5 w-3.5 text-dynamic-green" />
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
