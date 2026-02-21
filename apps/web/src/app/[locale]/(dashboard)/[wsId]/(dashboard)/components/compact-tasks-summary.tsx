import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ListTodo,
} from '@tuturuuu/icons';
import { createClient } from '@tuturuuu/supabase/next/server';
import { Button } from '@tuturuuu/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@tuturuuu/ui/card';
import { cn } from '@tuturuuu/utils/format';
import { isPast, isToday } from 'date-fns';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

interface CompactTasksSummaryProps {
  wsId: string;
  userId: string;
}

export default async function CompactTasksSummary({
  wsId,
  userId,
}: CompactTasksSummaryProps) {
  const supabase = await createClient();
  const t = await getTranslations('dashboard');

  const { data: rpcTasks, error } = await supabase.rpc(
    'get_user_accessible_tasks',
    {
      p_user_id: userId,
      p_ws_id: wsId,
      p_include_deleted: false,
      p_list_statuses: ['not_started', 'active'],
      p_exclude_personally_completed: true,
      p_exclude_personally_unassigned: true,
    }
  );

  if (error) {
    console.error('Error fetching tasks summary:', error);
    return null;
  }

  let overdue = 0;
  let dueToday = 0;
  const total = rpcTasks?.length ?? 0;

  rpcTasks?.forEach((task) => {
    if (task.task_end_date) {
      const endDate = new Date(task.task_end_date);
      if (isPast(endDate) && !isToday(endDate)) overdue++;
      else if (isToday(endDate)) dueToday++;
    }
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-semibold text-sm">
            <ListTodo className="h-4 w-4 text-dynamic-orange" />
            {t('compact_tasks_title')}
          </CardTitle>
          <Link href={`/${wsId}/tasks`}>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              {t('view_all')}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {total === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <CheckCircle2 className="h-4 w-4 text-dynamic-green" />
            <span>{t('compact_tasks_empty')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="font-bold text-2xl">{total}</div>
            <div className="flex flex-col gap-0.5 text-xs">
              {overdue > 0 && (
                <span
                  className={cn(
                    'flex items-center gap-1 font-medium text-dynamic-red'
                  )}
                >
                  <AlertCircle className="h-3 w-3" />
                  {t('compact_tasks_overdue', { count: overdue })}
                </span>
              )}
              {dueToday > 0 && (
                <span className="flex items-center gap-1 text-dynamic-orange">
                  {t('compact_tasks_today', { count: dueToday })}
                </span>
              )}
              {overdue === 0 && dueToday === 0 && (
                <span className="text-muted-foreground">
                  {t('compact_tasks_upcoming')}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
