'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Box,
  CalendarClock,
  DatabaseZap,
  FileText,
  Gauge,
  Logs,
  Play,
  Power,
  Radio,
  RefreshCw,
  Search,
  Terminal,
} from '@tuturuuu/icons';
import {
  type CronExecutionRecord,
  type GetObservabilityParams,
  getBlueGreenMonitoringSnapshot,
  getCronMonitoringExecutionArchive,
  getCronMonitoringSnapshot,
  getObservabilityAnalytics,
  getObservabilityCronRuns,
  getObservabilityDeployments,
  getObservabilityLogs,
  getObservabilityOverview,
  getObservabilityRequests,
  type ObservabilityDeployment,
  type ObservabilityLogEvent,
  type ObservabilityRequest,
  queueCronRun,
  updateCronMonitoringControl,
} from '@tuturuuu/internal-api/infrastructure';
import { Badge } from '@tuturuuu/ui/badge';
import { Button } from '@tuturuuu/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@tuturuuu/ui/dialog';
import { Switch } from '@tuturuuu/ui/switch';
import { cn } from '@tuturuuu/utils/format';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import { type ReactNode, useMemo, useState } from 'react';
import {
  formatBytes,
  formatCompactNumber,
  formatDateTime,
  formatLatencyMs,
} from './formatters';

export type ObservabilityDashboardMode =
  | 'analytics'
  | 'cron'
  | 'deployments'
  | 'logs'
  | 'observability'
  | 'overview'
  | 'requests'
  | 'resources';

const modeIcons = {
  analytics: BarChart3,
  cron: CalendarClock,
  deployments: Box,
  logs: Logs,
  observability: DatabaseZap,
  overview: Activity,
  requests: Radio,
  resources: Gauge,
};

type LogsPage = Awaited<ReturnType<typeof getObservabilityLogs>>;
type RequestsPage = Awaited<ReturnType<typeof getObservabilityRequests>>;
type DeploymentsPage = Awaited<ReturnType<typeof getObservabilityDeployments>>;
type CronExecutionsPage = Awaited<
  ReturnType<typeof getCronMonitoringExecutionArchive>
>;
type InfiniteData<TPage> = {
  pageParams: number[];
  pages: TPage[];
};

function formatNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }

  return formatCompactNumber(value).toLowerCase();
}

function formatDuration(value: number | null | undefined) {
  if (value == null) {
    return '-';
  }

  if (value < 1000) {
    return `${Math.round(value)}ms`;
  }

  return `${(value / 1000).toFixed(1)}s`;
}

function formatTime(value: number | null | undefined) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(value);
}

function statusClass(status: number | null | undefined) {
  if (status == null) {
    return 'text-muted-foreground';
  }

  if (status >= 500) {
    return 'text-dynamic-red';
  }

  if (status >= 400) {
    return 'text-dynamic-orange';
  }

  if (status >= 300) {
    return 'text-dynamic-blue';
  }

  return 'text-dynamic-green';
}

function MetricCard({
  label,
  meta,
  value,
}: {
  label: string;
  meta?: string;
  value: string;
}) {
  return (
    <div className="border-border/70 border-r border-b bg-background px-5 py-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-2 font-semibold text-2xl tracking-tight">{value}</p>
      {meta ? (
        <p className="mt-1 text-muted-foreground text-xs">{meta}</p>
      ) : null}
    </div>
  );
}

function LogRow({ log }: { log: ObservabilityLogEvent }) {
  return (
    <div className="grid grid-cols-[140px_72px_90px_minmax(0,1fr)] items-start gap-4 border-border/50 border-b px-4 py-3 font-mono text-xs">
      <span className="text-muted-foreground">{formatTime(log.createdAt)}</span>
      <span
        className={cn(
          'font-semibold uppercase',
          log.level === 'error'
            ? 'text-dynamic-red'
            : log.level === 'warn'
              ? 'text-dynamic-orange'
              : 'text-muted-foreground'
        )}
      >
        {log.level}
      </span>
      <span className={statusClass(log.status)}>{log.status ?? '-'}</span>
      <div className="min-w-0">
        <p className="truncate text-foreground">{log.message}</p>
        <p className="mt-1 truncate text-muted-foreground">
          {log.route ?? log.requestId ?? log.source}
        </p>
      </div>
    </div>
  );
}

