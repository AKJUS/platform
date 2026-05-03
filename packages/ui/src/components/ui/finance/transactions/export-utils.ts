import {
  listTransactionExportRows,
  type TransactionExportRow,
} from '@tuturuuu/internal-api/finance';

export type { TransactionExportRow };

export type ExportSummary = {
  totalTransactions: number;
  totalIncome: number;
  totalExpense: number;
  netTotal: number;
  hasRedactedAmounts: boolean;
};

/**
 * Calculates summary statistics from exported transaction data
 *
 * Note: Expense amounts are stored as negative values in the database,
 * so we use Math.abs() to get the positive total for display purposes.
 *
 * @param data - Array of transaction export rows
 * @returns Summary object with totals and redaction flag
 */
export function calculateExportSummary(
  data: TransactionExportRow[]
): ExportSummary {
  let totalIncome = 0;
  let totalExpense = 0;
  let hasRedactedAmounts = false;

  for (const row of data) {
    if (row.amount === null) {
      hasRedactedAmounts = true;
      continue;
    }
    if (row.transaction_type === 'income') {
      totalIncome += row.amount;
    } else if (row.transaction_type === 'expense') {
      // Use Math.abs since expense amounts are stored as negative values
      totalExpense += Math.abs(row.amount);
    }
  }

  return {
    totalTransactions: data.length,
    totalIncome,
    totalExpense,
    netTotal: totalIncome - totalExpense,
    hasRedactedAmounts,
  };
}

/**
 * Fetches paginated transaction data for export
 *
 * @param wsId - Workspace ID
 * @param params - Query parameters for filtering and pagination
 * @returns Object containing transaction data array and total count
 */
export async function getData(
  wsId: string,
  {
    q,
    page = '1',
    pageSize = '10',
    userIds,
    categoryIds,
    walletIds,
    tagIds,
    start,
    end,
  }: {
    q?: string;
    page?: string;
    pageSize?: string;
    userIds?: string | string[];
    categoryIds?: string | string[];
    walletIds?: string | string[];
    tagIds?: string | string[];
    start?: string;
    end?: string;
  }
) {
  return listTransactionExportRows(wsId, {
    q,
    page,
    pageSize,
    userIds,
    categoryIds,
    walletIds,
    tagIds,
    start,
    end,
  });
}
