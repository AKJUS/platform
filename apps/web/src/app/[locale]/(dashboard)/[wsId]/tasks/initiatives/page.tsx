import { createClient } from '@tuturuuu/supabase/next/server';
import { getCurrentUser } from '@tuturuuu/utils/user-helper';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import WorkspaceWrapper from '@/components/workspace-wrapper';
import { TaskInitiativesClient } from './task-initiatives-client';

export const metadata: Metadata = {
  title: 'Task Initiatives',
  description: 'Group projects into strategic initiatives for your workspace.',
};

interface Props {
  params: Promise<{
    wsId: string;
  }>;
}

type InitiativeRow = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  created_at: string;
  creator: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  task_project_initiatives: {
    project_id: string;
    project: {
      id: string;
      name: string;
      status: string | null;
    } | null;
  }[] | null;
};

export default async function TaskInitiativesPage({ params }: Props) {
  return (
    <WorkspaceWrapper params={params}>
      {async ({ wsId }) => {
        const supabase = await createClient();

        const currentUser = await getCurrentUser();
        if (!currentUser) {
          notFound();
        }

        const { withoutPermission } = await getPermissions({ wsId });
        if (withoutPermission('manage_projects')) {
          notFound();
        }

        const { data: initiativesData, error } = await supabase
          .from('task_initiatives')
          .select(
            `
              *,
              creator:users!task_initiatives_creator_id_fkey(
                id,
                display_name,
                avatar_url
              ),
              task_project_initiatives(
                project_id,
                project:task_projects(
                  id,
                  name,
                  status
                )
              )
            `
          )
          .eq('ws_id', wsId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching task initiatives:', error);
          notFound();
        }

        const initiatives =
          (initiativesData as InitiativeRow[] | null)?.map((initiative) => ({
            id: initiative.id,
            name: initiative.name,
            description: initiative.description,
            status: initiative.status,
            created_at: initiative.created_at,
            creator: initiative.creator,
            projectsCount: initiative.task_project_initiatives?.length ?? 0,
            linkedProjects:
              initiative.task_project_initiatives?.flatMap((link) =>
                link.project ? [link.project] : []
              ) ?? [],
          })) ?? [];

        return (
          <div className="space-y-6">
            <div>
              <h1 className="font-bold text-2xl">Task Initiatives</h1>
              <p className="text-muted-foreground">
                Organize related projects into higher-level initiatives to track
                strategic outcomes.
              </p>
            </div>

            <TaskInitiativesClient
              wsId={wsId}
              initialInitiatives={initiatives}
            />
          </div>
        );
      }}
    </WorkspaceWrapper>
  );
}
