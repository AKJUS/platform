'use client';

import { Badge } from '@tuturuuu/ui/badge';
import { Timer } from '@tuturuuu/ui/icons';
import { cn } from '@tuturuuu/utils/format';

interface TaskEstimationDisplayProps {
  points: number | null | undefined;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  estimationType?: string | null; // 't-shirt' etc.
}

export function TaskEstimationDisplay({
  points,
  className,
  showIcon = true,
  size = 'sm',
  estimationType,
}: TaskEstimationDisplayProps) {
  if (points == null) return null;

  const sizeClasses = {
    sm: 'h-5 px-1.5 py-0.5 text-[10px]',
    md: 'h-6 px-2 py-1 text-xs',
    lg: 'h-7 px-2.5 py-1.5 text-sm',
  };

  const iconSizes = {
    sm: 'h-2.5 w-2.5',
    md: 'h-3 w-3',
    lg: 'h-3.5 w-3.5',
  };

  let display = String(points);
  if (estimationType === 't-shirt') {
    const map: Record<number, string> = {
      0: '-',
      1: 'XS',
      2: 'S',
      3: 'M',
      4: 'L',
      5: 'XL',
      6: 'XXL',
      7: 'XXXL',
    };
    display = map[points] || String(points);
  } else if (estimationType === 'fibonacci') {
    const fibMap: Record<number, string> = {
      0: '0',
      1: '1',
      2: '2',
      3: '3',
      4: '5',
      5: '8',
      6: '13',
      7: '21',
    };
    display = fibMap[points] || String(points);
  } else if (estimationType === 'exponential') {
    const expMap: Record<number, string> = {
      0: '0',
      1: '1',
      2: '2',
      3: '4',
      4: '8',
      5: '16',
      6: '32',
      7: '64',
    };
    display = expMap[points] || String(points);
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        'inline-flex items-center gap-1 border-dynamic-pink/20 bg-dynamic-pink/10 font-semibold text-dynamic-pink',
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Timer className={iconSizes[size]} />}
      {display}
    </Badge>
  );
}
