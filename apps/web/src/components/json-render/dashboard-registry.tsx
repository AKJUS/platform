'use client';

import {
  defineRegistry,
  useActions,
  useBoundProp,
  useStateBinding,
  useStateStore,
} from '@json-render/react';

import { useQuery } from '@tanstack/react-query';
import { dashboardCatalog } from '@tuturuuu/ai/tools/json-render-catalog';
import * as Icons from '@tuturuuu/icons';
import {
  Check,
  Loader2,
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
import { getIconComponentByKey } from '@tuturuuu/ui/custom/icon-picker';
import { MissedEntryImageUploadSection } from '@tuturuuu/ui/custom/missed-entry/image-upload-section';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@tuturuuu/ui/tabs';
import { Textarea } from '@tuturuuu/ui/textarea';
import { MyTasksFilters } from '@tuturuuu/ui/tu-do/my-tasks/my-tasks-filters';
import { MyTasksHeader } from '@tuturuuu/ui/tu-do/my-tasks/my-tasks-header';
import TaskList from '@tuturuuu/ui/tu-do/my-tasks/task-list';
import { useMyTasksState } from '@tuturuuu/ui/tu-do/my-tasks/use-my-tasks-state';
import { cn } from '@tuturuuu/utils/format';
import { useParams } from 'next/navigation';
import {
  type ChangeEvent,
  type ComponentType,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { dispatchUiAction } from './action-dispatch';
import { dashboardActions } from './dashboard-registry/actions';
import { dashboardLearningComponents } from './dashboard-registry/learning-components';
import {
  type IconProps,
  type StatDisplayProps,
  formatDurationLabel,
  resolveStatsRange,
  shouldUseTimeTrackingRequestAction,
  useComponentValue,
} from './dashboard-registry/shared';
import {
  isStructuredSubmitAction,
  resolveActionHandlerMap,
} from './action-routing';
import {
  deriveFormFieldName,
  normalizeTextControlValue,
} from './form-field-utils';
type IconComponent = ComponentType<IconProps>;

const iconRegistry = Icons as unknown as Record<
  string,
  IconComponent | undefined
>;

function resolveRegistryIcon(name?: string): IconComponent | null {
  if (!name) return null;
  return getIconComponentByKey(name) ?? iconRegistry[name] ?? null;
}

export const { registry, handlers, executeAction } = defineRegistry(
  dashboardCatalog,
  {
    components: {
      Card: ({ props, children }) => {
        const hasContent =
          children && Array.isArray(children) && children.length > 0;
        return (
          <Card className="my-2 min-w-0 overflow-hidden rounded-xl border border-border/50 bg-card/80 shadow-sm backdrop-blur-sm">
            {(props.title || props.description) && (
              <CardHeader className="gap-1 border-border/30 border-b bg-muted/15 px-5 py-4 text-left">
                {props.title && (
                  <CardTitle className="break-words font-semibold text-[15px] leading-tight">
                    {props.title}
                  </CardTitle>
                )}
                {props.description && (
                  <CardDescription className="break-words text-[13px]">
                    {props.description}
                  </CardDescription>
                )}
              </CardHeader>
            )}
            {hasContent && (
              <CardContent
                className={cn(
                  'min-w-0 px-5 py-4',
                  !props.title && !props.description && 'pt-5'
                )}
              >
                {children}
              </CardContent>
            )}
          </Card>
        );
      },
      Stack: ({ props, children }) => (
        <div
          className={cn(
            'flex min-w-0 [&>*]:min-w-0',
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
          className="grid w-full min-w-0 [&>*]:min-w-0"
          style={{
            gridTemplateColumns: `repeat(${props.cols || 1}, minmax(0, 1fr))`,
            gap: props.gap ? `${props.gap}px` : '1rem',
          }}
        >
          {children}
        </div>
      ),
      Text: ({ props }) => {
        // Whitelist valid HTML tags to prevent AI from injecting <body>, <html>, etc.
        const TAG_MAP: Record<string, keyof React.JSX.IntrinsicElements> = {
          h1: 'h1',
          h2: 'h2',
          h3: 'h3',
          h4: 'h4',
          p: 'p',
          small: 'small',
          tiny: 'span',
        };
        const variant = props.variant ?? 'p';
        const Component = TAG_MAP[variant] ?? 'p';
        const isBody = !props.variant || variant === 'p';
        return (
          <Component
            className={cn(
              // Default body text gets readable line-height and size
              isBody && 'text-[14px] leading-relaxed',
              variant === 'h1' && 'font-bold text-2xl tracking-tight',
              variant === 'h2' && 'font-semibold text-xl tracking-tight',
              variant === 'h3' && 'font-semibold text-lg',
              variant === 'h4' && 'font-medium text-[15px]',
              variant === 'small' && 'text-[13px] leading-normal',
              variant === 'tiny' && 'text-xs leading-normal',
              props.weight === 'normal' && 'font-normal',
              props.weight === 'medium' && 'font-medium',
              props.weight === 'semibold' && 'font-semibold',
              props.weight === 'bold' && 'font-bold',
              // Color — default body text is slightly muted for softer appearance
              !props.color && isBody && 'text-foreground/90',
              props.color === 'muted' && 'text-muted-foreground',
              props.color === 'primary' && 'text-primary',
              props.color === 'success' && 'text-dynamic-green',
              props.color === 'warning' && 'text-dynamic-yellow',
              props.color === 'error' && 'text-dynamic-red',
              props.align === 'center' && 'text-center',
              props.align === 'right' && 'text-right',
              'whitespace-pre-wrap break-words'
            )}
          >
            {/* Accept both "content" (schema) and "text" (common AI mistake) */}
            {props.content ?? (props as any).text}
          </Component>
        );
      },
      Icon: ({ props }) => {
        // Try getIconComponentByKey first (supports 1600+ icons), fallback to Icons namespace
        const IconComp =
          getIconComponentByKey(props.name) ?? (Icons as any)[props.name];
        if (!IconComp) return null;
        const size = props.size || 18;
        return (
          <span
            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2 text-primary"
            style={props.color ? { color: props.color } : undefined}
          >
            <IconComp size={size} strokeWidth={1.75} />
          </span>
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
      Callout: ({ props }) => {
        const variant = props.variant || 'info';
        const VARIANT_STYLES: Record<
          string,
          { bg: string; border: string; text: string; icon: string }
        > = {
          info: {
            bg: 'bg-primary/5',
            border: 'border-primary/20',
            text: 'text-primary',
            icon: 'Info',
          },
          success: {
            bg: 'bg-dynamic-green/5',
            border: 'border-dynamic-green/20',
            text: 'text-dynamic-green',
            icon: 'CheckCircle',
          },
          warning: {
            bg: 'bg-dynamic-yellow/5',
            border: 'border-dynamic-yellow/20',
            text: 'text-dynamic-yellow',
            icon: 'AlertTriangle',
          },
          error: {
            bg: 'bg-dynamic-red/5',
            border: 'border-dynamic-red/20',
            text: 'text-dynamic-red',
            icon: 'XCircle',
          },
        };
        const style = VARIANT_STYLES[variant] || VARIANT_STYLES.info!;
        const CalloutIcon =
          getIconComponentByKey(style.icon) ?? (Icons as any)[style.icon];
        return (
          <div
            className={cn(
              'flex items-start gap-3 rounded-xl border p-4',
              style.bg,
              style.border
            )}
          >
            {CalloutIcon && (
              <CalloutIcon
                className={cn('mt-0.5 h-4 w-4 shrink-0', style.text)}
              />
            )}
            <div className="min-w-0 flex-1">
              {props.title && (
                <div
                  className={cn(
                    'mb-0.5 break-words font-semibold text-sm',
                    style.text
                  )}
                >
                  {props.title}
                </div>
              )}
              <div className="whitespace-pre-wrap break-words text-[13px] text-foreground/80 leading-relaxed">
                {props.content ?? (props as any).text}
              </div>
            </div>
          </div>
        );
      },
      ListItem: ({ props }) => {
        const actions = useActions();
        const IconComp = resolveRegistryIcon(props.icon);
        return (
          <button
            type="button"
            className={cn(
              'flex w-full min-w-0 items-start gap-3 rounded-lg px-1 py-1.5 text-left transition-colors',
              props.action &&
                'cursor-pointer hover:bg-muted/10 active:bg-muted/20'
            )}
            onClick={() => {
              if (!props.action) return;
              dispatchUiAction(actions, props.action, {
                id: props.action,
                label: props.title,
                source: 'list-item',
              });
            }}
            aria-label={props.title}
          >
            {IconComp && (
              <span
                className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-2 text-primary"
                style={
                  props.iconColor
                    ? {
                        backgroundColor: `${props.iconColor}1a`,
                        color: props.iconColor,
                      }
                    : {}
                }
              >
                <IconComp size={16} strokeWidth={1.75} />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="whitespace-normal break-words font-medium text-[14px] leading-tight">
                {props.title}
              </span>
              {props.subtitle && (
                <span className="whitespace-normal break-words text-[12px] text-muted-foreground leading-tight">
                  {props.subtitle}
                </span>
              )}
            </div>
            {props.trailing && (
              <span className="max-w-[45%] whitespace-normal break-words font-medium text-[13px] text-muted-foreground leading-tight">
                {props.trailing}
              </span>
            )}
          </button>
        );
      },
      Progress: ({ props }) => {
        // Auto-determine color based on value if not explicitly set
        const resolveColor = () => {
          if (props.color && props.color !== 'default') return props.color;
          if (props.value > 66) return 'success';
          if (props.value > 33) return 'warning';
          return 'error';
        };
        const color = resolveColor();
        const COLOR_CLASSES: Record<string, string> = {
          success: '[&>div]:bg-dynamic-green',
          warning: '[&>div]:bg-dynamic-yellow',
          error: '[&>div]:bg-dynamic-red',
        };
        return (
          <div className="flex w-full flex-col gap-1.5">
            {(props.label || props.showValue) && (
              <div className="flex items-center justify-between text-xs">
                {props.label && (
                  <span className="font-medium text-foreground/70">
                    {props.label}
                  </span>
                )}
                {props.showValue && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {Math.round(props.value)}%
                  </span>
                )}
              </div>
            )}
            <Progress
              value={props.value}
              className={cn('h-2 rounded-full', COLOR_CLASSES[color])}
            />
          </div>
        );
      },
      Metric: ({ props }) => {
        const trend = props.trend;
        const trendValue = props.trendValue;
        const showTrend = trend && trend !== 'neutral';

        return (
          <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-card/70 p-4 text-left shadow-sm backdrop-blur-sm">
            <div className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
              {props.title}
            </div>
            <div className="flex items-baseline gap-2">
              <div className="font-bold text-2xl tracking-tighter">
                {props.value}
              </div>
              {showTrend && (
                <div
                  className={cn(
                    'flex items-center gap-0.5 font-semibold text-[13px]',
                    trend === 'up' ? 'text-dynamic-green' : 'text-dynamic-red'
                  )}
                >
                  {trend === 'up' ? '↑' : '↓'}
                  {trendValue}
                </div>
              )}
              {trend === 'neutral' && trendValue && (
                <div className="font-medium text-[13px] text-muted-foreground">
                  {trendValue}
                </div>
              )}
            </div>
          </div>
        );
      },
      Stat: ({ props }) => {
        const p = props as StatDisplayProps;
        const IconComp = resolveRegistryIcon(p.icon);
        const colorClass =
          p.variant === 'success'
            ? 'text-dynamic-green'
            : p.variant === 'warning'
              ? 'text-dynamic-yellow'
              : p.variant === 'error'
                ? 'text-dynamic-red'
                : 'text-foreground';
        return (
          <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/5 px-2.5 py-1.5 transition-colors hover:bg-muted/10">
            {IconComp && (
              <IconComp
                size={14}
                className={cn(
                  'shrink-0',
                  p.variant ? colorClass : 'text-muted-foreground'
                )}
              />
            )}
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] text-muted-foreground/80 uppercase tracking-wide">
                {p.label}
              </span>
              <span
                className={cn(
                  'font-semibold text-sm tracking-tight',
                  colorClass
                )}
              >
                {p.value}
              </span>
            </div>
          </div>
        );
      },
      Tabs: ({ props, children }) => {
        const [activeTab, setActiveTab] = useStateBinding<string>('activeTab');
        const currentTab =
          activeTab ?? props.defaultTab ?? props.tabs?.[0]?.id ?? '';

        return (
          <Tabs
            value={currentTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList
              className="mb-4 grid w-full"
              style={{
                gridTemplateColumns: `repeat(${props.tabs?.length || 1}, 1fr)`,
              }}
            >
              {props.tabs?.map((tab: any) => (
                <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {props.tabs?.map((tab: any) => (
              <TabsContent key={tab.id} value={tab.id}>
                {children}
              </TabsContent>
            ))}
          </Tabs>
        );
      },
      Button: ({ props }) => {
        const actions = useActions();
        const { state } = useStateStore();
        const IconComp = props.icon
          ? (getIconComponentByKey(props.icon) ?? (Icons as any)[props.icon])
          : null;
        return (
          <Button
            variant={props.variant || 'default'}
            size={props.size || 'default'}
            className="h-auto w-full whitespace-normal break-words"
            onClick={() => {
              if (!props.action) return;

              const handlerMap = resolveActionHandlerMap(actions);
              const directHandler = handlerMap[props.action];
              if (typeof directHandler === 'function') {
                void Promise.resolve(directHandler());
                return;
              }

              if (isStructuredSubmitAction(props.action)) {
                const submitFormHandler = handlerMap.submit_form;
                if (typeof submitFormHandler === 'function') {
                  void Promise.resolve(
                    submitFormHandler({
                      title: props.label || 'Form Submission',
                      values: state,
                      actionId: props.action,
                    })
                  );
                  return;
                }
              }

              dispatchUiAction(actions, props.action, {
                id: props.action,
                label: props.label,
                source: 'button',
              });
            }}
          >
            {IconComp && (
              <IconComp
                className={cn('inline-block', props.label ? 'mr-2' : '')}
                size={16}
              />
            )}
            {props.label}
          </Button>
        );
      },
      BarChart: ({ props }) => {
        const maxValue = Math.max(
          ...(props.data?.map((d: any) => d.value) || [100])
        );

        const resolveBarColor = (color?: string): string | undefined => {
          if (!color) return undefined;
          const normalized = String(color).toLowerCase();
          const tokenMap: Record<string, string> = {
            success: 'var(--color-dynamic-green)',
            warning: 'var(--color-dynamic-yellow)',
            error: 'var(--color-dynamic-red)',
            'dynamic-green': 'var(--color-dynamic-green)',
            'dynamic-yellow': 'var(--color-dynamic-yellow)',
            'dynamic-red': 'var(--color-dynamic-red)',
            green: 'var(--color-dynamic-green)',
            blue: 'var(--color-dynamic-blue)',
            orange: 'var(--color-dynamic-orange)',
            purple: 'var(--color-dynamic-purple)',
            cyan: 'var(--color-dynamic-cyan)',
            pink: 'var(--color-dynamic-pink)',
          };
          return tokenMap[normalized] ?? color;
        };

        return (
          <div className="flex w-full flex-col gap-4 py-2">
            <div
              className="flex items-end justify-between gap-2 px-1"
              style={{ height: props.height || 120 }}
            >
              {props.data?.map((item: any, i: number) => {
                const barColor = resolveBarColor(item.color);
                return (
                  <div
                    key={i}
                    className="group relative flex flex-1 flex-col items-center gap-2"
                  >
                    <div
                      className={cn(
                        'w-full rounded-t-md transition-all duration-500 group-hover:opacity-80',
                        barColor ? '' : 'bg-primary/80'
                      )}
                      style={{
                        height: `${(item.value / maxValue) * 100}%`,
                        ...(barColor ? { backgroundColor: barColor } : {}),
                      }}
                    />
                    {/* Simple tooltip on hover */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 scale-0 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white transition-all group-hover:scale-100">
                      {item.value}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between gap-1 px-1">
              {props.data?.map((item: any, i: number) => (
                <div
                  key={i}
                  className="flex-1 whitespace-normal break-words text-center text-[10px] text-muted-foreground uppercase leading-tight tracking-tight"
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        );
      },
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

        const range = resolveStatsRange(
          props.period,
          props.dateFrom,
          props.dateTo
        );

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
                <CardDescription>
                  No stats available for this period.
                </CardDescription>
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
          typeof stats.bestTimeOfDay === 'string' &&
          stats.bestTimeOfDay !== 'none'
            ? stats.bestTimeOfDay
            : 'N/A';

        return (
          <div className="flex flex-col gap-4">
            <Card className="my-2 border border-border/60 bg-card/60">
              <CardHeader>
                <CardTitle className="text-lg">
                  Time Tracking Overview
                </CardTitle>
                <CardDescription>{range.label}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-lg border bg-surface p-4">
                    <p className="text-muted-foreground text-sm">Total Time</p>
                    <p className="font-bold text-xl">
                      {formatDurationLabel(totalDuration)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-surface p-4">
                    <p className="text-muted-foreground text-sm">Sessions</p>
                    <p className="font-bold text-xl">{sessionCount}</p>
                  </div>
                  <div className="rounded-lg border bg-surface p-4">
                    <p className="text-muted-foreground text-sm">Avg Session</p>
                    <p className="font-bold text-xl">
                      {formatDurationLabel(averageDuration)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-surface p-4">
                    <p className="text-muted-foreground text-sm">
                      Best Time of Day
                    </p>
                    <p className="font-bold text-xl capitalize">
                      {bestTimeOfDayLabel}
                    </p>
                  </div>
                </div>

                {showBreakdown && (
                  <div className="space-y-2">
                    <p className="font-medium text-sm">Top Categories</p>
                    {topBreakdown.length === 0 && (
                      <p className="text-muted-foreground text-sm">
                        No category data for this period.
                      </p>
                    )}
                    {topBreakdown.map((item: any, index: number) => {
                      const share =
                        totalDuration > 0
                          ? (item.duration / totalDuration) * 100
                          : 0;
                      return (
                        <div
                          key={`${item.name}-${index}`}
                          className="space-y-1 rounded-md border p-2"
                        >
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate font-medium">
                              {item.name}
                            </span>
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
                      <p className="text-muted-foreground text-sm">
                        No daily data for this period.
                      </p>
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
        type FormActionHandler =
          | ((params: Record<string, unknown>) => unknown)
          | ((params: Record<string, unknown>) => Promise<unknown>);

        // We use a bound property to trigger the action
        const [, setOnSubmit] = useBoundProp<unknown>(
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
                  const submitParams =
                    (props as { submitParams?: Record<string, unknown> })
                      .submitParams || {};
                  const values = (state as Record<string, unknown>) || {};

                  const actionName = shouldUseTimeTrackingRequestAction(
                    props.submitAction,
                    values,
                    submitParams
                  )
                    ? 'create_time_tracking_request'
                    : props.submitAction || 'submit_form';
                  const handler = (
                    handlers as Record<string, FormActionHandler>
                  )[actionName];
                  let actionResult: unknown = null;

                  if (handler) {
                    if (actionName === 'submit_form') {
                      actionResult = await handler({
                        title: props.title,
                        values,
                      });
                    } else {
                      actionResult = await handler({
                        ...submitParams,
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

                  if (
                    actionResult &&
                    typeof actionResult === 'object' &&
                    'error' in (actionResult as Record<string, unknown>) &&
                    typeof (actionResult as Record<string, unknown>).error ===
                      'string'
                  ) {
                    throw new Error(
                      (actionResult as Record<string, unknown>).error as string
                    );
                  }

                  setIsSuccess(true);
                  if (actionName === 'submit_form') {
                    setMessage('Sent to assistant successfully.');
                  } else {
                    setMessage('Submitted successfully!');
                  }
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
        const fieldName = deriveFormFieldName(props.name, props.label, 'input');
        const [rawValue, setValue] = useComponentValue<unknown>(
          props.value,
          bindings?.value,
          fieldName,
          ''
        );
        const value = normalizeTextControlValue(rawValue);
        return (
          <div className="relative flex flex-col gap-2">
            <Label htmlFor={fieldName}>{props.label}</Label>
            <Input
              id={fieldName}
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
        const [isDragOver, setIsDragOver] = useState(false);
        const [imageError, setImageError] = useState<string | null>(null);
        const [imagePreviews, setImagePreviews] = useState<string[]>([]);
        const fileInputRef = useRef<HTMLInputElement>(null);

        const safeFiles = Array.isArray(files) ? files : [];

        useEffect(() => {
          const previews = safeFiles.map((file) => URL.createObjectURL(file));
          setImagePreviews(previews);

          return () => {
            previews.forEach((url) => {
              URL.revokeObjectURL(url);
            });
          };
        }, [safeFiles]);

        const addFiles = useCallback(
          (incoming: File[]) => {
            const imageFiles = incoming.filter((file) =>
              file.type.startsWith('image/')
            );

            if (imageFiles.length !== incoming.length) {
              setImageError('Only image files are supported');
            } else {
              setImageError(null);
            }

            const availableSlots = Math.max(0, maxFiles - safeFiles.length);
            const filesToAdd = imageFiles.slice(0, availableSlots);

            if (filesToAdd.length < imageFiles.length) {
              setImageError(`You can upload up to ${maxFiles} images`);
            }

            if (filesToAdd.length > 0) {
              setFiles([...safeFiles, ...filesToAdd]);
            }
          },
          [maxFiles, safeFiles, setFiles]
        );

        const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
          const selected = Array.from(event.target.files || []);
          addFiles(selected);
          event.target.value = '';
        };

        const handleDragOver = (event: DragEvent<Element>) => {
          event.preventDefault();
          setIsDragOver(true);
        };

        const handleDragLeave = (event: DragEvent<Element>) => {
          event.preventDefault();
          setIsDragOver(false);
        };

        const handleDrop = (event: DragEvent<Element>) => {
          event.preventDefault();
          setIsDragOver(false);
          const dropped = Array.from(event.dataTransfer.files || []);
          addFiles(dropped);
        };

        const handleRemoveNew = (index: number) => {
          const nextFiles = safeFiles.filter(
            (_, fileIndex) => fileIndex !== index
          );
          setFiles(nextFiles);
          setImageError(null);
        };

        return (
          <div className="relative flex flex-col gap-2">
            {props.description && (
              <p className="text-muted-foreground text-xs">
                {props.description}
              </p>
            )}
            <MissedEntryImageUploadSection
              imagePreviews={imagePreviews}
              isDragOver={isDragOver}
              imageError={imageError}
              canAddMore={safeFiles.length < maxFiles}
              fileInputRef={fileInputRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onFileChange={handleFileChange}
              onRemoveNew={handleRemoveNew}
              onRemoveExisting={() => {}}
              labels={{
                proofOfWork: `${props.label} (${safeFiles.length}/${maxFiles})`,
                compressing: 'Processing images...',
                dropImages: 'Drop images here',
                clickToUpload: 'Click to upload or drag and drop',
                imageFormats: 'PNG, JPG, GIF, or WebP up to 1MB each',
                proofImageAlt: 'Proof image',
                existing: 'Existing',
                new: 'New',
              }}
            />
            {props.required && safeFiles.length === 0 && (
              <input
                tabIndex={-1}
                aria-hidden
                required
                value=""
                onChange={() => {}}
                className="pointer-events-none absolute h-0 w-0 opacity-0"
              />
            )}
          </div>
        );
      },
      Textarea: ({ props, bindings }) => {
        const fieldName = deriveFormFieldName(
          props.name,
          props.label,
          'textarea'
        );
        const [rawValue, setValue] = useComponentValue<unknown>(
          props.value,
          bindings?.value,
          fieldName,
          ''
        );
        const value = normalizeTextControlValue(rawValue);
        return (
          <div className="relative flex flex-col gap-2">
            <Label htmlFor={fieldName}>{props.label}</Label>
            <Textarea
              id={fieldName}
              placeholder={props.placeholder}
              required={props.required}
              rows={props.rows || ((props as any).multiline ? 4 : 3)}
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
      ...dashboardLearningComponents,
    },
    actions: dashboardActions,
  }
);
