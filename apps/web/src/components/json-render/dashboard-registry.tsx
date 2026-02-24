'use client';

import {
  defineRegistry,
  useActions,
  useBoundProp,
  useStateStore,
  useStateValue,
} from '@json-render/react';
import { useQuery } from '@tanstack/react-query';
import { dashboardCatalog } from '@tuturuuu/ai/tools/json-render-catalog';
import * as Icons from '@tuturuuu/icons';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Dices,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
} from '@tuturuuu/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@tuturuuu/ui/avatar';
import { Badge } from '@tuturuuu/ui/badge';
import { Button } from '@tuturuuu/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tuturuuu/ui/card';
import { Checkbox } from '@tuturuuu/ui/checkbox';
import { useWorkspaceUser } from '@tuturuuu/ui/hooks/use-workspace-user';
import { Input } from '@tuturuuu/ui/input';
import { Label } from '@tuturuuu/ui/label';
import { Progress } from '@tuturuuu/ui/progress';
import { RadioGroup, RadioGroupItem } from '@tuturuuu/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tuturuuu/ui/select';
import { Separator } from '@tuturuuu/ui/separator';
import { Textarea } from '@tuturuuu/ui/textarea';
import { MyTasksFilters } from '@tuturuuu/ui/tu-do/my-tasks/my-tasks-filters';
import { MyTasksHeader } from '@tuturuuu/ui/tu-do/my-tasks/my-tasks-header';
import TaskList from '@tuturuuu/ui/tu-do/my-tasks/task-list';
import { useMyTasksState } from '@tuturuuu/ui/tu-do/my-tasks/use-my-tasks-state';
import { cn } from '@tuturuuu/utils/format';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

const useComponentValue = <T,>(
  propValue: T | undefined,
  bindingPath: string | undefined,
  fallbackName: string | undefined,
  defaultValue: T
): [T, (val: T) => void] => {
  const { set } = useStateStore();

  // Use absolute JSON pointer for fallback (e.g. "/amount")
  const fallbackPath = fallbackName ? `/${fallbackName}` : undefined;
  const path = bindingPath || fallbackPath;

  const boundValue = useStateValue<T>(path || '');

  const setValue = useCallback(
    (val: T) => {
      if (path) set(path, val);
    },
    [path, set]
  );

  return [(boundValue ?? propValue ?? defaultValue) as T, setValue];
};

function formatDurationLabel(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function resolveStatsRange(
  period?: string,
  dateFrom?: string,
  dateTo?: string
): { from: Date; to: Date; label: string } {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  const setStartOfDay = (date: Date) => date.setHours(0, 0, 0, 0);
  const setEndOfDay = (date: Date) => date.setHours(23, 59, 59, 999);

  switch (period) {
    case 'today': {
      setStartOfDay(start);
      setEndOfDay(end);
      return { from: start, to: end, label: 'Today' };
    }
    case 'this_week': {
      const day = start.getDay();
      const daysToSubtract = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - daysToSubtract);
      setStartOfDay(start);
      setEndOfDay(end);
      return { from: start, to: end, label: 'This week' };
    }
    case 'this_month': {
      start.setDate(1);
      setStartOfDay(start);
      setEndOfDay(end);
      return { from: start, to: end, label: 'This month' };
    }
    case 'last_30_days': {
      start.setDate(start.getDate() - 29);
      setStartOfDay(start);
      setEndOfDay(end);
      return { from: start, to: end, label: 'Last 30 days' };
    }
    case 'custom': {
      const parsedFrom = dateFrom ? new Date(dateFrom) : null;
      const parsedTo = dateTo ? new Date(dateTo) : null;
      if (parsedFrom && parsedTo && !Number.isNaN(parsedFrom.getTime()) && !Number.isNaN(parsedTo.getTime())) {
        return {
          from: parsedFrom,
          to: parsedTo,
          label: 'Custom range',
        };
      }
      start.setDate(start.getDate() - 6);
      setStartOfDay(start);
      setEndOfDay(end);
      return { from: start, to: end, label: 'Last 7 days' };
    }
    case 'last_7_days':
    default: {
      start.setDate(start.getDate() - 6);
      setStartOfDay(start);
      setEndOfDay(end);
      return { from: start, to: end, label: 'Last 7 days' };
    }
  }
}

type SignedUploadResponse = {
  uploads: Array<{
    filename: string;
    signedUrl: string;
    token: string;
    path: string;
  }>;
};

function collectFilesFromValue(value: unknown): File[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is File => item instanceof File);
}

