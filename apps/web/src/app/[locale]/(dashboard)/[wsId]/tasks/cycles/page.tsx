import { createClient } from '@tuturuuu/supabase/next/server';
import { getCurrentUser } from '@tuturuuu/utils/user-helper';
import { getPermissions } from '@tuturuuu/utils/workspace-helper';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import WorkspaceWrapper from '@/components/workspace-wrapper';
import { TaskCyclesClient } from './task-cycles-client';

export const metadata: Metadata = {
  title: 'Task Cycles',
  description: 'Plan and track time-boxed sprints for tasks.',
};

interface Props {
  params: Promise<{
    wsId: string;
  }>;
}

type CycleRow = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  creator: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  task_cycle_tasks: { task_id: string }[] | null;
};

export default async function TaskCyclesPage({ params }: Props) {
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

        const { data: cyclesData, error } = await supabase
          .from('task_cycles')
          .select(
            `
              *,
              creator:users!task_cycles_creator_id_fkey(
                id,
                display_name,
                avatar_url
              ),
              task_cycle_tasks(
                task_id
              )
            `
          )
          .eq('ws_id', wsId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching task cycles:', error);
          notFound();
        }

        const toCycleStatus = (value: string | null) => {
          const allowed = [
            'planned',
            'active',
            'completed',
            'cancelled',
          ] as const;
          if (!value) return null;
          return allowed.includes(value as (typeof allowed)[number])
            ? (value as (typeof allowed)[number])
            : null;
        };

        const cycles =
          (cyclesData as CycleRow[] | null)?.map((cycle) => ({
            id: cycle.id,
            name: cycle.name,
            description: cycle.description,
            status: toCycleStatus(cycle.status),
            start_date: cycle.start_date,
            end_date: cycle.end_date,
            created_at: cycle.created_at,
            creator: cycle.creator,
            tasksCount: cycle.task_cycle_tasks?.length ?? 0,
          })) ?? [];

        return (
          <div className="space-y-6">
            <div>
              <h1 className="font-bold text-2xl">Task Cycles</h1>
              <p className="text-muted-foreground">
                Time-box work into cycles (sprints) and track progress.
              </p>
            </div>

            <TaskCyclesClient wsId={wsId} initialCycles={cycles} />
          </div>
        );
      }}
    </WorkspaceWrapper>
  );
}
