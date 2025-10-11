import WorkspaceWrapper from '@/components/workspace-wrapper';
import TransactionsPage from '@tuturuuu/ui/finance/transactions/transactions-page';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Transactions',
  description:
    'Manage Transactions in the Finance area of your Tuturuuu workspace.',
};

interface Props {
  params: Promise<{
    wsId: string;
  }>;
  searchParams: Promise<{
    q: string;
    page: string;
    pageSize: string;
  }>;
}

export default async function WorkspaceTransactionsPage({
  params,
  searchParams,
}: Props) {
  return (
    <WorkspaceWrapper params={params}>
      {async ({ wsId }) => {
        const sp = await searchParams;
        return <TransactionsPage wsId={wsId} searchParams={sp} />;
      }}
    </WorkspaceWrapper>
  );
}
