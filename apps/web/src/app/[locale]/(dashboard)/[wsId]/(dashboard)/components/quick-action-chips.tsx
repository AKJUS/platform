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
      <div className="grid w-full max-w-sm grid-cols-2 gap-2">
        {actions.map(({ key, descKey, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={cn(
              'flex flex-col items-start gap-1.5 rounded-lg border border-border/50 p-3 text-left transition-colors',
              'hover:border-dynamic-purple/30 hover:bg-dynamic-purple/5',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
            onClick={() => onSend(t(key))}
            disabled={disabled}
          >
            <Icon className="h-4 w-4 text-dynamic-purple" />
            <span className="font-medium text-xs leading-tight">{t(key)}</span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              {t(descKey)}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ key, icon: Icon }) => (
        <Button
          key={key}
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-full border-border/50 text-xs"
          onClick={() => onSend(t(key))}
          disabled={disabled}
        >
          <Icon className="h-3.5 w-3.5" />
          {t(key)}
        </Button>
      ))}
    </div>
  );
}
