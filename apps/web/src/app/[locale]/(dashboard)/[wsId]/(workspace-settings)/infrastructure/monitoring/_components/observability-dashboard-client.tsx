'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Box,
  CalendarClock,
  DatabaseZap,
  FileText,
  Logs,
  Radio,
  RefreshCw,
  Search,
} from '@tuturuuu/icons';
import {
  type GetObservabilityParams,
  getObservabilityAnalytics,
  getObservabilityCronRuns,
  getObservabilityDeployments,
  getObservabilityLogs,
  getObservabilityOverview,
  getObservabilityRequests,
  type ObservabilityLogEvent,
  type ObservabilityRequest,
} from '@tuturuuu/internal-api/infrastructure';
import { cn } from '@tuturuuu/utils/format';
import { useTranslations } from 'next-intl';
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs';

export type ObservabilityDashboardMode =
  | 'analytics'
  | 'cron'
  | 'deployments'
  | 'logs'
  | 'observability'
  | 'overview'
  | 'requests';

const modeIcons = {
  analytics: BarChart3,
  cron: CalendarClock,
  deployments: Box,
  logs: Logs,
  observability: DatabaseZap,
  overview: Activity,
  requests: Radio,
};

function formatNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }

  return new Intl.NumberFormat().format(Math.round(value));
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

export function ObservabilityDashboardClient({
  mode,
}: {
  mode: ObservabilityDashboardMode;
}) {
  const t = useTranslations('blue-green-monitoring.observability');
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
  const filters: GetObservabilityParams = {
    level: level as GetObservabilityParams['level'],
    pageSize: 100,
    q: query || undefined,
    source: source as GetObservabilityParams['source'],
    timeframeHours,
  };
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
  const logsQuery = useQuery({
    enabled: mode === 'logs' || mode === 'overview' || mode === 'observability',
    queryFn: () => getObservabilityLogs(filters),
    queryKey: ['infrastructure', 'observability', 'logs', filters],
    refetchInterval: mode === 'logs' ? 5_000 : 30_000,
  });
  const requestsQuery = useQuery({
    enabled: mode === 'requests' || mode === 'overview' || mode === 'analytics',
    queryFn: () => getObservabilityRequests(filters),
    queryKey: ['infrastructure', 'observability', 'requests', filters],
  });
  const deploymentsQuery = useQuery({
    enabled: mode === 'deployments',
    queryFn: () => getObservabilityDeployments(filters),
    queryKey: ['infrastructure', 'observability', 'deployments', filters],
  });
  const cronQuery = useQuery({
    enabled: mode === 'cron' || mode === 'observability',
    queryFn: () => getObservabilityCronRuns(filters),
    queryKey: ['infrastructure', 'observability', 'cron-runs', filters],
  });
  const overview = overviewQuery.data;
  const analytics = analyticsQuery.data;

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
          value={formatDuration(overview?.p95DurationMs)}
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
          {(logsQuery.data?.items ?? []).map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </section>
      )}

      {mode === 'requests' && (
        <section className="rounded-lg border border-border bg-background">
          {(requestsQuery.data?.items ?? []).map((request) => (
            <RequestRow key={request.id} request={request} />
          ))}
        </section>
      )}

      {mode === 'deployments' && (
        <section className="rounded-lg border border-border bg-background">
          {(deploymentsQuery.data?.items ?? []).map((deployment) => (
            <div
              className="grid grid-cols-[160px_100px_minmax(0,1fr)_100px_100px] gap-4 border-border/50 border-b px-4 py-3 text-sm"
              key={deployment.deploymentStamp ?? deployment.color ?? 'unknown'}
            >
              <span className="font-mono">
                {deployment.deploymentStamp ?? deployment.color ?? 'unknown'}
              </span>
              <span className="text-dynamic-green">{deployment.status}</span>
              <span className="truncate">
                {deployment.commitSubject ?? deployment.commitHash ?? '-'}
              </span>
              <span>{deployment.requestCount}</span>
              <span className="text-dynamic-red">{deployment.errorCount}</span>
            </div>
          ))}
        </section>
      )}

      {mode === 'cron' && (
        <section className="rounded-lg border border-border bg-background">
          {(cronQuery.data?.items ?? []).map((run) => (
            <div
              className="grid grid-cols-[160px_220px_minmax(0,1fr)_90px_90px] gap-4 border-border/50 border-b px-4 py-3 text-sm"
              key={run.id}
            >
              <span className="font-mono text-muted-foreground">
                {formatTime(run.startedAt)}
              </span>
              <span className="truncate font-mono">{run.jobId}</span>
              <span className="truncate">{run.path}</span>
              <span
                className={run.status === 'failed' ? 'text-dynamic-red' : ''}
              >
                {run.status}
              </span>
              <span>{formatDuration(run.durationMs)}</span>
            </div>
          ))}
        </section>
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
    </div>
  );
}
