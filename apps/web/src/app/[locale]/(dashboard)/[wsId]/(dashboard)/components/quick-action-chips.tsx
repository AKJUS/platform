'use client';

import { Calendar, ListTodo, Sparkles, Target } from '@tuturuuu/icons';
import { Button } from '@tuturuuu/ui/button';
import { cn } from '@tuturuuu/utils/format';
import { useTranslations } from 'next-intl';

interface QuickActionChipsProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  variant?: 'chips' | 'cards';
}

const actions = [
  { key: 'quick_calendar', descKey: 'quick_calendar_desc', icon: Calendar },
  { key: 'quick_tasks', descKey: 'quick_tasks_desc', icon: ListTodo },
  { key: 'quick_focus', descKey: 'quick_focus_desc', icon: Target },
  { key: 'quick_log', descKey: 'quick_log_desc', icon: Sparkles },
] as const;

export default function QuickActionChips({
  onSend,
  disabled,
  variant = 'chips',
}: QuickActionChipsProps) {
  const t = useTranslations('dashboard.mira_chat');

  if (variant === 'cards') {
    return (
      <div className="mx-auto grid w-full min-w-0 max-w-md grid-cols-2 gap-3">
        {actions.map(({ key, descKey, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={cn(
              'flex min-w-0 flex-col items-start gap-2 rounded-lg border border-border/50 p-3 text-left transition-colors sm:p-4',
              'hover:border-dynamic-purple/30 hover:bg-dynamic-purple/5',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
            onClick={() => onSend(t(key))}
            disabled={disabled}
          >
            <Icon className="h-5 w-5 shrink-0 text-dynamic-purple" />
            <span className="w-full min-w-0 truncate font-medium text-sm leading-tight">
              {t(key)}
            </span>
            <span className="line-clamp-2 min-w-0 text-xs text-muted-foreground leading-tight">
              {t(descKey)}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap justify-center gap-2">
      {actions.map(({ key, icon: Icon }) => (
        <Button
          key={key}
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-2 rounded-full border-border/50 text-sm"
          onClick={() => onSend(t(key))}
          disabled={disabled}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{t(key)}</span>
        </Button>
      ))}
    </div>
  );
}
