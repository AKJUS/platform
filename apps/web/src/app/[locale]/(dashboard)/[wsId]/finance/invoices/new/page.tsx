import WorkspaceWrapper from '@/components/workspace-wrapper';
import NewInvoicePage from '@tuturuuu/ui/finance/invoices/new-invoice-page';
import type { Metadata } from 'next';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import { notFound } from 'next/navigation';


export const metadata: Metadata = {
  title: 'New',
  description: 'Manage New in the Invoices area of your Tuturuuu workspace.',
};

interface Props {
  params: Promise<{
    wsId: string;
  }>;
}

export default async function WorkspaceInvoicesPage({ params }: Props) {
  return (
    <WorkspaceWrapper params={params}>
      {async ({ wsId }) =>{
        const { withoutPermission } = await getPermissions({
          wsId,
        });
        if (withoutPermission('create_invoices')) notFound();
        return <NewInvoicePage wsId={wsId}  />
      }}
    </WorkspaceWrapper>
  );
}