function RequestRow({ request }: { request: ObservabilityRequest }) {
  return (
    <div className="grid grid-cols-[140px_72px_76px_minmax(0,1fr)_90px] items-center gap-4 border-border/50 border-b px-4 py-3 font-mono text-xs">
      <span className="text-muted-foreground">
        {formatTime(request.startedAt)}
      </span>
      <span>{request.method ?? request.source.toUpperCase()}</span>
      <span className={statusClass(request.status)}>
        {request.status ?? '-'}
      </span>
      <span className="truncate">{request.path ?? request.id}</span>
      <span className="text-muted-foreground">
        {formatDuration(request.durationMs)}
      </span>
    </div>
  );
}

function DeploymentRow({
  deployment,
}: {
  deployment: ObservabilityDeployment;
}) {
  const state = deployment.runtimeState ?? deployment.status;
  const hash =
    deployment.commitShortHash ?? deployment.commitHash?.slice(0, 10) ?? '-';

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_110px_110px_100px_90px_120px] items-center gap-4 border-border/50 border-b px-4 py-3 text-sm">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold">
            {deployment.commitSubject ?? tFallbackDeployment(deployment)}
          </span>
          <span className="shrink-0 rounded border border-border/70 bg-muted/30 px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
            {hash}
          </span>
        </div>
        <p className="mt-1 truncate font-mono text-muted-foreground text-xs">
          {deployment.deploymentStamp ??
            deployment.color ??
            deployment.commitHash ??
            'unknown'}
        </p>
      </div>
      <span
        className={cn(
          'font-medium',
          deployment.status === 'failed'
            ? 'text-dynamic-red'
            : 'text-dynamic-green'
        )}
      >
        {state}
      </span>
      <span className="font-mono text-muted-foreground text-xs">
        {formatDuration(deployment.durationMs)}
      </span>
      <span>{formatNumber(deployment.requestCount)}</span>
      <span className="text-dynamic-red">
        {formatNumber(deployment.errorCount)}
      </span>
      <span className="text-muted-foreground text-xs">
        {formatTime(deployment.lastRequestAt)}
      </span>
    </div>
  );
}

function tFallbackDeployment(deployment: ObservabilityDeployment) {
  return deployment.deploymentStamp ?? deployment.color ?? 'unknown';
}

