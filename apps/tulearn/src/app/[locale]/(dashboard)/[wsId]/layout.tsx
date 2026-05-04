import {
  getTulearnBootstrap,
  withForwardedInternalApiAuth,
} from '@tuturuuu/internal-api';
import { headers } from 'next/headers';
import { LearnerShell, NoWorkspaceState } from '@/components/learner-shell';

export default async function DashboardLayout({
  children,
  params,
  searchParams,
}: {
  children: React.ReactNode;
  params: Promise<{ wsId: string }>;
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { wsId } = await params;
  const { studentId } = await searchParams;
  const requestHeaders = await headers();
  const bootstrap = await getTulearnBootstrap(
    withForwardedInternalApiAuth(requestHeaders)
  );

  if (!bootstrap.workspaces.length) {
    return <NoWorkspaceState />;
  }

  return (
    <LearnerShell
      bootstrap={bootstrap}
      selectedStudentId={studentId}
      wsId={wsId}
    >
      {children}
    </LearnerShell>
  );
}
