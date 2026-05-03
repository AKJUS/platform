'use client';

import { TransactionTypeFilter } from '@tuturuuu/ui/finance/transactions/transaction-type-filter';
import { parseAsInteger, parseAsStringLiteral, useQueryState } from 'nuqs';

const TRANSACTION_TYPES = ['income', 'expense'] as const;

export type TransactionTypeFilterValue =
  | (typeof TRANSACTION_TYPES)[number]
  | 'all';

export function TransactionTypeFilterWrapper() {
  const [currentTransactionType, setTransactionType] = useQueryState(
    'transactionType',
    parseAsStringLiteral(TRANSACTION_TYPES).withOptions({
      shallow: true,
    })
  );

  const [, setPage] = useQueryState(
    'page',
    parseAsInteger.withDefault(1).withOptions({
      shallow: true,
    })
  );

  const handleTransactionTypeChange = async (
    value: TransactionTypeFilterValue
  ) => {
    await setTransactionType(value === 'all' ? null : value);
    await setPage(1);
  };

  return (
    <TransactionTypeFilter
      value={currentTransactionType ?? 'all'}
      onChange={handleTransactionTypeChange}
    />
  );
}
