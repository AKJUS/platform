'use client';

import {
  ArrowDownCircle,
  ArrowUpCircle,
  CircleDollarSign,
} from '@tuturuuu/icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tuturuuu/ui/select';
import { cn } from '@tuturuuu/utils/format';
import { useTranslations } from 'next-intl';
import type { TransactionTypeFilterValue } from './transaction-type-filter-wrapper';

interface TransactionTypeFilterProps {
  value: TransactionTypeFilterValue;
  onChange: (value: TransactionTypeFilterValue) => void;
  className?: string;
}

const TYPE_OPTIONS = [
  {
    value: 'all',
    icon: CircleDollarSign,
    labelKey: 'all',
  },
  {
    value: 'income',
    icon: ArrowUpCircle,
    labelKey: 'income',
  },
  {
    value: 'expense',
    icon: ArrowDownCircle,
    labelKey: 'expense',
  },
] as const;

export function TransactionTypeFilter({
  value,
  onChange,
  className,
}: TransactionTypeFilterProps) {
  const t = useTranslations('transaction-data-table');
  const selectedOption =
    TYPE_OPTIONS.find((option) => option.value === value) ?? TYPE_OPTIONS[0];
  const SelectedIcon = selectedOption.icon;

  return (
    <Select
      value={value}
      onValueChange={(nextValue) =>
        onChange(nextValue as TransactionTypeFilterValue)
      }
    >
      <SelectTrigger
        className={cn('h-9 w-full gap-1.5 md:h-8 md:w-auto', className)}
      >
        <SelectedIcon
          className={cn(
            'h-3.5 w-3.5',
            selectedOption.value === 'income' && 'text-dynamic-green',
            selectedOption.value === 'expense' && 'text-dynamic-red'
          )}
        />
        <SelectValue placeholder={t('all')} />
      </SelectTrigger>
      <SelectContent align="start">
        {TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;

          return (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    'h-4 w-4',
                    option.value === 'income' && 'text-dynamic-green',
                    option.value === 'expense' && 'text-dynamic-red'
                  )}
                />
                {t(option.labelKey)}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
