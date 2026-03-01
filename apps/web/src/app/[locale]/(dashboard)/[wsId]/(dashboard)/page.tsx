import { createClient } from '@tuturuuu/supabase/next/server';
import { getCurrentUser } from '@tuturuuu/utils/user-helper';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LoadingStatisticCard from '@/components/loading-statistic-card';
import WorkspaceWrapper from '@/components/workspace-wrapper';
import DashboardInsights from './components/dashboard-insights';
import MiraDashboardClient from './components/mira-dashboard-client';
import PermissionSetupBanner from './permission-setup-banner';
import UserGroupQuickActions from './user-groups/quick-actions';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your personal AI-powered workspace dashboard.',
};

interface Props {
  params: Promise<{
    wsId: string;
  }>;
}

export default async function WorkspaceHomePage({ params }: Props) {
  return (
    <WorkspaceWrapper params={params} fallback={<LoadingStatisticCard />}>
      {async ({ workspace, wsId }) => {
        const currentUser = await getCurrentUser();
        if (!currentUser) notFound();

        const permissions = await getPermissions({ wsId });
        if (!permissions) notFound();

        // Fetch mira_soul for assistant name
        const supabase = await createClient();
        const { data: soul } = await supabase
          .from('mira_soul')
          .select('name')
          .eq('user_id', currentUser.id)
          .maybeSingle();

        const assistantName = soul?.name ?? 'Mira';

        return (
          <>
            {/* Permission setup banner for workspace creators */}
            {!workspace.personal && (
              <PermissionSetupBanner
                wsId={wsId}
                isCreator={workspace.creator_id === currentUser.id}
              />
            )}

            <UserGroupQuickActions wsId={wsId} />

            <MiraDashboardClient
              currentUser={currentUser}
              initialAssistantName={assistantName}
              wsId={wsId}
            >
              <DashboardInsights wsId={wsId} userId={currentUser.id} />
            </MiraDashboardClient>
          </>
        );
      }}
    </WorkspaceWrapper>
  );
}
