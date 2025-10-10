import InvoiceDetailsPage from '@tuturuuu/ui/finance/invoices/invoiceId/invoice-details-page';
import type { Metadata } from 'next';
import WorkspaceWrapper from '@/components/workspace-wrapper';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Invoice Details',
  description:
    'Manage Invoice Details in the Invoices area of your Tuturuuu workspace.',
};

interface Props {
  params: Promise<{
    wsId: string;
    invoiceId: string;
    locale: string;
  }>;
}

export default async function WorkspaceInvoiceDetailsPage({ params }: Props) {
  return (
    <WorkspaceWrapper params={params}>
      {async ({ wsId, invoiceId, locale }) => {
        const { withoutPermission, containsPermission } = await getPermissions({
          wsId,
        });
        if (withoutPermission('view_invoices')) notFound();

        const canUpdateInvoices = containsPermission('update_invoices');
        return (
          <InvoiceDetailsPage wsId={wsId} invoiceId={invoiceId} locale={locale} canUpdateInvoices={canUpdateInvoices} />
        )
      }}
    </WorkspaceWrapper>
  )
}
