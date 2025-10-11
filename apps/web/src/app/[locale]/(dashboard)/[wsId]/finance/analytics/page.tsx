import AnalyticsPage from '@tuturuuu/ui/finance/analytics/analytics-page';
import WorkspaceWrapper from '@/components/workspace-wrapper';
import type { Metadata } from 'next';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'View analytics in the Finance area of your Tuturuuu workspace.',
};

interface Props {
  params: Promise<{
    wsId: string;
  }>;
}

export default async function WorkspaceAnalyticsPage({ params }: Props) {
  return (
    <WorkspaceWrapper params={params}>
      {async ({ wsId }) => {
        const { withoutPermission } = await getPermissions({
          wsId,
        });
        if (withoutPermission('view_finance_stats')) notFound();

        return <AnalyticsPage wsId={wsId} />;
      }}
    </WorkspaceWrapper>
  );
}