async function uploadTimeTrackingRequestFiles(
  wsId: string,
  requestId: string,
  files: File[]
): Promise<string[]> {
  if (files.length === 0) return [];

  const uploadUrlRes = await fetch(
    `/api/v1/workspaces/${encodeURIComponent(wsId)}/time-tracking/requests/upload-url`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        files: files.map((file) => ({ filename: file.name })),
      }),
    }
  );

  if (!uploadUrlRes.ok) {
    const body = await uploadUrlRes.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error || 'Failed to prepare file upload'
    );
  }

  const uploadData = (await uploadUrlRes.json()) as SignedUploadResponse;
  if (!Array.isArray(uploadData.uploads) || uploadData.uploads.length !== files.length) {
    throw new Error('Upload URL response is invalid');
  }

  await Promise.all(
    uploadData.uploads.map(async (upload, index) => {
      const file = files[index];
      if (!file) return;

      const fileUploadRes = await fetch(upload.signedUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${upload.token}`,
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!fileUploadRes.ok) {
        throw new Error(`Failed to upload file "${file.name}"`);
      }
    })
  );

  return uploadData.uploads.map((upload) => upload.path);
}

export const { registry, handlers, executeAction } = defineRegistry(
  dashboardCatalog,
  {
    components: {
      Card: ({ props, children }) => (
        <Card className="my-2 border border-border/60 bg-card/60">
          {(props.title || props.description) && (
            <CardHeader>
              {props.title && (
                <CardTitle className="text-lg">{props.title}</CardTitle>
              )}
              {props.description && (
                <CardDescription>{props.description}</CardDescription>
              )}
            </CardHeader>
          )}
          <CardContent
            className={cn(!props.title && !props.description && 'pt-6')}
          >
            {children}
          </CardContent>
        </Card>
      ),
      Stack: ({ props, children }) => (
        <div
          className={cn(
            'flex',
            props.direction === 'horizontal' ? 'flex-row' : 'flex-col',
            props.align === 'start' && 'items-start',
            props.align === 'center' && 'items-center',
            props.align === 'end' && 'items-end',
            props.align === 'stretch' && 'items-stretch',
            props.justify === 'start' && 'justify-start',
            props.justify === 'center' && 'justify-center',
            props.justify === 'end' && 'justify-end',
            props.justify === 'between' && 'justify-between',
            props.justify === 'around' && 'justify-around'
          )}
          style={{ gap: props.gap ? `${props.gap}px` : '1rem' }}
        >
          {children}
        </div>
      ),
      Grid: ({ props, children }) => (
        <div
          className="grid w-full"
          style={{
            gridTemplateColumns: `repeat(${props.cols || 1}, minmax(0, 1fr))`,
            gap: props.gap ? `${props.gap}px` : '1rem',
          }}
        >
          {children}
        </div>
      ),
      Text: ({ props }) => {
        const Component =
          props.variant === 'p' || !props.variant
            ? 'p'
            : (props.variant as any);
        return (
          <Component
            className={cn(
              props.variant === 'small' && 'text-sm',
              props.variant === 'tiny' && 'text-xs',
              props.weight === 'medium' && 'font-medium',
              props.weight === 'semibold' && 'font-semibold',
              props.weight === 'bold' && 'font-bold',
              props.color === 'muted' && 'text-muted-foreground',
              props.color === 'primary' && 'text-primary',
              props.color === 'success' && 'text-dynamic-green',
              props.color === 'warning' && 'text-dynamic-yellow',
              props.color === 'error' && 'text-dynamic-red',
              props.align === 'center' && 'text-center',
              props.align === 'right' && 'text-right'
            )}
          >
            {props.content}
          </Component>
        );
      },
      Icon: ({ props }) => {
        const IconComp = (Icons as any)[props.name];
        if (!IconComp) return null;
        return (
          <IconComp size={props.size || 16} style={{ color: props.color }} />
        );
      },
      Badge: ({ props }) => (
        <Badge variant={(props.variant as any) || 'default'}>
          {props.label}
        </Badge>
      ),
      Avatar: ({ props }) => (
        <Avatar style={{ width: props.size || 32, height: props.size || 32 }}>
          {props.src && <AvatarImage src={props.src} />}
          <AvatarFallback>{props.fallback || '?'}</AvatarFallback>
        </Avatar>
      ),
      Separator: ({ props }) => (
        <Separator orientation={props.orientation || 'horizontal'} />
      ),
      Progress: ({ props }) => (
        <div className="flex w-full flex-col gap-2">
          {(props.label || props.showValue) && (
            <div className="flex items-center justify-between text-xs">
              {props.label && (
                <span className="font-medium text-muted-foreground">
                  {props.label}
                </span>
              )}
              {props.showValue && (
                <span className="font-mono text-muted-foreground">
                  {Math.round(props.value)}%
                </span>
              )}
            </div>
          )}
          <Progress value={props.value} className="h-2" />
        </div>
      ),
      Metric: ({ props }) => (
        <div className="flex flex-col gap-1 rounded-lg border bg-surface p-4 shadow-sm">
          <div className="font-medium text-muted-foreground text-sm">
            {props.title}
          </div>
          <div className="flex items-baseline gap-2">
            <div className="font-bold text-2xl">{props.value}</div>
            {props.trend && props.trendValue && (
              <div
                className={`font-semibold text-xs ${
                  props.trend === 'up'
                    ? 'text-dynamic-green'
                    : props.trend === 'down'
                      ? 'text-dynamic-red'
                      : 'text-muted-foreground'
                }`}
              >
                {props.trendValue}
              </div>
            )}
          </div>
        </div>
      ),
      MyTasks: ({ props }) => {
        const params = useParams();
        const wsId = params.wsId as string;
        const { data: user, isLoading: userLoading } = useWorkspaceUser();

        // Fetch workspace data to check if it's personal
        const { data: workspace, isLoading: workspaceLoading } = useQuery({
          queryKey: ['workspace', wsId],
          queryFn: async () => {
            const res = await fetch(`/api/workspaces/${wsId}`);
            if (!res.ok) return null;
            return res.json();
          },
          enabled: !!wsId,
        });

        const state = useMyTasksState({
          wsId,
          userId: user?.id || '',
          isPersonal: workspace?.personal || false,
        });

        if (userLoading || workspaceLoading)
          return (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          );

        if (!user || !workspace) return null;

        return (
          <div className="flex flex-col gap-6">
            {props.showSummary && (
              <MyTasksHeader
                overdueCount={state.filteredTasks.overdueTasks?.length ?? 0}
                todayCount={state.filteredTasks.todayTasks?.length ?? 0}
                upcomingCount={state.filteredTasks.upcomingTasks?.length ?? 0}
              />
            )}

            {props.showFilters && (
              <MyTasksFilters
                workspacesData={state.workspacesData || []}
                allBoardsData={state.allBoardsData}
                taskFilters={state.taskFilters}
                setTaskFilters={state.setTaskFilters}
                availableLabels={state.availableLabels}
                availableProjects={state.availableProjects}
                workspaceLabels={state.workspaceLabels}
                workspaceProjects={state.workspaceProjects}
                onFilterChange={state.handleFilterChange}
                onLabelFilterChange={state.handleLabelFilterChange}
                onProjectFilterChange={state.handleProjectFilterChange}
                onCreateNewBoard={() => state.setNewBoardDialogOpen(true)}
              />
            )}

            <TaskList
              wsId={wsId}
              userId={user.id}
              isPersonal={workspace.personal}
              commandBarLoading={state.commandBarLoading}
              queryLoading={state.queryLoading}
              overdueTasks={state.filteredTasks.overdueTasks}
              todayTasks={state.filteredTasks.todayTasks}
              upcomingTasks={state.filteredTasks.upcomingTasks}
              completedTasks={state.completedTasks}
              totalActiveTasks={
                (state.filteredTasks.overdueTasks?.length || 0) +
                (state.filteredTasks.todayTasks?.length || 0) +
                (state.filteredTasks.upcomingTasks?.length || 0)
              }
              totalCompletedTasks={state.totalCompletedTasks}
              hasMoreCompleted={state.hasMoreCompleted}
              isFetchingMoreCompleted={state.isFetchingMoreCompleted}
              onFetchMoreCompleted={state.fetchMoreCompleted}
              collapsedSections={state.collapsedSections}
              toggleSection={state.toggleSection}
              handleUpdate={state.handleUpdate}
              availableLabels={state.availableLabels}
              onCreateNewLabel={() => state.setNewLabelDialogOpen(true)}
            />
          </div>
        );
      },
      TimeTrackingStats: ({ props }) => {
        const params = useParams();
        const wsId = params.wsId as string;
        const maxItems = props.maxItems || 5;
        const showBreakdown = props.showBreakdown !== false;
        const showDailyBreakdown = props.showDailyBreakdown !== false;

        const { data: user, isLoading: userLoading } = useWorkspaceUser();

        const { data: workspace, isLoading: workspaceLoading } = useQuery({
          queryKey: ['workspace', wsId, 'time-tracking-stats-widget'],
          queryFn: async () => {
            const res = await fetch(`/api/workspaces/${wsId}`, {
              cache: 'no-store',
            });
            if (!res.ok) return null;
            return res.json();
          },
          enabled: !!wsId,
        });

        const range = resolveStatsRange(props.period, props.dateFrom, props.dateTo);

        const { data: stats, isLoading: statsLoading } = useQuery({
          queryKey: [
            'workspace',
            wsId,
            'time-tracking',
            'stats',
            'period',
            user?.id,
            range.from.toISOString(),
            range.to.toISOString(),
          ],
          queryFn: async () => {
            if (!user?.id) return null;

            const query = new URLSearchParams({
              dateFrom: range.from.toISOString(),
              dateTo: range.to.toISOString(),
              timezone: 'UTC',
              userId: user.id,
            });

            const res = await fetch(
              `/api/v1/workspaces/${encodeURIComponent(wsId)}/time-tracking/stats/period?${query.toString()}`,
              { cache: 'no-store' }
            );

            if (!res.ok) return null;
            return res.json();
          },
          enabled: !!wsId && !!user?.id && !!workspace,
        });

        if (userLoading || workspaceLoading || statsLoading) {
          return (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          );
        }

        if (!user || !workspace || !stats) {
          return (
            <Card className="my-2 border border-border/60 bg-card/60">
              <CardHeader>
                <CardTitle className="text-lg">Time Tracking Stats</CardTitle>
                <CardDescription>No stats available for this period.</CardDescription>
              </CardHeader>
            </Card>
          );
        }

        const totalDuration = Number(stats.totalDuration) || 0;
        const sessionCount = Number(stats.sessionCount) || 0;
        const averageDuration =
          sessionCount > 0 ? Math.round(totalDuration / sessionCount) : 0;

        const topBreakdown = Array.isArray(stats.breakdown)
          ? stats.breakdown.slice(0, maxItems)
          : [];

        const topDaily = Array.isArray(stats.dailyBreakdown)
          ? stats.dailyBreakdown.slice(0, maxItems)
          : [];

        const bestTimeOfDayLabel =
          typeof stats.bestTimeOfDay === 'string' && stats.bestTimeOfDay !== 'none'
            ? stats.bestTimeOfDay
            : 'N/A';

        return (
          <div className="flex flex-col gap-4">
            <Card className="my-2 border border-border/60 bg-card/60">
              <CardHeader>
                <CardTitle className="text-lg">Time Tracking Overview</CardTitle>
                <CardDescription>{range.label}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border bg-surface p-4">
                    <p className="text-muted-foreground text-sm">Total Time</p>
                    <p className="font-bold text-xl">{formatDurationLabel(totalDuration)}</p>
                  </div>
                  <div className="rounded-lg border bg-surface p-4">
                    <p className="text-muted-foreground text-sm">Sessions</p>
                    <p className="font-bold text-xl">{sessionCount}</p>
                  </div>
                  <div className="rounded-lg border bg-surface p-4">
                    <p className="text-muted-foreground text-sm">Avg Session</p>
                    <p className="font-bold text-xl">{formatDurationLabel(averageDuration)}</p>
                  </div>
                  <div className="rounded-lg border bg-surface p-4">
                    <p className="text-muted-foreground text-sm">Best Time of Day</p>
                    <p className="font-bold text-xl capitalize">{bestTimeOfDayLabel}</p>
                  </div>
                </div>

                {showBreakdown && (
                  <div className="space-y-2">
                    <p className="font-medium text-sm">Top Categories</p>
                    {topBreakdown.length === 0 && (
                      <p className="text-muted-foreground text-sm">No category data for this period.</p>
                    )}
                    {topBreakdown.map((item: any, index: number) => {
                      const share = totalDuration > 0 ? (item.duration / totalDuration) * 100 : 0;
                      return (
                        <div key={`${item.name}-${index}`} className="space-y-1 rounded-md border p-2">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate font-medium">{item.name}</span>
                            <span className="text-muted-foreground">
                              {formatDurationLabel(item.duration || 0)}
                            </span>
                          </div>
                          <Progress value={share} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                )}

                {showDailyBreakdown && (
                  <div className="space-y-2">
                    <p className="font-medium text-sm">Daily Breakdown</p>
                    {topDaily.length === 0 && (
                      <p className="text-muted-foreground text-sm">No daily data for this period.</p>
                    )}
                    {topDaily.map((item: any, index: number) => (
                      <div
                        key={`${item.date}-${index}`}
                        className="flex items-center justify-between rounded-md border p-2 text-sm"
                      >
                        <span className="font-medium">{item.date}</span>
                        <span className="text-muted-foreground">
                          {formatDurationLabel(item.totalDuration || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );
      },
      Form: ({ props, children, bindings }) => {
        const params = useParams();
        const wsId = params.wsId as string;
        const { state } = useStateStore();
        const { handlers } = useActions();
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [isSuccess, setIsSuccess] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const [message, setMessage] = useState<string | null>(null);

        // We use a bound property to trigger the action
        const [, setOnSubmit] = useBoundProp<any>(
          null,
          bindings?.onSubmit || props.onSubmit
        );

        return (
          <div className="my-4 flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
            <div>
              <h3 className="font-semibold text-lg">{props.title}</h3>
              {props.description && (
                <p className="text-muted-foreground text-sm">
                  {props.description}
                </p>
              )}
            </div>
            <form
              className="flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSubmitting(true);
                setError(null);
                try {
                  const actionName = props.submitAction || 'submit_form';
                  const handler = (handlers as any)?.[actionName];
                  const values = (state as Record<string, unknown>) || {};

                  if (handler) {
                    if (actionName === 'submit_form') {
                      await handler({
                        title: props.title,
                        values,
                      });
                    } else {
                      await handler({
                        ...values,
                        wsId,
                      });
                    }
                  } else if (setOnSubmit) {
                    // Fallback to binding if no action is defined
                    await setOnSubmit({
                      title: props.title,
                      values,
                    });
                  } else {
                    throw new Error(`Action "${actionName}" not found`);
                  }

                  setIsSuccess(true);
                  setMessage('Submitted successfully!');
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : 'Unknown error'
                  );
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              <div className="flex flex-col gap-4">{children}</div>
              <Button
                type="submit"
                disabled={isSubmitting || isSuccess}
                className="mt-2 w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : isSuccess ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Submitted
                  </>
                ) : (
                  props.submitLabel || 'Submit'
                )}
              </Button>
              {error && <p className="text-dynamic-red text-sm">{error}</p>}
              {message && !error && (
                <p className="text-dynamic-green text-sm">{message}</p>
              )}
            </form>
          </div>
        );
      },
      Input: ({ props, bindings }) => {
        const [value, setValue] = useComponentValue<string>(
          props.value,
          bindings?.value,
          props.name,
          ''
        );
        return (
          <div className="relative flex flex-col gap-2">
            <Label htmlFor={props.name}>{props.label}</Label>
            <Input
              id={props.name}
              type={props.type || 'text'}
              placeholder={props.placeholder}
              required={props.required}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        );
      },
      FileAttachmentInput: ({ props, bindings }) => {
        const maxFiles = props.maxFiles || 5;
        const [files, setFiles] = useComponentValue<File[]>(
          props.value,
          bindings?.value,
          props.name,
          []
        );

        return (
          <div className="relative flex flex-col gap-2">
            <Label htmlFor={props.name}>{props.label}</Label>
            {props.description && (
              <p className="text-muted-foreground text-xs">{props.description}</p>
            )}
            <Input
              id={props.name}
              type="file"
              accept={props.accept || 'image/*'}
              required={props.required}
              multiple={maxFiles > 1}
              onChange={(event) => {
                const selected = Array.from(event.target.files || []).slice(
                  0,
                  maxFiles
                );
                setFiles(selected);
              }}
            />
            {Array.isArray(files) && files.length > 0 && (
              <div className="rounded-md border border-border/70 p-2">
                <p className="mb-1 text-muted-foreground text-xs">
                  Selected files ({files.length}/{maxFiles})
                </p>
                <div className="flex flex-col gap-1">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="truncate text-xs"
                      title={file.name}
                    >
                      {file.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      },
      Textarea: ({ props, bindings }) => {
        const [value, setValue] = useComponentValue<string>(
          props.value,
          bindings?.value,
          props.name,
          ''
        );
        return (
          <div className="relative flex flex-col gap-2">
            <Label htmlFor={props.name}>{props.label}</Label>
            <Textarea
              id={props.name}
              placeholder={props.placeholder}
              required={props.required}
              rows={props.rows || 3}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        );
      },
      Checkbox: ({ props, bindings }) => {
        const [checked, setChecked] = useComponentValue<boolean>(
          props.checked,
          bindings?.checked,
          props.name,
          false
        );
        return (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={props.name}
                checked={!!checked}
                onCheckedChange={(val) => setChecked(!!val)}
                required={props.required}
              />
              <Label
                htmlFor={props.name}
                className="font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {props.label}
              </Label>
            </div>
            {props.description && (
              <p className="pl-6 text-muted-foreground text-xs">
                {props.description}
              </p>
            )}
          </div>
        );
      },
      CheckboxGroup: ({ props, bindings }) => {
        const [values, setValues] = useComponentValue<string[]>(
          props.values,
          bindings?.values,
          props.name,
          []
        );

        const toggleValue = (value: string) => {
          const current = Array.isArray(values) ? values : [];
          if (current.includes(value)) {
            setValues(current.filter((v) => v !== value));
          } else {
            setValues([...current, value]);
          }
        };

        return (
          <div className="flex flex-col gap-3">
            <Label>{props.label}</Label>
            <div className="flex flex-col gap-2">
              {(props.options as any[])?.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${props.name}-${option.value}`}
                    checked={(values || []).includes(option.value)}
                    onCheckedChange={() => toggleValue(option.value)}
                  />
                  <Label
                    htmlFor={`${props.name}-${option.value}`}
                    className="font-normal text-sm leading-none"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        );
      },
      RadioGroup: ({ props, bindings }) => {
        const [value, setValue] = useComponentValue<string>(
          props.value,
          bindings?.value,
          props.name,
          ''
        );
        return (
          <div className="flex flex-col gap-3">
            <Label>{props.label}</Label>
            <RadioGroup
              value={value}
              onValueChange={setValue}
              className="flex flex-col gap-2"
              required={props.required}
            >
              {(props.options as any[])?.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={option.value}
                    id={`${props.name}-${option.value}`}
                  />
                  <Label
                    htmlFor={`${props.name}-${option.value}`}
                    className="font-normal text-sm leading-none"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      },
      Select: ({ props, bindings }) => {
        const params = useParams();
        const wsId = params.wsId as string;
        const { set } = useStateStore();

        const [value, setValue] = useComponentValue<string>(
          props.value,
          bindings?.value,
          props.name,
          ''
        );

        // Fetch categories to allow auto-inferring transaction type
        const { data: categories } = useQuery({
          queryKey: [
            'workspaces',
            wsId,
            'finance',
            'transactions',
            'categories',
          ],
          queryFn: async () => {
            const res = await fetch(
              `/api/workspaces/${wsId}/transactions/categories`
            );
            if (!res.ok) return [];
            return res.json();
          },
          enabled: !!wsId && props.name === 'categoryId',
        });

        const handleValueChange = (newVal: string) => {
          setValue(newVal);

          // Auto-infer transaction type if this is a category select
          if (props.name === 'categoryId' && categories) {
            const category = categories.find((c: any) => c.id === newVal);
            if (category) {
              const type = category.is_expense ? 'expense' : 'income';
              // Update the "type" field in state if it exists
              set('/type', type);
            }
          }
        };

        return (
          <div className="flex flex-col gap-2">
            <Label htmlFor={props.name}>{props.label}</Label>
            <Select
              value={value}
              onValueChange={handleValueChange}
              required={props.required}
            >
              <SelectTrigger id={props.name} className="w-full">
                <SelectValue placeholder={props.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {(props.options as any[])?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      },
      Button: ({ props }) => {
        return (
          <Button
            variant={(props.variant || 'default') as any}
            onClick={(e) => {
              e.preventDefault();
            }}
          >
            {props.label}
          </Button>
        );
      },
      Flashcard: ({ props }) => {
        const [flipped, setFlipped] = useState(false);

        // Randomize side on mount
        useEffect(() => {
          if (props.randomize) {
            setFlipped(Math.random() > 0.5);
          }
        }, [props.randomize]);

        return (
          <Card
            className="relative my-4 flex min-h-40 cursor-pointer select-none items-center justify-center p-8 text-center transition-all hover:bg-card/80"
            onClick={() => setFlipped(!flipped)}
          >
            <div className="absolute top-3 right-4 font-semibold text-muted-foreground text-xs uppercase tracking-wider opacity-50">
              {flipped ? 'Answer' : 'Question'}
            </div>
            <div className="font-medium text-xl">
              {flipped ? String(props.back) : String(props.front)}
            </div>
            <div className="absolute bottom-3 text-muted-foreground text-xs opacity-40">
              Click to flip
            </div>
          </Card>
        );
      },
      Quiz: ({ props }) => {
        const [selected, setSelected] = useState<string | null>(null);
        const [isFullscreen, setIsFullscreen] = useState(false);
        const [randomizeCount, setRandomizeCount] = useState(0);

        const options = useMemo(() => {
          const original = (props.options as string[]) || [];
          if (!props.randomize && randomizeCount === 0) return original;
          const shuffled = [...original];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
          }
          return shuffled;
        }, [props.options, props.randomize, randomizeCount]);

        const answer = String(props.answer || (props as any).correctAnswer);
        const isCorrect = selected === answer;

        const quizContent = (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-lg leading-tight">
                {String(props.question)}
              </h3>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setRandomizeCount((prev) => prev + 1);
                    setSelected(null);
                  }}
                  title="Randomize options"
                >
                  <Dices className="h-4 w-4" />
                </Button>
                {!isFullscreen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setIsFullscreen(true)}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {options.map((option) => {
                const isSelected = selected === option;
                const isTheAnswer = option === answer;

                let btnClasses =
                  'h-auto justify-start whitespace-normal px-5 py-4 text-left transition-all border-2';
                if (selected !== null) {
                  if (isTheAnswer) {
                    btnClasses +=
                      ' border-dynamic-green/50 bg-dynamic-green/10 text-dynamic-green hover:bg-dynamic-green/10';
                  } else if (isSelected && !isCorrect) {
                    btnClasses +=
                      ' border-dynamic-red/50 bg-dynamic-red/10 text-dynamic-red hover:bg-dynamic-red/10';
                  } else {
                    btnClasses +=
                      ' opacity-50 border-transparent bg-transparent hover:bg-transparent';
                  }
                } else {
                  btnClasses += ' border-transparent hover:border-primary/20';
                }

                return (
                  <Button
                    key={option}
                    variant={selected === null ? 'secondary' : 'ghost'}
                    className={btnClasses}
                    onClick={() => !selected && setSelected(option)}
                    disabled={selected !== null && !isTheAnswer && !isSelected}
                  >
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="flex-1">{option}</span>
                      {selected !== null && isTheAnswer && (
                        <Check className="h-5 w-5 shrink-0 text-dynamic-green" />
                      )}
                      {selected !== null && isSelected && !isCorrect && (
                        <X className="h-5 w-5 shrink-0 text-dynamic-red" />
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
            {selected !== null && (
              <div
                className={`mt-2 rounded-lg p-5 ${
                  isCorrect
                    ? 'bg-dynamic-green/10 text-dynamic-green'
                    : 'bg-dynamic-red/10 text-dynamic-red'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-bold text-lg">
                    {isCorrect ? '🎉 Correct!' : '💡 Incorrect'}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={
                      isCorrect
                        ? 'hover:bg-dynamic-green/20 hover:text-dynamic-green'
                        : 'hover:bg-dynamic-red/20 hover:text-dynamic-red'
                    }
                    onClick={() => setSelected(null)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" /> Try Again
                  </Button>
                </div>
                {props.explanation && (
                  <p className="mt-3 border-current/10 border-t pt-3 text-sm leading-relaxed opacity-90">
                    {String(props.explanation)}
                  </p>
                )}
              </div>
            )}
          </div>
        );

        if (isFullscreen) {
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm sm:p-8">
              <div className="relative flex w-full max-w-2xl flex-col gap-4 rounded-2xl border bg-card p-6 shadow-2xl sm:p-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 h-10 w-10 rounded-full"
                  onClick={() => setIsFullscreen(false)}
                >
                  <Minimize2 className="h-5 w-5" />
                </Button>
                <div className="mb-4">
                  <h2 className="font-bold text-2xl tracking-tight">
                    Quiz Immersion
                  </h2>
                </div>
                {quizContent}
              </div>
            </div>
          );
        }

        return (
          <div className="my-4 flex flex-col gap-5 rounded-xl border bg-card p-6 shadow-sm">
            {quizContent}
          </div>
        );
      },
      MultiQuiz: ({ props }) => {
        const [currentIndex, setCurrentIndex] = useState(0);
        const [answers, setAnswers] = useState<Record<number, string>>({});
        const [showScore, setShowScore] = useState(false);
        const [isFullscreen, setIsFullscreen] = useState(false);
        const [quizRandomizeCount, setQuizRandomizeCount] = useState(0);
        const [optionRandomizeCount, setOptionRandomizeCount] = useState(0);

        const quizzes = useMemo(() => {
          const original = (props.quizzes as any[]) || [];
          if (!props.randomize && quizRandomizeCount === 0) return original;
          const shuffled = [...original];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
          }
          return shuffled;
        }, [props.quizzes, props.randomize, quizRandomizeCount]);

        const currentQuiz = quizzes[currentIndex];

        const options = useMemo(() => {
          if (!currentQuiz) return [];
          const original = (currentQuiz.options as string[]) || [];
          if (
            !currentQuiz.randomizeOptions &&
            !props.randomize &&
            optionRandomizeCount === 0
          )
            return original;
          const shuffled = [...original];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
          }
          return shuffled;
        }, [currentQuiz, props.randomize, optionRandomizeCount]);

        if (!currentQuiz && !showScore) return null;

        const handleSelect = (option: string) => {
          setAnswers((prev) => ({ ...prev, [currentIndex]: option }));
        };

        const calculateScore = () => {
          let score = 0;
          for (let i = 0; i < quizzes.length; i++) {
            const currentAnswer = quizzes[i].answer || quizzes[i].correctAnswer;
            if (answers[i] === currentAnswer) {
              score++;
            }
          }
          return score;
        };

        if (showScore) {
          const score = calculateScore();
          const scoreContent = (
            <div className="flex flex-col items-center gap-6 text-center">
              <div>
                <h3 className="mb-2 font-bold text-2xl tracking-tight">
                  Quiz Results
                </h3>
                <p className="text-muted-foreground">
                  You completed the {props.title || 'quiz session'}!
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="font-black text-6xl text-primary">
                  {score} / {quizzes.length}
                </div>
                <p className="font-semibold text-lg opacity-80">
                  {Math.round((score / quizzes.length) * 100)}%
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setCurrentIndex(0);
                    setAnswers({});
                    setShowScore(false);
                  }}
                >
                  <RotateCcw className="mr-2 h-4 w-4" /> Restart Quiz
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setQuizRandomizeCount((prev) => prev + 1);
                    setOptionRandomizeCount((prev) => prev + 1);
                    setAnswers({});
                    setCurrentIndex(0);
                    setShowScore(false);
                  }}
                >
                  <Dices className="mr-2 h-4 w-4" /> Randomize & Restart
                </Button>
              </div>
            </div>
          );

          if (isFullscreen) {
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm sm:p-8">
                <div className="relative flex w-full max-w-2xl flex-col gap-4 rounded-2xl border bg-card p-10 shadow-2xl sm:p-12">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 h-10 w-10 rounded-full"
                    onClick={() => setIsFullscreen(false)}
                  >
                    <Minimize2 className="h-5 w-5" />
                  </Button>
                  {scoreContent}
                </div>
              </div>
            );
          }

          return (
            <div className="my-4 flex flex-col items-center gap-6 rounded-xl border bg-card p-8 text-center shadow-sm">
              {scoreContent}
            </div>
          );
        }

        const selected = answers[currentIndex];
        const isAnswered = selected !== undefined;
        const isCorrect =
          selected === (currentQuiz.answer || currentQuiz.correctAnswer);

        const quizContent = (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-border/40 border-b pb-4">
              <div className="flex flex-col gap-1">
                <h3 className="font-bold text-lg leading-tight">
                  {props.title || 'Quiz'}
                </h3>
                <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Question {currentIndex + 1} of {quizzes.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden h-2 w-24 overflow-hidden rounded-full bg-secondary sm:block">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${((currentIndex + 1) / quizzes.length) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setQuizRandomizeCount((prev) => prev + 1);
                      setOptionRandomizeCount((prev) => prev + 1);
                      setAnswers({});
                      setCurrentIndex(0);
                    }}
                    title="Randomize everything"
                  >
                    <Dices className="h-4 w-4" />
                  </Button>
                  {!isFullscreen && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setIsFullscreen(true)}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <h4 className="font-semibold text-xl leading-snug">
                {currentQuiz.question}
              </h4>
              <div className="flex flex-col gap-3">
                {options.map((option: string) => {
                  const isSelected = selected === option;
                  const isTheAnswer =
                    option ===
                    (currentQuiz.answer || currentQuiz.correctAnswer);

                  let btnClasses =
                    'h-auto justify-start whitespace-normal px-5 py-4 text-left transition-all border-2';
                  if (isAnswered) {
                    if (isTheAnswer) {
                      btnClasses +=
                        ' border-dynamic-green/50 bg-dynamic-green/10 text-dynamic-green hover:bg-dynamic-green/10';
                    } else if (isSelected && !isCorrect) {
                      btnClasses +=
                        ' border-dynamic-red/50 bg-dynamic-red/10 text-dynamic-red hover:bg-dynamic-red/10';
                    } else {
                      btnClasses +=
                        ' opacity-50 border-transparent bg-transparent hover:bg-transparent';
                    }
                  } else {
                    btnClasses +=
                      ' border-transparent hover:border-primary/20 bg-secondary/40';
                  }

                  return (
                    <Button
                      key={option}
                      variant={!isAnswered ? 'secondary' : 'ghost'}
                      className={btnClasses}
                      onClick={() => !isAnswered && handleSelect(option)}
                      disabled={isAnswered && !isTheAnswer && !isSelected}
                    >
                      <div className="flex w-full items-center justify-between gap-4">
                        <span className="flex-1 font-medium">{option}</span>
                        {isAnswered && isTheAnswer && (
                          <Check className="h-5 w-5 shrink-0 text-dynamic-green" />
                        )}
                        {isAnswered && isSelected && !isCorrect && (
                          <X className="h-5 w-5 shrink-0 text-dynamic-red" />
                        )}
                      </div>
                    </Button>
                  );
                })}
              </div>

              {isAnswered && currentQuiz.explanation && (
                <div
                  className={`mt-2 rounded-lg p-5 ${
                    isCorrect
                      ? 'bg-dynamic-green/10 text-dynamic-green'
                      : 'bg-dynamic-red/10 text-dynamic-red'
                  }`}
                >
                  <p className="mb-1 font-bold">
                    {isCorrect ? '🎉 Correct!' : '💡 Explanation'}
                  </p>
                  <p className="text-sm leading-relaxed opacity-90">
                    {currentQuiz.explanation}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-border/40 border-t pt-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
              >
                Previous
              </Button>
              {currentIndex === quizzes.length - 1 ? (
                <Button
                  size="sm"
                  disabled={!isAnswered}
                  onClick={() => setShowScore(true)}
                  className="bg-primary hover:bg-primary/90"
                >
                  Finish Quiz
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!isAnswered}
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                >
                  Next Question
                </Button>
              )}
            </div>
          </div>
        );

        if (isFullscreen) {
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm sm:p-8">
              <div className="relative flex w-full max-w-2xl flex-col gap-4 rounded-2xl border bg-card p-6 shadow-2xl sm:p-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 h-10 w-10 rounded-full"
                  onClick={() => setIsFullscreen(false)}
                >
                  <Minimize2 className="h-5 w-5" />
                </Button>
                {quizContent}
              </div>
            </div>
          );
        }

        return (
          <div className="my-4 flex flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm">
            {quizContent}
          </div>
        );
      },
      MultiFlashcard: ({ props }) => {
        const [currentIndex, setCurrentIndex] = useState(0);
        const [flipped, setFlipped] = useState(false);
        const [isFullscreen, setIsFullscreen] = useState(false);
        const [randomizeCount, setRandomizeCount] = useState(0);

        const flashcards = useMemo(() => {
          const original = (props.flashcards as any[]) || [];
          if (!props.randomize && randomizeCount === 0) return original;
          const shuffled = [...original];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
          }
          return shuffled;
        }, [props.flashcards, props.randomize, randomizeCount]);

        const currentCard = flashcards[currentIndex];

        if (!currentCard) return null;

        const flashcardContent = (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-border/40 border-b pb-4">
              <div className="flex flex-col gap-1">
                <h3 className="font-bold text-lg leading-tight">
                  {props.title || 'Flashcards'}
                </h3>
                <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Card {currentIndex + 1} of {flashcards.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden h-2 w-24 overflow-hidden rounded-full bg-secondary/60 sm:block">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${((currentIndex + 1) / flashcards.length) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setRandomizeCount((prev) => prev + 1);
                      setFlipped(false);
                      setCurrentIndex(0);
                    }}
                    title="Randomize cards"
                  >
                    <Dices className="h-4 w-4" />
                  </Button>
                  {!isFullscreen && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setIsFullscreen(true)}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div
              className={`transform-3d relative flex min-h-62.5 cursor-pointer select-none items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-500 ${
                flipped
                  ? 'transform-[rotateY(180deg)] border-primary/40 bg-primary/5'
                  : 'border-border bg-secondary/20 hover:bg-secondary/30'
              }`}
              onClick={() => setFlipped(!flipped)}
            >
              {/* Front side */}
              <div
                className={`backface-hidden absolute inset-0 flex flex-col items-center justify-center p-8 ${
                  flipped ? 'pointer-events-none opacity-0' : 'opacity-100'
                }`}
              >
                <div className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-widest opacity-60">
                  Question
                </div>
                <div className="font-bold text-2xl leading-tight">
                  {currentCard.front}
                </div>
                <div className="mt-8 text-muted-foreground text-xs opacity-40">
                  Click to flip
                </div>
              </div>

              {/* Back side */}
              <div
                className={`backface-hidden transform-[rotateY(180deg)] absolute inset-0 flex flex-col items-center justify-center p-8 ${
                  flipped ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
              >
                <div className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-widest opacity-60">
                  Answer
                </div>
                <div className="font-bold text-2xl leading-tight">
                  {currentCard.back}
                </div>
                <div className="mt-8 text-muted-foreground text-xs opacity-40">
                  Click to flip
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-border/40 border-t pt-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCurrentIndex(Math.max(0, currentIndex - 1));
                  setFlipped(false);
                }}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <div className="flex gap-2">
                {currentIndex === flashcards.length - 1 ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCurrentIndex(0);
                        setFlipped(false);
                      }}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" /> Restart
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRandomizeCount((prev) => prev + 1);
                        setFlipped(false);
                        setCurrentIndex(0);
                      }}
                    >
                      <Dices className="mr-2 h-4 w-4" /> Randomize
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      setCurrentIndex(currentIndex + 1);
                      setFlipped(false);
                    }}
                  >
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        );

        if (isFullscreen) {
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm sm:p-8">
              <div className="relative flex w-full max-w-2xl flex-col gap-4 rounded-2xl border bg-card p-6 shadow-2xl sm:p-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 h-10 w-10 rounded-full"
                  onClick={() => setIsFullscreen(false)}
                >
                  <Minimize2 className="h-5 w-5" />
                </Button>
                {flashcardContent}
              </div>
            </div>
          );
        }

        return (
          <div className="my-4 flex flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm">
            {flashcardContent}
          </div>
        );
      },
    },
    actions: {
      submit_form: async (params, setState, context) => {
        if (!params) return;
        const { sendMessage } = (context as any) || {};
        if (!sendMessage) {
          setState((prev) => ({
            ...prev,
            error: 'Internal error: sendMessage not found',
          }));
          return;
        }

        setState((prev) => ({ ...prev, submitting: true, error: null }));

        try {
          const values = params.values || {};
          const title = params.title || 'Form Submission';

          // Format the message for the chat
          const formattedValues = Object.entries(values)
            .map(([key, value]) => {
              const label = key.charAt(0).toUpperCase() + key.slice(1);
              const displayValue = Array.isArray(value)
                ? value.join(', ')
                : String(value);
              return `**${label}**: ${displayValue}`;
            })
            .join('\n');

          const messageText = `### ${title}\n\n${formattedValues}`;

          // Send the message to the assistant
          await sendMessage({
            role: 'user',
            parts: [{ type: 'text', text: messageText }],
          });

          setState((prev) => ({
            ...prev,
            submitting: false,
            success: true,
            message: 'Form submitted successfully!',
          }));
        } catch (error) {
          setState((prev) => ({
            ...prev,
            submitting: false,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      },
      log_transaction: async (params, setState, context) => {
        if (!params) return;
        const { sendMessage } = (context as any) || {};
        setState((prev) => ({ ...prev, submitting: true }));
        try {
          const res = await fetch('/api/v1/finance/transactions', {
            method: 'POST',
            body: JSON.stringify({
              amount: params.amount,
              description: params.description,
              wallet_id: (params as any).walletId,
            }),
            headers: { 'Content-Type': 'application/json' },
          });

          if (!res.ok) {
            throw new Error('Failed to log transaction');
          }

          if (sendMessage) {
            await sendMessage({
              role: 'user',
              parts: [
                {
                  type: 'text',
                  text: `### Transaction Logged\n\n**Amount**: ${params.amount}\n**Description**: ${params.description || 'N/A'}`,
                },
              ],
            });
          }

          setState((prev) => ({
            ...prev,
            submitting: false,
            success: true,
            message: 'Transaction logged successfully!',
          }));
        } catch (error) {
          setState((prev) => ({
            ...prev,
            submitting: false,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      },
      create_time_tracking_request: async (params, setState, context) => {
        if (!params) return;
        const { sendMessage } = (context as any) || {};
        setState((prev) => ({ ...prev, submitting: true, error: null }));

        try {
          const wsId =
            typeof params.wsId === 'string' ? params.wsId : undefined;
          if (!wsId) {
            throw new Error('Workspace ID is required');
          }

          const title =
            typeof params.title === 'string' && params.title.trim()
              ? params.title.trim()
              : undefined;
          if (!title) {
            throw new Error('Title is required');
          }

          const startTime =
            typeof params.startTime === 'string' ? params.startTime : undefined;
          const endTime =
            typeof params.endTime === 'string' ? params.endTime : undefined;
          if (!startTime || !endTime) {
            throw new Error('startTime and endTime are required');
          }

          const requestId =
            typeof params.requestId === 'string' && params.requestId
              ? params.requestId
              : crypto.randomUUID();

          const rawEvidence = (params as Record<string, unknown>).evidence;
          const rawAttachments = (params as Record<string, unknown>).attachments;
          const files = [
            ...collectFilesFromValue(rawEvidence),
            ...collectFilesFromValue(rawAttachments),
          ].slice(0, 5);

          const preUploadedPaths = Array.isArray(params.imagePaths)
            ? params.imagePaths.filter(
                (path): path is string => typeof path === 'string'
              )
            : [];

          const uploadedPaths = await uploadTimeTrackingRequestFiles(
            wsId,
            requestId,
            files
          );
          const imagePaths = [...preUploadedPaths, ...uploadedPaths];

          if (imagePaths.length === 0) {
            throw new Error(
              'Please attach at least one evidence image before submitting'
            );
          }

          const response = await fetch(
            `/api/v1/workspaces/${encodeURIComponent(wsId)}/time-tracking/requests`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                requestId,
                title,
                description:
                  typeof params.description === 'string'
                    ? params.description
                    : '',
                categoryId:
                  typeof params.categoryId === 'string'
                    ? params.categoryId
                    : '',
                taskId:
                  typeof params.taskId === 'string' ? params.taskId : '',
                startTime,
                endTime,
                imagePaths,
              }),
            }
          );

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(
              (body as { error?: string }).error ||
                'Failed to submit time tracking request'
            );
          }

          if (sendMessage) {
            await sendMessage({
              role: 'user',
              parts: [
                {
                  type: 'text',
                  text: `### Time Tracking Request Submitted\n\n**Title**: ${title}\n**Evidence Files**: ${imagePaths.length}`,
                },
              ],
            });
          }

          setState((prev) => ({
            ...prev,
            submitting: false,
            success: true,
            message: 'Time tracking request submitted successfully!',
          }));
        } catch (error) {
          setState((prev) => ({
            ...prev,
            submitting: false,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      },
    },
  }
);
