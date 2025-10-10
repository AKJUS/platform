import FeatureSummary from '@tuturuuu/ui/custom/feature-summary';
import ExportDialogContent from '@tuturuuu/ui/finance/transactions/export-dialog-content';
import { TransactionForm } from '@tuturuuu/ui/finance/transactions/form';
import { TransactionsInfinitePage } from '@tuturuuu/ui/finance/transactions/transactions-infinite-page';
import { Separator } from '@tuturuuu/ui/separator';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

interface Props {
  wsId: string;
  searchParams: {
    q: string;
    page: string;
    pageSize: string;
    userIds?: string | string[];
    categoryIds?: string | string[];
  };
}

export default async function TransactionsPage({ wsId, searchParams }: Props) {
  const t = await getTranslations();

  const { containsPermission} = await getPermissions({
    wsId,
  });

  const canViewTransactions = containsPermission('view_transactions');
  const canExportFinanceData = containsPermission('export_finance_data');
  const canCreateTransactions = containsPermission('create_transactions');
  const canUpdateTransactions = containsPermission('update_transactions');
  const canDeleteTransactions = containsPermission('delete_transactions');

  if (!canViewTransactions) return notFound();

  return (
    <>
      <FeatureSummary
        pluralTitle={t('ws-transactions.plural')}
        singularTitle={t('ws-transactions.singular')}
        description={t('ws-transactions.description')}
        createTitle={t('ws-transactions.create')}
        createDescription={t('ws-transactions.create_description')}
        form={canCreateTransactions ? <TransactionForm wsId={wsId} canCreateTransactions={canCreateTransactions} /> : undefined}
      />
      <Separator className="my-4" />
      <TransactionsInfinitePage
        wsId={wsId}
        canExport={canExportFinanceData}
        exportContent={
          <ExportDialogContent
            wsId={wsId}
            exportType="transactions"
            searchParams={searchParams}
          />
        }
        canUpdateTransactions={canUpdateTransactions}
        canDeleteTransactions={canDeleteTransactions}
      />
    </>
  );
}
