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
      <div className="grid w-full min-w-0 max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {actions.map(({ key, descKey, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={cn(
              'group flex min-w-0 flex-col items-start gap-2 rounded-xl border border-border/40 bg-background/50 p-4 text-left backdrop-blur-sm transition-all duration-300 sm:p-5',
              'hover:-translate-y-0.5 hover:border-dynamic-purple/40 hover:bg-dynamic-purple/5 hover:shadow-dynamic-purple/5 hover:shadow-lg',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
            onClick={() => onSend(t(key))}
            disabled={disabled}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-dynamic-purple/10 text-dynamic-purple transition-transform duration-300 group-hover:scale-110">
              <Icon className="h-4 w-4 shrink-0" />
            </div>
            <div className="mt-1 flex flex-col gap-0.5">
              <span className="w-full min-w-0 truncate font-semibold text-foreground/90 text-sm leading-tight">
                {t(key)}
              </span>
              <span className="line-clamp-2 min-w-0 text-muted-foreground text-xs leading-relaxed">
                {t(descKey)}
              </span>
            </div>
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
          className="h-8 shrink-0 gap-1.5 rounded-full border-border/30 bg-background/40 px-3 text-xs backdrop-blur-md transition-all hover:border-dynamic-purple/40 hover:bg-dynamic-purple/10"
          onClick={() => onSend(t(key))}
          disabled={disabled}
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-dynamic-purple/70 transition-colors group-hover:text-dynamic-purple" />
          <span className="truncate">{t(key)}</span>
        </Button>
      ))}
    </div>
  );
}
