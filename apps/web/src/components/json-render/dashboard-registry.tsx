'use client';

import {
  defineRegistry,
  useActions,
  useBoundProp,
  useStateBinding,
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
import { getIconComponentByKey } from '@tuturuuu/ui/custom/icon-picker';
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { dispatchUiAction } from './action-dispatch';
import {
  isStructuredSubmitAction,
  resolveActionHandlerMap,
} from './action-routing';
import {
  buildFormSubmissionMessage,
  buildUiActionSubmissionMessage,
} from './action-submission';
import {
  deriveFormFieldName,
  normalizeTextControlValue,
} from './form-field-utils';

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
  const safePath = path || '/__json_render_unbound__';
  const boundValue = useStateValue<T>(safePath);
  const [localValue, setLocalValue] = useState<T>(
    (propValue ?? defaultValue) as T
  );

  useEffect(() => {
    if (!path) {
      setLocalValue((propValue ?? defaultValue) as T);
    }
  }, [path, propValue, defaultValue]);

  const setValue = useCallback(
    (val: T) => {
      if (path) {
        set(path, val);
      } else {
        setLocalValue(val);
      }
    },
    [path, set]
  );

  if (!path) return [localValue, setValue];
  return [(boundValue ?? propValue ?? defaultValue) as T, setValue];
};

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
        const IconComp = props.icon
          ? (getIconComponentByKey(props.icon) ?? (Icons as any)[props.icon])
          : null;
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
        const p = props as any;
        const IconComp = p.icon
          ? (getIconComponentByKey(p.icon) ?? (Icons as any)[p.icon])
          : null;
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
      Form: ({ props, children, bindings }) => {
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

                  if (handler) {
                    await handler({
                      title: props.title,
                      values: state,
                    });
                  } else if (setOnSubmit) {
                    // Fallback to binding if no action is defined
                    await setOnSubmit({
                      title: props.title,
                      values: state,
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
        const { submitText, sendMessage } = (context as any) || {};
        if (!submitText && !sendMessage) {
          setState((prev) => ({
            ...prev,
            error: 'Internal error: sendMessage not found',
          }));
          return;
        }

        setState((prev) => ({ ...prev, submitting: true, error: null }));

        try {
          const messageText = buildFormSubmissionMessage({
            title: params.title,
            values: params.values,
          });

          // Send the message to the assistant using the same debounced submit
          // pipeline as the main chat input when available. This ensures that
          // render_ui forms behave like quick actions and can interrupt an
          // ongoing response.
          if (submitText) {
            submitText(messageText);
          } else {
            await sendMessage({
              role: 'user',
              parts: [{ type: 'text', text: messageText }],
            });
          }

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
      __ui_action__: async (params, setState, context) => {
        const { submitText, sendMessage } = (context as any) || {};
        if (!submitText && !sendMessage) return;

        setState((prev) => ({ ...prev, submitting: true, error: null }));

        try {
          const messageText = buildUiActionSubmissionMessage({
            id: (params as any)?.id,
            label: (params as any)?.label,
            source: (params as any)?.source,
          });

          if (submitText) {
            submitText(messageText);
          } else {
            await sendMessage({
              role: 'user',
              parts: [{ type: 'text', text: messageText }],
            });
          }

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
        const { submitText, sendMessage } = (context as any) || {};
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

          if (submitText || sendMessage) {
            const messageText = `### Transaction Logged\n\n**Amount**: ${params.amount}\n**Description**: ${params.description || 'N/A'}`;
            if (submitText) {
              submitText(messageText);
            } else if (sendMessage) {
              await sendMessage({
                role: 'user',
                parts: [{ type: 'text', text: messageText }],
              });
            }
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
    },
  }
);
