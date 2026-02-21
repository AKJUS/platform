import { Suspense } from 'react';
import DashboardCardSkeleton from '../dashboard-card-skeleton';
import CompactCalendarSummary from './compact-calendar-summary';
import CompactTasksSummary from './compact-tasks-summary';

interface DashboardInsightsProps {
  wsId: string;
  userId: string;
}

export default function DashboardInsights({
  wsId,
  userId,
}: DashboardInsightsProps) {
  return (
    <div className="space-y-3">
      <Suspense fallback={<DashboardCardSkeleton />}>
        <CompactTasksSummary wsId={wsId} userId={userId} />
      </Suspense>
      <Suspense fallback={<DashboardCardSkeleton />}>
        <CompactCalendarSummary wsId={wsId} />
      </Suspense>
    </div>
  );
}
