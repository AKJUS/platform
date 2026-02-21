'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@tuturuuu/utils/format';
import { useTranslations } from 'next-intl';

interface MiraCreditBarProps {
  wsId: string;
}

interface CreditData {
  totalAllocated: number;
  totalUsed: number;
  remaining: number;
  percentUsed: number;
  tier: string;
  bonusCredits: number;
}

export default function MiraCreditBar({ wsId }: MiraCreditBarProps) {
  const t = useTranslations('dashboard.mira_chat');

  const { data } = useQuery<CreditData>({
    queryKey: ['ai-credits', wsId],
    queryFn: () =>
      fetch(`/api/v1/workspaces/${wsId}/ai/credits`, {
        cache: 'no-store',
      }).then((r) => {
        if (!r.ok) throw new Error('Failed to fetch credits');
        return r.json();
      }),
    staleTime: 60_000, // Re-fetch at most once per minute
    refetchOnWindowFocus: false,
  });

  if (!data || data.totalAllocated + data.bonusCredits === 0) return null;

  const total = data.totalAllocated + data.bonusCredits;
  const percentRemaining = Math.max(
    0,
    Math.min(100, ((total - data.totalUsed) / total) * 100)
  );

  return (
    <div className="flex items-center gap-2" title={t('credits_remaining')}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            percentRemaining > 30
              ? 'bg-dynamic-green'
              : percentRemaining > 10
                ? 'bg-dynamic-yellow'
                : 'bg-dynamic-red'
          )}
          style={{ width: `${percentRemaining}%` }}
        />
      </div>
      <span className="font-mono text-[10px] text-muted-foreground">
        {Math.round(percentRemaining)}%
      </span>
    </div>
  );
}
