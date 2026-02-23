'use client';

import { Mic, Send } from '@tuturuuu/icons';
import { Button } from '@tuturuuu/ui/button';
import { useEnterSubmit } from '@tuturuuu/ui/hooks/use-enter-submit';
import { cn } from '@tuturuuu/utils/format';
import { useTranslations } from 'next-intl';
import { type RefObject, useRef } from 'react';
import Textarea from 'react-textarea-autosize';

interface ChatInputBarProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (value: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
  assistantName: string;
  onVoiceToggle?: () => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}

export default function ChatInputBar({
  input,
  setInput,
  onSubmit,
  isStreaming,
  disabled,
  assistantName,
  onVoiceToggle,
  inputRef: externalRef,
}: ChatInputBarProps) {
  const t = useTranslations('dashboard.mira_chat');
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef ?? internalRef;
  const { formRef, onKeyDown } = useEnterSubmit();

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || isStreaming) return;
        onSubmit(trimmed);
        setInput('');
      }}
      className={cn(
        'flex min-w-0 items-end gap-2.5 rounded-xl border border-border/50 bg-background/80 p-2.5 backdrop-blur-sm',
        'transition-colors focus-within:border-dynamic-purple/30'
      )}
    >
      <Textarea
        ref={textareaRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        rows={1}
        maxRows={5}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={t('placeholder', { name: assistantName })}
        spellCheck={false}
        disabled={disabled || isStreaming}
        className="scrollbar-none min-h-[42px] min-w-0 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm placeholder-muted-foreground focus:outline-none"
      />

      <div className="flex items-center gap-1">
        {onVoiceToggle && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onVoiceToggle}
            disabled={disabled}
          >
            <Mic className="h-4.5 w-4.5" />
          </Button>
        )}

        <Button
          type="submit"
          size="icon"
            className={cn(
              'h-9 w-9 shrink-0 transition-all',
            input.trim()
              ? 'bg-dynamic-purple text-white hover:bg-dynamic-purple/90'
              : 'bg-muted text-muted-foreground'
          )}
          disabled={!input.trim() || isStreaming || disabled}
        >
          <Send className="h-4.5 w-4.5" />
        </Button>
      </div>
    </form>
  );
}
