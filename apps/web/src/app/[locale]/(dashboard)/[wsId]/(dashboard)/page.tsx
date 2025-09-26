import { createClient } from '@tuturuuu/supabase/next/server';
import type { AuroraForecast } from '@tuturuuu/types/db';
import { ROOT_WORKSPACE_ID } from '@tuturuuu/utils/constants';
import { isValidTuturuuuEmail } from '@tuturuuu/utils/email/client';
import { getCurrentUser } from '@tuturuuu/utils/user-helper';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoadingStatisticCard from '@/components/loading-statistic-card';
import WorkspaceWrapper from '@/components/workspace-wrapper';
import UpcomingCalendarEvents from './calendar/upcoming-events';
import Countdown from './countdown';
import DashboardCardSkeleton from './dashboard-card-skeleton';
import NewlyCreatedTasks from './tasks/newly-created-tasks';
import TasksAssignedToMe from './tasks/tasks-assigned-to-me';
import TimeTrackingMetrics from './time-tracker/time-tracking-metrics';
import RecentTumeetPlans from './tumeet/recent-plans';

export const metadata: Metadata = {
  title: 'Workspace Details',
  description:
    'Manage Workspace Details in the Dashboard area of your Tuturuuu workspace.',
};

interface Props {
  params: Promise<{
    wsId: string;
  }>;
}

export default async function WorkspaceHomePage({ params }: Props) {
  return (
    <WorkspaceWrapper params={params} fallback={<LoadingStatisticCard />}>
      {async ({ workspace, wsId, isPersonal }) => {
        // At this point, wsId is guaranteed to be a validated UUID
        // and workspace contains the full workspace object with role and joined status

        const currentUser = await getCurrentUser();
        const forecast = await getForecast();
        const mlMetrics = await getMLMetrics();
        const statsMetrics = await getStatsMetrics();

        if (!forecast || !mlMetrics || !statsMetrics) {
          return <LoadingStatisticCard />;
        }

        const { withoutPermission } = await getPermissions({
          wsId, // This is the validated UUID, not the legacy identifier
        });

        const isInternalUser = isValidTuturuuuEmail(currentUser?.email);
        const disableCalendar = withoutPermission('manage_calendar');

        return (
          <>
            {isInternalUser && wsId === ROOT_WORKSPACE_ID && <Countdown />}
            {currentUser && (
              <div className="grid gap-4 pb-4 md:grid-cols-2">
                {!isPersonal && (
                  <Suspense fallback={<DashboardCardSkeleton />}>
                    <NewlyCreatedTasks wsId={wsId} />
                  </Suspense>
                )}

                <Suspense fallback={<DashboardCardSkeleton />}>
                  <TasksAssignedToMe
                    wsId={wsId}
                    userId={currentUser.id}
                    isPersonal={workspace.personal}
                  />
                </Suspense>

                <Suspense fallback={<DashboardCardSkeleton />}>
                  <UpcomingCalendarEvents
                    wsId={wsId}
                    showNavigation={!disableCalendar}
                  />
                </Suspense>

                <Suspense fallback={<DashboardCardSkeleton />}>
                  <TimeTrackingMetrics
                    wsId={wsId}
                    userId={currentUser.id}
                    isPersonal={workspace.personal}
                  />
                </Suspense>

                <Suspense fallback={<DashboardCardSkeleton />}>
                  <RecentTumeetPlans
                    className={
                      disableCalendar || isPersonal
                        ? 'col-span-1'
                        : 'col-span-full'
                    }
                  />
                </Suspense>
              </div>
            )}
          </>
        );
      }}
    </WorkspaceWrapper>
  );
}

async function getForecast() {
  const supabase = await createClient();

  const { data: statistical_forecast, error: statError } = await supabase
    .from('aurora_statistical_forecast')
    .select('*')
    .order('date', { ascending: true });

  if (statError) throw new Error('Error fetching statistical forecast');

  const { data: ml_forecast, error: mlError } = await supabase
    .from('aurora_ml_forecast')
    .select('*')
    .order('date', { ascending: true });

  if (mlError) throw new Error('Error fetching ML forecast');

  return {
    statistical_forecast: statistical_forecast?.map((item) => ({
      ...item,
      date: new Date(item.date).toISOString().split('T')[0],
    })),
    ml_forecast: ml_forecast?.map((item) => ({
      ...item,
      date: new Date(item.date).toISOString().split('T')[0],
    })),
  } as AuroraForecast;
}

async function getMLMetrics() {
  const supabase = await createClient();

  const { data } = await supabase.from('aurora_ml_metrics').select('*');

  return data;
}

async function getStatsMetrics() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('aurora_statistical_metrics')
    .select('*');

  return data;
}