function VirtualizedList<T>({
  empty,
  estimateRowHeight,
  hasMore,
  height = 560,
  isFetchingMore,
  items,
  onEndReached,
  renderRow,
}: {
  empty: ReactNode;
  estimateRowHeight: number;
  hasMore: boolean;
  height?: number;
  isFetchingMore: boolean;
  items: T[];
  onEndReached: () => void;
  renderRow: (item: T, index: number) => ReactNode;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const overscan = 8;
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / estimateRowHeight) - overscan
  );
  const visibleCount = Math.ceil(height / estimateRowHeight) + overscan * 2;
  const endIndex = Math.min(items.length, startIndex + visibleCount);
  const virtualItems = items.slice(startIndex, endIndex);

  if (items.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-muted-foreground text-sm">
        {empty}
      </div>
    );
  }

  return (
    <div
      className="overflow-auto"
      onScroll={(event) => {
        const target = event.currentTarget;
        setScrollTop(target.scrollTop);

        if (
          hasMore &&
          !isFetchingMore &&
          target.scrollHeight - target.scrollTop - target.clientHeight <
            estimateRowHeight * 6
        ) {
          onEndReached();
        }
      }}
      style={{ height }}
    >
      <div
        className="relative"
        style={{ height: items.length * estimateRowHeight }}
      >
        {virtualItems.map((item, offset) => {
          const index = startIndex + offset;
          return (
            <div
              className="absolute inset-x-0"
              key={index}
              style={{
                height: estimateRowHeight,
                transform: `translateY(${index * estimateRowHeight}px)`,
              }}
            >
              {renderRow(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfiniteFooter({
  endLabel,
  hasMore,
  isFetchingMore,
  loadingLabel,
  loaded,
  moreLabel,
  total,
}: {
  endLabel: string;
  hasMore: boolean;
  isFetchingMore: boolean;
  loadingLabel: string;
  loaded: number;
  moreLabel: string;
  total: number;
}) {
  return (
    <div className="flex items-center justify-between border-border/60 border-t px-4 py-3 text-muted-foreground text-xs">
      <span>
        {formatNumber(loaded)} / {formatNumber(total)}
      </span>
      <span>
        {isFetchingMore ? loadingLabel : hasMore ? moreLabel : endLabel}
      </span>
    </div>
  );
}

export function ObservabilityDashboardClient({
  mode,
}: {
  mode: ObservabilityDashboardMode;
}) {
  const t = useTranslations('blue-green-monitoring.observability');
  const cronT = useTranslations('blue-green-monitoring.cron');
  const queryClient = useQueryClient();
  const Icon = modeIcons[mode];
  const [timeframeHours, setTimeframeHours] = useQueryState(
    'hours',
    parseAsInteger.withDefault(24).withOptions({ shallow: true })
  );
  const [query, setQuery] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({ shallow: true })
  );
  const [level, setLevel] = useQueryState(
    'level',
    parseAsString.withDefault('all').withOptions({ shallow: true })
  );
  const [source, setSource] = useQueryState(
    'source',
    parseAsString.withDefault('all').withOptions({ shallow: true })
  );
  const [pageSize] = useQueryState(
    'limit',
    parseAsInteger.withDefault(100).withOptions({ shallow: true })
  );
  const [requestFreezeUntil, setRequestFreezeUntil] = useState(() =>
    Date.now()
  );
  const [selectedExecution, setSelectedExecution] =
    useState<CronExecutionRecord | null>(null);
  const filters: GetObservabilityParams = useMemo(
    () => ({
      level: level as GetObservabilityParams['level'],
      pageSize,
      q: query || undefined,
      source: source as GetObservabilityParams['source'],
      timeframeHours,
    }),
    [level, pageSize, query, source, timeframeHours]
  );
  const overviewQuery = useQuery({
    queryFn: () => getObservabilityOverview({ timeframeHours }),
    queryKey: ['infrastructure', 'observability', 'overview', timeframeHours],
    refetchInterval: mode === 'logs' ? 10_000 : 30_000,
  });
  const analyticsQuery = useQuery({
    enabled: mode === 'analytics' || mode === 'observability',
    queryFn: () => getObservabilityAnalytics({ timeframeHours }),
    queryKey: ['infrastructure', 'observability', 'analytics', timeframeHours],
  });
  const logsQuery = useInfiniteQuery<
    LogsPage,
    Error,
    InfiniteData<LogsPage>,
    readonly unknown[],
    number
  >({
    enabled: mode === 'logs',
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getObservabilityLogs({ ...filters, page: pageParam }),
    queryKey: ['infrastructure', 'observability', 'logs', filters],
    refetchInterval: 5_000,
  });
  const requestsQuery = useInfiniteQuery<
    RequestsPage,
    Error,
    InfiniteData<RequestsPage>,
    readonly unknown[],
    number
  >({
    enabled: mode === 'requests',
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getObservabilityRequests({
        ...filters,
        page: pageParam,
        until: requestFreezeUntil,
      }),
    queryKey: [
      'infrastructure',
      'observability',
      'requests',
      filters,
      requestFreezeUntil,
    ],
  });
  const newRequestsQuery = useQuery({
    enabled: mode === 'requests',
    queryFn: () =>
      getObservabilityRequests({
        ...filters,
        page: 1,
        pageSize: 1,
        since: requestFreezeUntil,
      }),
    queryKey: [
      'infrastructure',
      'observability',
      'requests-new',
      filters,
      requestFreezeUntil,
    ],
    refetchInterval: 5_000,
  });
  const deploymentsQuery = useInfiniteQuery<
    DeploymentsPage,
    Error,
    InfiniteData<DeploymentsPage>,
    readonly unknown[],
    number
  >({
    enabled: mode === 'deployments',
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getObservabilityDeployments({ ...filters, page: pageParam }),
    queryKey: ['infrastructure', 'observability', 'deployments', filters],
  });
  const cronQuery = useQuery({
    enabled: mode === 'cron' || mode === 'observability',
    queryFn: () => getObservabilityCronRuns(filters),
    queryKey: ['infrastructure', 'observability', 'cron-runs', filters],
  });
  const cronSnapshotQuery = useQuery({
    enabled: mode === 'cron',
    queryFn: () => getCronMonitoringSnapshot(),
    queryKey: ['infrastructure', 'monitoring', 'cron', 'snapshot'],
    refetchInterval: 5_000,
  });
  const cronExecutionsQuery = useInfiniteQuery<
    CronExecutionsPage,
    Error,
    InfiniteData<CronExecutionsPage>,
    readonly unknown[],
    number
  >({
    enabled: mode === 'cron',
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getCronMonitoringExecutionArchive({
        page: pageParam,
        pageSize,
      }),
    queryKey: ['infrastructure', 'monitoring', 'cron', 'executions', pageSize],
    refetchInterval: 5_000,
  });
  const resourcesQuery = useQuery({
    enabled: mode === 'resources',
    queryFn: () =>
      getBlueGreenMonitoringSnapshot({
        requestPreviewLimit: 0,
        watcherLogLimit: 0,
      }),
    queryKey: ['infrastructure', 'monitoring', 'resources'],
    refetchInterval: 5_000,
  });
  const runCronMutation = useMutation({
    mutationFn: (jobId: string) => queueCronRun({ jobId }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['infrastructure', 'monitoring', 'cron'],
      }),
  });
  const cronControlMutation = useMutation({
    mutationFn: (payload: { enabled: boolean; jobId?: string }) =>
      updateCronMonitoringControl(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['infrastructure', 'monitoring', 'cron'],
      }),
  });
  const overview = overviewQuery.data;
  const analytics = analyticsQuery.data;
  const cronSnapshot = cronSnapshotQuery.data;
  const resources = resourcesQuery.data?.dockerResources;
  const logs = useMemo(
    () => logsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [logsQuery.data]
  );
  const requests = useMemo(
    () => requestsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [requestsQuery.data]
  );
  const deployments = useMemo(
    () => deploymentsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [deploymentsQuery.data]
  );
  const cronExecutions = useMemo(
    () => cronExecutionsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [cronExecutionsQuery.data]
  );
  const logsTotal = logsQuery.data?.pages[0]?.total ?? 0;
  const requestsTotal = requestsQuery.data?.pages[0]?.total ?? 0;
  const deploymentsTotal = deploymentsQuery.data?.pages[0]?.total ?? 0;
  const cronExecutionsTotal = cronExecutionsQuery.data?.pages[0]?.total ?? 0;
  const newRequestCount = newRequestsQuery.data?.total ?? 0;
  const infiniteLabels = {
    end: t('infinite.end'),
    loading: t('infinite.loading'),
    more: t('infinite.more'),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-border border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-md border border-border bg-background p-2">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">{t(`${mode}.title`)}</h2>
            <p className="text-muted-foreground text-sm">
              {t(`${mode}.description`)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              className="w-52 bg-transparent outline-none"
              onChange={(event) => void setQuery(event.target.value)}
              placeholder={t('search_placeholder')}
              value={query}
            />
          </label>
          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            onChange={(event) => void setSource(event.target.value)}
            value={source}
          >
            <option value="all">{t('all_sources')}</option>
            <option value="api">API</option>
            <option value="cron">Cron</option>
            <option value="server">Server</option>
          </select>
          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            onChange={(event) => void setLevel(event.target.value)}
            value={level}
          >
            <option value="all">{t('all_levels')}</option>
            <option value="error">Error</option>
            <option value="warn">Warn</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
          <select
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
            onChange={(event) =>
              void setTimeframeHours(Number.parseInt(event.target.value, 10))
            }
            value={timeframeHours}
          >
            <option value={1}>{t('last_hour')}</option>
            <option value={24}>{t('last_24_hours')}</option>
            <option value={168}>{t('last_7_days')}</option>
          </select>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm"
            onClick={() => {
              void overviewQuery.refetch();
              void logsQuery.refetch();
              void requestsQuery.refetch();
              void deploymentsQuery.refetch();
              void cronQuery.refetch();
              void analyticsQuery.refetch();
              void cronSnapshotQuery.refetch();
              void cronExecutionsQuery.refetch();
              void resourcesQuery.refetch();
            }}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            {t('refresh')}
          </button>
        </div>
      </div>

      <section className="grid overflow-hidden rounded-lg border border-border md:grid-cols-4">
        <MetricCard
          label={t('metrics.requests')}
          meta={t('metrics.requests_meta')}
          value={formatNumber(overview?.requestCount)}
        />
        <MetricCard
          label={t('metrics.errors')}
          meta={`${formatNumber(overview?.errorRate)}%`}
          value={formatNumber(overview?.serverErrorCount)}
        />
        <MetricCard
          label={t('metrics.p95')}
          meta={t('metrics.p95_meta')}
          value={formatLatencyMs(overview?.p95DurationMs)}
        />
        <MetricCard
          label={t('metrics.cron')}
          meta={`${formatNumber(overview?.cronFailureRate)}%`}
          value={formatNumber(cronQuery.data?.total ?? 0)}
        />
      </section>

      {(mode === 'overview' || mode === 'observability') && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-lg border border-border bg-background">
            <div className="border-border border-b px-4 py-3 font-medium text-sm">
              {t('top_routes')}
            </div>
            {(overview?.topRoutes ?? []).map((route) => (
              <div
                className="grid grid-cols-[minmax(0,1fr)_80px_80px_80px] gap-3 border-border/50 border-b px-4 py-3 text-sm"
                key={route.path}
              >
                <span className="truncate font-mono">{route.path}</span>
                <span className="text-right">{route.requestCount}</span>
                <span className="text-right text-dynamic-red">
                  {route.errorCount}
                </span>
                <span className="text-right text-muted-foreground">
                  {formatDuration(route.averageDurationMs)}
                </span>
              </div>
            ))}
          </section>
          <section className="rounded-lg border border-border bg-background">
            <div className="border-border border-b px-4 py-3 font-medium text-sm">
              {t('recent_errors')}
            </div>
            {(overview?.recentErrors ?? []).map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </section>
        </div>
      )}

      {mode === 'logs' && (
        <section className="rounded-lg border border-border bg-background">
          <div className="grid grid-cols-[140px_72px_90px_minmax(0,1fr)] gap-4 border-border border-b px-4 py-3 text-muted-foreground text-xs">
            <span>{t('columns.time')}</span>
            <span>{t('columns.level')}</span>
            <span>{t('columns.status')}</span>
            <span>{t('columns.message')}</span>
          </div>
          <VirtualizedList
            empty={t('empty.logs')}
            estimateRowHeight={66}
            hasMore={logsQuery.hasNextPage}
            isFetchingMore={logsQuery.isFetchingNextPage}
            items={logs}
            onEndReached={() => void logsQuery.fetchNextPage()}
            renderRow={(log) => <LogRow key={log.id} log={log} />}
          />
          <InfiniteFooter
            endLabel={infiniteLabels.end}
            hasMore={logsQuery.hasNextPage}
            isFetchingMore={logsQuery.isFetchingNextPage}
            loaded={logs.length}
            loadingLabel={infiniteLabels.loading}
            moreLabel={infiniteLabels.more}
            total={logsTotal}
          />
        </section>
      )}

      {mode === 'requests' && (
        <section className="rounded-lg border border-border bg-background">
          <div className="flex flex-col gap-3 border-border border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-sm">
                {t('requests.frozen_title')}
              </p>
              <p className="text-muted-foreground text-xs">
                {t('requests.frozen_meta', {
                  time: formatDateTime(requestFreezeUntil),
                })}
              </p>
            </div>
            {newRequestCount > 0 ? (
              <Button
                onClick={() => setRequestFreezeUntil(Date.now())}
                size="sm"
                type="button"
                variant="outline"
              >
                {t('requests.show_new', {
                  count: formatNumber(newRequestCount),
                })}
              </Button>
            ) : (
              <Badge className="rounded-full" variant="outline">
                {t('requests.no_new')}
              </Badge>
            )}
          </div>
          <VirtualizedList
            empty={t('empty.requests')}
            estimateRowHeight={58}
            hasMore={requestsQuery.hasNextPage}
            isFetchingMore={requestsQuery.isFetchingNextPage}
            items={requests}
            onEndReached={() => void requestsQuery.fetchNextPage()}
            renderRow={(request) => (
              <RequestRow key={request.id} request={request} />
            )}
          />
          <InfiniteFooter
            endLabel={infiniteLabels.end}
            hasMore={requestsQuery.hasNextPage}
            isFetchingMore={requestsQuery.isFetchingNextPage}
            loaded={requests.length}
            loadingLabel={infiniteLabels.loading}
            moreLabel={infiniteLabels.more}
            total={requestsTotal}
          />
        </section>
      )}

      {mode === 'deployments' && (
        <section className="rounded-lg border border-border bg-background">
          <div className="grid grid-cols-[minmax(0,1fr)_110px_110px_100px_90px_120px] gap-4 border-border border-b px-4 py-3 text-muted-foreground text-xs">
            <span>{t('columns.deployment')}</span>
            <span>{t('columns.state')}</span>
            <span>{t('columns.build_time')}</span>
            <span>{t('columns.requests')}</span>
            <span>{t('columns.errors')}</span>
            <span>{t('columns.last_request')}</span>
          </div>
          <VirtualizedList
            empty={t('empty.deployments')}
            estimateRowHeight={78}
            hasMore={deploymentsQuery.hasNextPage}
            isFetchingMore={deploymentsQuery.isFetchingNextPage}
            items={deployments}
            onEndReached={() => void deploymentsQuery.fetchNextPage()}
            renderRow={(deployment) => (
              <DeploymentRow
                deployment={deployment}
                key={
                  deployment.commitHash ??
                  deployment.deploymentStamp ??
                  deployment.color ??
                  'unknown'
                }
              />
            )}
          />
          <InfiniteFooter
            endLabel={infiniteLabels.end}
            hasMore={deploymentsQuery.hasNextPage}
            isFetchingMore={deploymentsQuery.isFetchingNextPage}
            loaded={deployments.length}
            loadingLabel={infiniteLabels.loading}
            moreLabel={infiniteLabels.more}
            total={deploymentsTotal}
          />
        </section>
      )}

      {mode === 'cron' && (
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-background">
            <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-3">
              <div>
                <p className="font-medium text-sm">{cronT('jobs_title')}</p>
                <p className="text-muted-foreground text-xs">
                  {cronT('jobs_description')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Power className="h-4 w-4 text-muted-foreground" />
                <Switch
                  checked={cronSnapshot?.enabled ?? false}
                  disabled={cronControlMutation.isPending || !cronSnapshot}
                  onCheckedChange={(enabled) =>
                    cronControlMutation.mutate({ enabled })
                  }
                />
              </div>
            </div>
            {(cronSnapshot?.jobs ?? []).map((job) => (
              <div
                className="grid gap-3 border-border/50 border-b px-4 py-3 text-sm lg:grid-cols-[minmax(0,1fr)_auto]"
                key={job.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-mono">{job.id}</span>
                    <Badge
                      className={cn(
                        'rounded-full',
                        job.enabled
                          ? 'border-dynamic-green/35 text-dynamic-green'
                          : 'border-border text-muted-foreground'
                      )}
                      variant="outline"
                    >
                      {job.enabled
                        ? cronT('states.enabled')
                        : cronT('states.disabled')}
                    </Badge>
                    {job.controlEnabled != null ? (
                      <Badge className="rounded-full" variant="outline">
                        {t('cron.runtime_override')}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {job.description}
                  </p>
                  <p className="mt-2 truncate font-mono text-muted-foreground text-xs">
                    {job.schedule} · {job.path}
                  </p>
                </div>
                <div className="flex items-center gap-2 lg:justify-end">
                  <Switch
                    checked={job.enabled}
                    disabled={
                      cronControlMutation.isPending ||
                      cronSnapshot?.enabled === false
                    }
                    onCheckedChange={(enabled) =>
                      cronControlMutation.mutate({ enabled, jobId: job.id })
                    }
                  />
                  <Button
                    disabled={
                      runCronMutation.isPending ||
                      !job.enabled ||
                      cronSnapshot?.enabled === false
                    }
                    onClick={() => runCronMutation.mutate(job.id)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {cronT('actions.run_now')}
                  </Button>
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-border bg-background">
            <div className="border-border border-b px-4 py-3">
              <p className="font-medium text-sm">{cronT('executions_title')}</p>
              <p className="text-muted-foreground text-xs">
                {cronT('executions_description')}
              </p>
            </div>
            <VirtualizedList
              empty={t('empty.cron_executions')}
              estimateRowHeight={92}
              hasMore={cronExecutionsQuery.hasNextPage}
              isFetchingMore={cronExecutionsQuery.isFetchingNextPage}
              items={cronExecutions}
              onEndReached={() => void cronExecutionsQuery.fetchNextPage()}
              renderRow={(run) => (
                <button
                  className="grid h-full w-full gap-2 border-border/50 border-b px-4 py-3 text-left text-sm transition-colors hover:bg-foreground/[0.025]"
                  key={run.id}
                  onClick={() => setSelectedExecution(run)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono">{run.jobId}</span>
                    <span
                      className={
                        run.status === 'failed' ? 'text-dynamic-red' : ''
                      }
                    >
                      {run.status}
                    </span>
                  </div>
                  <span className="truncate text-muted-foreground text-xs">
                    {run.path}
                  </span>
                  <div className="flex items-center justify-between gap-3 font-mono text-muted-foreground text-xs">
                    <span>{formatTime(run.startedAt)}</span>
                    <span>{formatDuration(run.durationMs)}</span>
                  </div>
                </button>
              )}
            />
            <InfiniteFooter
              endLabel={infiniteLabels.end}
              hasMore={cronExecutionsQuery.hasNextPage}
              isFetchingMore={cronExecutionsQuery.isFetchingNextPage}
              loaded={cronExecutions.length}
              loadingLabel={infiniteLabels.loading}
              moreLabel={infiniteLabels.more}
              total={cronExecutionsTotal}
            />
          </section>
        </div>
      )}

      {mode === 'analytics' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-lg border border-border bg-background p-4">
            <p className="font-medium text-sm">{t('analytics.requests')}</p>
            <div className="mt-4 flex h-56 items-end gap-1 border-border border-b">
              {(analytics?.buckets ?? []).map((bucket) => (
                <div
                  className="min-h-1 flex-1 rounded-t bg-dynamic-blue"
                  key={bucket.bucketStart}
                  style={{
                    height: `${Math.max(4, Math.min(100, bucket.requests * 6))}%`,
                  }}
                />
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-border bg-background p-4">
            <p className="font-medium text-sm">{t('analytics.status')}</p>
            <div className="mt-4 grid gap-2">
              {Object.entries(analytics?.statusFamilies ?? {}).map(
                ([label, value]) => (
                  <div
                    className="flex items-center justify-between"
                    key={label}
                  >
                    <span className="text-muted-foreground text-sm">
                      {label}
                    </span>
                    <span className="font-mono text-sm">{value}</span>
                  </div>
                )
              )}
            </div>
          </section>
        </div>
      )}

      {mode === 'observability' && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            [t('signals.server_errors'), overview?.serverErrorCount],
            [t('signals.slow_requests'), overview?.slowRequestCount],
            [t('signals.cron_failure_rate'), overview?.cronFailureRate],
            [
              t('signals.active_sources'),
              Object.keys(overview?.sourceCounts ?? {}).length,
            ],
          ].map(([label, value]) => (
            <div
              className="rounded-lg border border-border bg-background p-4"
              key={label}
            >
              <FileText className="mb-4 h-4 w-4 text-muted-foreground" />
              <p className="text-muted-foreground text-xs">{label}</p>
              <p className="mt-2 font-semibold text-2xl">
                {formatNumber(value as number)}
              </p>
            </div>
          ))}
        </section>
      )}

      {mode === 'resources' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-lg border border-border bg-background">
            <div className="grid grid-cols-[minmax(0,1fr)_90px_120px_120px_120px] gap-4 border-border border-b px-4 py-3 text-muted-foreground text-xs">
              <span>{t('resources.container')}</span>
              <span>{t('resources.health')}</span>
              <span>{t('resources.cpu')}</span>
              <span>{t('resources.memory')}</span>
              <span>{t('resources.network')}</span>
            </div>
            {(resources?.allContainers ?? []).map((container) => (
              <div
                className="grid grid-cols-[minmax(0,1fr)_90px_120px_120px_120px] items-center gap-4 border-border/50 border-b px-4 py-3 text-sm"
                key={container.containerId}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{container.name}</p>
                  <p className="truncate font-mono text-muted-foreground text-xs">
                    {container.image ?? container.serviceName ?? '-'}
                  </p>
                </div>
                <span
                  className={cn(
                    container.health === 'healthy'
                      ? 'text-dynamic-green'
                      : container.health === 'unhealthy'
                        ? 'text-dynamic-red'
                        : 'text-muted-foreground'
                  )}
                >
                  {container.health}
                </span>
                <span>{formatNumber(container.cpuPercent)}%</span>
                <span>{formatBytes(container.memoryBytes)}</span>
                <span className="font-mono text-muted-foreground text-xs">
                  {formatBytes(container.rxBytes)} /{' '}
                  {formatBytes(container.txBytes)}
                </span>
              </div>
            ))}
          </section>
          <section className="rounded-lg border border-border bg-background p-4">
            <Terminal className="mb-3 h-4 w-4 text-muted-foreground" />
            <p className="font-medium text-sm">{t('resources.summary')}</p>
            <div className="mt-4 grid gap-3">
              <MetricCard
                label={t('resources.total_cpu')}
                value={`${formatNumber(resources?.totalCpuPercent)}%`}
              />
              <MetricCard
                label={t('resources.total_memory')}
                value={formatBytes(resources?.totalMemoryBytes)}
              />
              <MetricCard
                label={t('resources.services')}
                value={formatNumber(resources?.serviceHealth.length)}
              />
            </div>
          </section>
        </div>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) setSelectedExecution(null);
        }}
        open={Boolean(selectedExecution)}
      >
        <DialogContent className="max-w-4xl">
          {selectedExecution ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedExecution.jobId}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  [cronT('detail.status'), selectedExecution.status],
                  [
                    cronT('detail.started'),
                    formatTime(selectedExecution.startedAt),
                  ],
                  [
                    cronT('detail.duration'),
                    formatDuration(selectedExecution.durationMs),
                  ],
                  [
                    cronT('detail.http_status'),
                    selectedExecution.httpStatus?.toString() ?? '-',
                  ],
                ].map(([label, value]) => (
                  <div
                    className="rounded-lg border border-border/60 bg-muted/20 p-3"
                    key={label}
                  >
                    <p className="text-muted-foreground text-xs uppercase">
                      {label}
                    </p>
                    <p className="mt-2 font-medium text-sm">{value}</p>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 font-medium text-sm">
                    {cronT('detail.response')}
                  </p>
                  <pre className="max-h-80 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                    {selectedExecution.error ||
                      selectedExecution.response ||
                      cronT('detail.empty_response')}
                  </pre>
                </div>
                <div>
                  <p className="mb-2 font-medium text-sm">
                    {cronT('detail.console_logs')}
                  </p>
                  <div className="max-h-80 overflow-auto rounded-lg border border-border/60 bg-muted/30 p-3">
                    {selectedExecution.consoleLogs.length > 0 ? (
                      selectedExecution.consoleLogs.map((log) => (
                        <div
                          className="border-border/50 border-b py-2 last:border-b-0"
                          key={`${log.time}-${log.message}`}
                        >
                          <div className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
                            <span>{formatTime(log.time)}</span>
                            <span>{log.level}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap font-mono text-xs">
                            {log.message}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        {cronT('detail.empty_console_logs')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
