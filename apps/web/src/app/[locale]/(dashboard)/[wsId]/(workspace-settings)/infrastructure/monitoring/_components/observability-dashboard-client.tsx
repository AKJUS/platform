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
  getCronMonitoringExecutionArchive,
  getCronMonitoringSnapshot,
  getObservabilityAnalytics,
  getObservabilityCronRuns,
  getObservabilityDeployments,
  getObservabilityLogs,
  getObservabilityOverview,
  getObservabilityRequests,
  getObservabilityResources,
  type ObservabilityDeployment,
  type ObservabilityLogEvent,
  type ObservabilityRequest,
  type ObservabilityResourceBucket,
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
import { type ReactNode, useEffect, useMemo, useState } from 'react';
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
type Tone = 'amber' | 'blue' | 'green' | 'muted' | 'orange' | 'red';

const toneClasses: Record<
  Tone,
  { bar: string; dot: string; soft: string; text: string }
> = {
  amber: {
    bar: 'bg-dynamic-yellow',
    dot: 'bg-dynamic-yellow',
    soft: 'border-dynamic-yellow/30 bg-dynamic-yellow/10',
    text: 'text-dynamic-yellow',
  },
  blue: {
    bar: 'bg-dynamic-blue',
    dot: 'bg-dynamic-blue',
    soft: 'border-dynamic-blue/30 bg-dynamic-blue/10',
    text: 'text-dynamic-blue',
  },
  green: {
    bar: 'bg-dynamic-green',
    dot: 'bg-dynamic-green',
    soft: 'border-dynamic-green/30 bg-dynamic-green/10',
    text: 'text-dynamic-green',
  },
  muted: {
    bar: 'bg-muted-foreground',
    dot: 'bg-muted-foreground',
    soft: 'border-border bg-muted/30',
    text: 'text-muted-foreground',
  },
  orange: {
    bar: 'bg-dynamic-orange',
    dot: 'bg-dynamic-orange',
    soft: 'border-dynamic-orange/30 bg-dynamic-orange/10',
    text: 'text-dynamic-orange',
  },
  red: {
    bar: 'bg-dynamic-red',
    dot: 'bg-dynamic-red',
    soft: 'border-dynamic-red/30 bg-dynamic-red/10',
    text: 'text-dynamic-red',
  },
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

function formatCronUtcTimeInUserTimezone(hour: string, minute: string) {
  const hourNumber = Number.parseInt(hour, 10);
  const minuteNumber = Number.parseInt(minute, 10);

  if (
    !Number.isInteger(hourNumber) ||
    !Number.isInteger(minuteNumber) ||
    hourNumber < 0 ||
    hourNumber > 23 ||
    minuteNumber < 0 ||
    minuteNumber > 59
  ) {
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  const now = new Date();
  const utcDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hourNumber,
      minuteNumber
    )
  );

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(utcDate);
}

function formatClientContext({
  ipAddress,
  userAgent,
}: {
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  return [ipAddress, userAgent].filter(Boolean).join(' · ');
}

function describeCronSchedule(
  schedule: string,
  labels: {
    dailyAt: (time: string) => string;
    everyHours: (count: string) => string;
    everyMinutes: (count: string) => string;
    raw: (schedule: string) => string;
  }
) {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = schedule.split(/\s+/u);
  if (!(minute && hour && dayOfMonth && month && dayOfWeek)) {
    return labels.raw(schedule);
  }

  if (
    minute.startsWith('*/') &&
    hour === '*' &&
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    return labels.everyMinutes(minute.slice(2));
  }

  if (
    minute === '0' &&
    hour.startsWith('*/') &&
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    return labels.everyHours(hour.slice(2));
  }

  if (
    /^\d+$/u.test(minute) &&
    /^\d+$/u.test(hour) &&
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek === '*'
  ) {
    return labels.dailyAt(formatCronUtcTimeInUserTimezone(hour, minute));
  }

  return labels.raw(schedule);
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

function getFiniteValues(values: Array<number | null | undefined>) {
  return values.filter(
    (value): value is number => value != null && Number.isFinite(value)
  );
}

function getMaxValue(values: Array<number | null | undefined>) {
  return Math.max(1, ...getFiniteValues(values));
}

function getPercent(value: number | null | undefined, max: number) {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(2, Math.min(100, (value / max) * 100));
}

function getCpuTone(value: number | null | undefined): Tone {
  if (value == null || !Number.isFinite(value)) return 'muted';
  if (value < 5) return 'green';
  if (value <= 20) return 'amber';
  if (value <= 40) return 'orange';
  return 'red';
}

function getMemoryTone(value: number | null | undefined): Tone {
  if (value == null || !Number.isFinite(value)) return 'muted';

  const mb = value / 1024 / 1024;
  if (mb < 200) return 'green';
  if (mb <= 500) return 'amber';
  if (mb <= 1024) return 'orange';
  return 'red';
}

function getStatusFamilyTone(label: string): Tone {
  if (label === 'serverError') return 'red';
  if (label === 'clientError') return 'orange';
  if (label === 'redirect') return 'blue';
  if (label === 'success') return 'green';
  return 'muted';
}

function getDeploymentStateView(
  deployment: ObservabilityDeployment,
  labels: Record<
    'building' | 'deploying' | 'error' | 'queued' | 'ready',
    string
  >
) {
  const raw = `${deployment.runtimeState ?? ''} ${deployment.status ?? ''}`
    .toLowerCase()
    .trim();

  if (raw.includes('fail') || raw.includes('error')) {
    return { label: labels.error, tone: 'red' as const };
  }

  if (raw.includes('deploy')) {
    return { label: labels.deploying, tone: 'amber' as const };
  }

  if (raw.includes('build')) {
    return { label: labels.building, tone: 'amber' as const };
  }

  if (
    raw.includes('queue') ||
    raw.includes('pending') ||
    raw.includes('waiting')
  ) {
    return { label: labels.queued, tone: 'muted' as const };
  }

  return { label: labels.ready, tone: 'green' as const };
}

function isDeploymentInProgress(deployment: ObservabilityDeployment) {
  return (
    getDeploymentStateView(deployment, {
      building: 'building',
      deploying: 'deploying',
      error: 'error',
      queued: 'queued',
      ready: 'ready',
    }).tone === 'amber'
  );
}

function getElapsedTime(deployment: ObservabilityDeployment, now = Date.now()) {
  if (!deployment.startedAt) return null;

  const elapsed = now - deployment.startedAt;
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;

  return formatDuration(elapsed);
}

function LoadingSkeleton({
  className,
  rows = 1,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn('space-y-3 p-4', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          className="h-12 animate-pulse rounded-md border border-border/50 bg-muted/40"
          key={index}
        />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-56 items-end gap-1 border-border border-b px-4 pb-4">
      {Array.from({ length: 24 }).map((_, index) => (
        <div
          className="flex-1 animate-pulse rounded-t bg-muted"
          key={index}
          style={{ height: `${20 + ((index * 17) % 64)}%` }}
        />
      ))}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid h-56 place-items-center border-border border-b px-4 text-muted-foreground text-sm">
      {label}
    </div>
  );
}

function TrendChart({
  buckets,
  emptyLabel,
  series,
  title,
}: {
  buckets: Array<{
    bucketStart: number;
    cronRuns: number;
    errors: number;
    requests: number;
    serverErrors: number;
  }>;
  emptyLabel: string;
  series: Array<{
    className: string;
    getValue: (bucket: {
      cronRuns: number;
      errors: number;
      requests: number;
      serverErrors: number;
    }) => number;
    label: string;
  }>;
  title: string;
}) {
  const max = getMaxValue(
    buckets.flatMap((bucket) => series.map((item) => item.getValue(bucket)))
  );

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between border-border border-b px-4 py-3">
        <p className="font-medium text-sm">{title}</p>
        <div className="flex items-center gap-3 text-muted-foreground text-xs">
          {series.map((item) => (
            <span className="inline-flex items-center gap-1" key={item.label}>
              <span className={cn('h-2 w-2 rounded-full', item.className)} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      {buckets.length > 0 ? (
        <div className="flex h-56 items-end gap-1 border-border border-b px-4 pt-8 pb-4">
          {buckets.map((bucket) => (
            <div
              className="flex min-w-0 flex-1 items-end gap-px"
              key={bucket.bucketStart}
              title={formatTime(bucket.bucketStart)}
            >
              {series.map((item) => (
                <div
                  className={cn('min-h-1 flex-1 rounded-t', item.className)}
                  key={item.label}
                  style={{
                    height: `${getPercent(item.getValue(bucket), max)}%`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <EmptyChart label={emptyLabel} />
      )}
    </section>
  );
}

function ResourceTrendChart({
  buckets,
  emptyLabel,
  formatter,
  series,
  title,
}: {
  buckets: ObservabilityResourceBucket[];
  emptyLabel: string;
  formatter: (value: number | null | undefined) => string;
  series: Array<{
    getValue: (bucket: ObservabilityResourceBucket) => number | null;
    label: string;
    tone: Tone;
  }>;
  title: string;
}) {
  const values = buckets.flatMap((bucket) =>
    series.map((item) => item.getValue(bucket))
  );
  const max = getMaxValue(values);

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between gap-3 border-border border-b px-4 py-3">
        <p className="font-medium text-sm">{title}</p>
        <div className="flex flex-wrap items-center justify-end gap-3 text-muted-foreground text-xs">
          {series.map((item) => {
            const latest = [...buckets]
              .reverse()
              .map((bucket) => item.getValue(bucket))
              .find((value) => value != null);

            return (
              <span className="inline-flex items-center gap-1" key={item.label}>
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    toneClasses[item.tone].dot
                  )}
                />
                {item.label}
                <span className="font-mono text-foreground">
                  {formatter(latest)}
                </span>
              </span>
            );
          })}
        </div>
      </div>
      {buckets.length > 0 ? (
        <div className="flex h-44 items-end gap-1 px-4 pt-8 pb-4">
          {buckets.map((bucket) => (
            <div
              className="flex min-w-0 flex-1 items-end gap-px"
              key={bucket.bucketStart}
              title={formatTime(bucket.bucketStart)}
            >
              {series.map((item) => (
                <div
                  className={cn(
                    'min-h-1 flex-1 rounded-t',
                    toneClasses[item.tone].bar
                  )}
                  key={item.label}
                  style={{
                    height: `${getPercent(item.getValue(bucket), max)}%`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <EmptyChart label={emptyLabel} />
      )}
    </section>
  );
}

function HorizontalBars({
  emptyLabel,
  rows,
  title,
}: {
  emptyLabel: string;
  rows: Array<{ label: string; tone: Tone; value: number | null | undefined }>;
  title: string;
}) {
  const visibleRows = rows.filter((row) => (row.value ?? 0) > 0);
  const max = getMaxValue(visibleRows.map((row) => row.value));

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="border-border border-b px-4 py-3 font-medium text-sm">
        {title}
      </div>
      {visibleRows.length > 0 ? (
        <div className="grid gap-3 p-4">
          {visibleRows.map((row) => (
            <div className="space-y-1" key={row.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-muted-foreground">
                  {row.label}
                </span>
                <span className="font-mono">{formatNumber(row.value)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full',
                    toneClasses[row.tone].bar
                  )}
                  style={{ width: `${getPercent(row.value, max)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">
          {emptyLabel}
        </div>
      )}
    </section>
  );
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
  const clientContext = formatClientContext(log);

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
        {clientContext ? (
          <p className="mt-1 truncate text-muted-foreground">{clientContext}</p>
        ) : null}
      </div>
    </div>
  );
}

function RequestRow({ request }: { request: ObservabilityRequest }) {
  const clientContext = formatClientContext(request);
  const relatedLogs = request.relatedLogs.slice(0, 2);

  return (
    <div className="grid h-full grid-cols-[140px_72px_76px_minmax(0,1fr)_90px] items-start gap-4 border-border/50 border-b px-4 py-3 font-mono text-xs">
      <span className="text-muted-foreground">
        {formatTime(request.startedAt)}
      </span>
      <span>{request.method ?? request.source.toUpperCase()}</span>
      <span className={statusClass(request.status)}>
        {request.status ?? '-'}
      </span>
      <div className="min-w-0">
        <p className="truncate">{request.path ?? request.id}</p>
        {clientContext ? (
          <p className="mt-1 truncate text-muted-foreground">{clientContext}</p>
        ) : null}
        {relatedLogs.length > 0 ? (
          <div className="mt-2 space-y-1">
            {relatedLogs.map((log) => (
              <p className="truncate text-muted-foreground" key={log.id}>
                <span className={cn('uppercase', statusClass(log.status))}>
                  {log.level}
                </span>{' '}
                {log.message}
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <span className="text-muted-foreground">
        {formatDuration(request.durationMs)}
      </span>
    </div>
  );
}

function DeploymentRow({
  deployment,
  now,
  stateLabels,
}: {
  deployment: ObservabilityDeployment;
  now: number;
  stateLabels: Record<
    'building' | 'deploying' | 'error' | 'queued' | 'ready',
    string
  >;
}) {
  const state = getDeploymentStateView(deployment, stateLabels);
  const elapsed =
    state.tone === 'amber' ? getElapsedTime(deployment, now) : null;
  const hash =
    deployment.commitShortHash ?? deployment.commitHash?.slice(0, 10) ?? '-';

  return (
    <div className="grid h-full grid-cols-[minmax(0,1fr)_110px_110px_100px_90px_120px] items-center gap-4 border-border/50 border-b px-4 py-3 text-sm">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded border border-border/70 bg-muted/30 px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
            {hash}
          </span>
          <span className="truncate font-semibold">
            {deployment.commitSubject ?? tFallbackDeployment(deployment)}
          </span>
        </div>
        <p className="mt-1 truncate font-mono text-muted-foreground text-xs">
          {deployment.deploymentStamp ??
            deployment.color ??
            deployment.commitHash ??
            'unknown'}
        </p>
      </div>
      <div className="min-w-0">
        <span
          className={cn(
            'inline-flex items-center gap-2 font-medium',
            toneClasses[state.tone].text
          )}
        >
          <span
            className={cn('h-2 w-2 rounded-full', toneClasses[state.tone].dot)}
          />
          {state.label}
        </span>
      </div>
      <span className="font-mono text-muted-foreground text-xs">
        {elapsed ?? formatDuration(deployment.durationMs)}
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
  const [now, setNow] = useState(() => Date.now());
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
    enabled:
      mode === 'analytics' || mode === 'observability' || mode === 'overview',
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
    refetchInterval: (query) => {
      const data = query.state.data as
        | InfiniteData<DeploymentsPage>
        | undefined;
      const items = data?.pages.flatMap((page) => page.items) ?? [];
      return items.some(isDeploymentInProgress) ? 2_000 : false;
    },
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
    queryFn: () => getObservabilityResources({ timeframeHours }),
    queryKey: ['infrastructure', 'observability', 'resources', timeframeHours],
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
  const hasDeploymentInProgress = deployments.some(isDeploymentInProgress);
  const cronExecutions = useMemo(
    () => cronExecutionsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [cronExecutionsQuery.data]
  );
  const logsTotal = logsQuery.data?.pages[0]?.total ?? 0;
  const requestsTotal = requestsQuery.data?.pages[0]?.total ?? 0;
  const deploymentsTotal = deploymentsQuery.data?.pages[0]?.total ?? 0;
  const cronExecutionsTotal = cronExecutionsQuery.data?.pages[0]?.total ?? 0;
  const newRequestCount = newRequestsQuery.data?.total ?? 0;
  const resourceBuckets = resourcesQuery.data?.buckets ?? [];

  useEffect(() => {
    if (mode !== 'deployments' || !hasDeploymentInProgress) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [hasDeploymentInProgress, mode]);
  const infiniteLabels = {
    end: t('infinite.end'),
    loading: t('infinite.loading'),
    more: t('infinite.more'),
  };
  const deploymentStateLabels = {
    building: t('deployment_states.building'),
    deploying: t('deployment_states.deploying'),
    error: t('deployment_states.error'),
    queued: t('deployment_states.queued'),
    ready: t('deployment_states.ready'),
  };
  const cronScheduleLabels = {
    dailyAt: (time: string) => cronT('schedule.daily_at', { time }),
    everyHours: (count: string) => cronT('schedule.every_hours', { count }),
    everyMinutes: (count: string) => cronT('schedule.every_minutes', { count }),
    raw: (schedule: string) => cronT('schedule.raw', { schedule }),
  };
  const statusFamilyLabels = {
    clientError: t('status_families.clientError'),
    redirect: t('status_families.redirect'),
    serverError: t('status_families.serverError'),
    success: t('status_families.success'),
    unknown: t('status_families.unknown'),
  };
  const analyticsBuckets = analytics?.buckets ?? [];
  const statusRows = Object.entries(analytics?.statusFamilies ?? {}).map(
    ([label, value]) => ({
      label:
        statusFamilyLabels[label as keyof typeof statusFamilyLabels] ?? label,
      tone: getStatusFamilyTone(label),
      value,
    })
  );
  const sourceRows = Object.entries(overview?.sourceCounts ?? {}).map(
    ([label, value]) => ({
      label: label.toUpperCase(),
      tone: (label === 'cron'
        ? 'amber'
        : label === 'api'
          ? 'blue'
          : 'green') as Tone,
      value,
    })
  );
  const topRouteRows = (overview?.topRoutes ?? []).map((route) => ({
    label: route.path,
    tone: route.errorCount > 0 ? ('red' as const) : ('blue' as const),
    value: route.requestCount,
  }));
  const slowRouteRows = (analytics?.topRoutes ?? overview?.topRoutes ?? []).map(
    (route) => ({
      label: route.path,
      tone: route.errorCount > 0 ? ('red' as const) : ('orange' as const),
      value: route.averageDurationMs ?? 0,
    })
  );
  const cronJobRows = (analytics?.topCronJobs ?? []).map((job) => ({
    label: job.jobId,
    tone: job.failureCount > 0 ? ('red' as const) : ('green' as const),
    value: job.runCount,
  }));

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
            <option value={6}>{t('last_6_hours')}</option>
            <option value={12}>{t('last_12_hours')}</option>
            <option value={24}>{t('last_24_hours')}</option>
            <option value={72}>{t('last_3_days')}</option>
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

      {overviewQuery.isLoading ? (
        <section className="grid overflow-hidden rounded-lg border border-border md:grid-cols-4">
          <LoadingSkeleton rows={1} />
          <LoadingSkeleton rows={1} />
          <LoadingSkeleton rows={1} />
          <LoadingSkeleton rows={1} />
        </section>
      ) : (
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
      )}

      {mode === 'overview' &&
        (analyticsQuery.isLoading ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg border border-border bg-background">
              <ChartSkeleton />
            </section>
            <section className="rounded-lg border border-border bg-background">
              <LoadingSkeleton rows={5} />
            </section>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            <TrendChart
              buckets={analyticsBuckets}
              emptyLabel={t('charts.no_data')}
              series={[
                {
                  className: 'bg-dynamic-blue',
                  getValue: (bucket) => bucket.requests,
                  label: t('charts.requests'),
                },
                {
                  className: 'bg-dynamic-red',
                  getValue: (bucket) => bucket.serverErrors,
                  label: t('charts.server_errors'),
                },
              ]}
              title={t('charts.request_trend')}
            />
            <HorizontalBars
              emptyLabel={t('charts.no_data')}
              rows={statusRows}
              title={t('charts.status_distribution')}
            />
            <HorizontalBars
              emptyLabel={t('charts.no_data')}
              rows={topRouteRows}
              title={t('charts.route_pressure')}
            />
            <HorizontalBars
              emptyLabel={t('charts.no_data')}
              rows={sourceRows}
              title={t('charts.source_mix')}
            />
          </div>
        ))}

      {mode === 'logs' && (
        <section className="rounded-lg border border-border bg-background">
          <div className="grid grid-cols-[140px_72px_90px_minmax(0,1fr)] gap-4 border-border border-b px-4 py-3 text-muted-foreground text-xs">
            <span>{t('columns.time')}</span>
            <span>{t('columns.level')}</span>
            <span>{t('columns.status')}</span>
            <span>{t('columns.message')}</span>
          </div>
          {logsQuery.isLoading ? (
            <LoadingSkeleton rows={8} />
          ) : (
            <VirtualizedList
              empty={t('empty.logs')}
              estimateRowHeight={66}
              hasMore={logsQuery.hasNextPage}
              isFetchingMore={logsQuery.isFetchingNextPage}
              items={logs}
              onEndReached={() => void logsQuery.fetchNextPage()}
              renderRow={(log) => <LogRow key={log.id} log={log} />}
            />
          )}
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
          {requestsQuery.isLoading ? (
            <LoadingSkeleton rows={8} />
          ) : (
            <VirtualizedList
              empty={t('empty.requests')}
              estimateRowHeight={96}
              hasMore={requestsQuery.hasNextPage}
              isFetchingMore={requestsQuery.isFetchingNextPage}
              items={requests}
              onEndReached={() => void requestsQuery.fetchNextPage()}
              renderRow={(request) => (
                <RequestRow key={request.id} request={request} />
              )}
            />
          )}
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
          {deploymentsQuery.isLoading ? (
            <LoadingSkeleton rows={8} />
          ) : (
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
                  now={now}
                  stateLabels={deploymentStateLabels}
                />
              )}
            />
          )}
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
          <section className="grid overflow-hidden rounded-lg border border-border md:grid-cols-4">
            <MetricCard
              label={t('cron.summary.runner')}
              meta={t('cron.summary.runner_meta')}
              value={cronSnapshot?.status ?? '-'}
            />
            <MetricCard
              label={t('cron.summary.enabled_jobs')}
              meta={`${formatNumber(
                cronSnapshot?.overview.enabledJobs
              )} / ${formatNumber(cronSnapshot?.overview.totalJobs)}`}
              value={formatNumber(cronSnapshot?.overview.enabledJobs)}
            />
            <MetricCard
              label={t('cron.summary.queue')}
              meta={`${t('cron.summary.processing')}: ${formatNumber(
                cronSnapshot?.overview.processingRuns
              )}`}
              value={formatNumber(cronSnapshot?.overview.queuedRuns)}
            />
            <MetricCard
              label={t('cron.summary.next_run')}
              meta={t('cron.summary.next_run_meta')}
              value={formatTime(cronSnapshot?.nextRunAt)}
            />
          </section>

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
            {cronSnapshotQuery.isLoading ? (
              <LoadingSkeleton rows={5} />
            ) : (
              (cronSnapshot?.jobs ?? []).map((job) => (
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
                    <div className="mt-2 grid gap-1 text-muted-foreground text-xs sm:grid-cols-3">
                      <span>
                        {describeCronSchedule(job.schedule, cronScheduleLabels)}
                      </span>
                      <span>
                        {cronT('last_run')}:{' '}
                        {formatTime(
                          job.lastExecution?.startedAt ?? job.lastScheduledAt
                        )}
                      </span>
                      <span>
                        {cronT('next_run')}: {formatTime(job.nextRunAt)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge className="rounded-full" variant="outline">
                        {t('cron.last_status')}:{' '}
                        {job.lastExecution?.status ?? '-'}
                      </Badge>
                      <Badge className="rounded-full" variant="outline">
                        {t('cron.last_duration')}:{' '}
                        {formatDuration(job.lastExecution?.durationMs)}
                      </Badge>
                      <Badge
                        className={cn(
                          'rounded-full',
                          job.failureStreak > 0
                            ? 'border-dynamic-red/35 text-dynamic-red'
                            : 'border-dynamic-green/35 text-dynamic-green'
                        )}
                        variant="outline"
                      >
                        {t('cron.failure_streak')}:{' '}
                        {formatNumber(job.failureStreak)}
                      </Badge>
                    </div>
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
              ))
            )}
          </section>

          <section className="rounded-lg border border-border bg-background">
            <div className="border-border border-b px-4 py-3">
              <p className="font-medium text-sm">{cronT('executions_title')}</p>
              <p className="text-muted-foreground text-xs">
                {cronT('executions_description')}
              </p>
            </div>
            {cronExecutionsQuery.isLoading ? (
              <LoadingSkeleton rows={8} />
            ) : (
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
            )}
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
        <div className="space-y-4">
          {analyticsQuery.isLoading ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-lg border border-border bg-background">
                <ChartSkeleton />
              </section>
              <section className="rounded-lg border border-border bg-background">
                <LoadingSkeleton rows={5} />
              </section>
            </div>
          ) : (
            <>
              <TrendChart
                buckets={analyticsBuckets}
                emptyLabel={t('charts.no_data')}
                series={[
                  {
                    className: 'bg-dynamic-blue',
                    getValue: (bucket) => bucket.requests,
                    label: t('charts.requests'),
                  },
                  {
                    className: 'bg-dynamic-red',
                    getValue: (bucket) => bucket.serverErrors,
                    label: t('charts.server_errors'),
                  },
                  {
                    className: 'bg-dynamic-orange',
                    getValue: (bucket) => bucket.cronRuns,
                    label: t('charts.cron_runs'),
                  },
                ]}
                title={t('charts.request_trend')}
              />
              <div className="grid gap-4 xl:grid-cols-3">
                <HorizontalBars
                  emptyLabel={t('charts.no_data')}
                  rows={statusRows}
                  title={t('charts.status_distribution')}
                />
                <HorizontalBars
                  emptyLabel={t('charts.no_data')}
                  rows={topRouteRows}
                  title={t('charts.route_pressure')}
                />
                <HorizontalBars
                  emptyLabel={t('charts.no_data')}
                  rows={cronJobRows}
                  title={t('charts.cron_hotspots')}
                />
              </div>
            </>
          )}
        </div>
      )}

      {mode === 'observability' && (
        <div className="space-y-4">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              [t('signals.server_errors'), overview?.serverErrorCount, 'red'],
              [
                t('signals.slow_requests'),
                overview?.slowRequestCount,
                'orange',
              ],
              [
                t('signals.cron_failure_rate'),
                overview?.cronFailureRate,
                'amber',
              ],
              [
                t('signals.active_sources'),
                Object.keys(overview?.sourceCounts ?? {}).length,
                'green',
              ],
            ].map(([label, value, tone]) => (
              <div
                className={cn(
                  'rounded-lg border bg-background p-4',
                  toneClasses[tone as Tone].soft
                )}
                key={label}
              >
                <FileText
                  className={cn('mb-4 h-4 w-4', toneClasses[tone as Tone].text)}
                />
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="mt-2 font-semibold text-2xl">
                  {formatNumber(value as number)}
                </p>
              </div>
            ))}
          </section>
          <section className="grid overflow-hidden rounded-lg border border-border md:grid-cols-4">
            <MetricCard
              label={t('signals.error_rate')}
              meta={t('signals.error_rate_meta')}
              value={`${formatNumber(overview?.errorRate)}%`}
            />
            <MetricCard
              label={t('signals.p95_latency')}
              meta={t('signals.p95_latency_meta')}
              value={formatLatencyMs(overview?.p95DurationMs)}
            />
            <MetricCard
              label={t('signals.last_event')}
              meta={t('signals.last_event_meta')}
              value={formatTime(overview?.lastEventAt)}
            />
            <MetricCard
              label={t('signals.routes')}
              meta={t('signals.routes_meta')}
              value={formatNumber(overview?.topRoutes.length)}
            />
          </section>
          {analyticsQuery.isLoading ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-lg border border-border bg-background">
                <LoadingSkeleton rows={6} />
              </section>
              <section className="rounded-lg border border-border bg-background">
                <ChartSkeleton />
              </section>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              <HorizontalBars
                emptyLabel={t('charts.no_data')}
                rows={slowRouteRows}
                title={t('charts.latency_pressure')}
              />
              <HorizontalBars
                emptyLabel={t('charts.no_data')}
                rows={cronJobRows}
                title={t('charts.cron_hotspots')}
              />
              <HorizontalBars
                emptyLabel={t('charts.no_data')}
                rows={sourceRows}
                title={t('charts.source_mix')}
              />
              <HorizontalBars
                emptyLabel={t('charts.no_data')}
                rows={topRouteRows}
                title={t('charts.route_pressure')}
              />
              <TrendChart
                buckets={analyticsBuckets}
                emptyLabel={t('charts.no_data')}
                series={[
                  {
                    className: 'bg-dynamic-red',
                    getValue: (bucket) => bucket.errors,
                    label: t('charts.errors'),
                  },
                  {
                    className: 'bg-dynamic-orange',
                    getValue: (bucket) => bucket.cronRuns,
                    label: t('charts.cron_runs'),
                  },
                ]}
                title={t('charts.incident_trend')}
              />
              <section className="rounded-lg border border-border bg-background">
                <div className="border-border border-b px-4 py-3 font-medium text-sm">
                  {t('recent_errors')}
                </div>
                {(overview?.recentErrors ?? []).length > 0 ? (
                  (overview?.recentErrors ?? []).map((log) => (
                    <LogRow key={log.id} log={log} />
                  ))
                ) : (
                  <div className="px-4 py-12 text-center text-muted-foreground text-sm">
                    {t('charts.no_data')}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      {mode === 'resources' && (
        <div className="space-y-4">
          <section className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-sm">
                {t('resources.resource_history')}
              </p>
              <p className="text-muted-foreground text-xs">
                {t('resources.resource_history_meta')}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  [1, t('last_hour')],
                  [6, t('last_6_hours')],
                  [12, t('last_12_hours')],
                  [24, t('last_24_hours')],
                  [72, t('last_3_days')],
                  [168, t('last_7_days')],
                ] as const
              ).map(([value, label]) => (
                <button
                  className={cn(
                    'rounded-md border px-2.5 py-1.5 text-xs',
                    timeframeHours === value
                      ? 'border-dynamic-blue/60 bg-dynamic-blue/10 text-dynamic-blue'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                  key={value}
                  onClick={() => void setTimeframeHours(value)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {resourcesQuery.isLoading ? (
            <div className="grid gap-4 xl:grid-cols-3">
              <section className="rounded-lg border border-border bg-background">
                <ChartSkeleton />
              </section>
              <section className="rounded-lg border border-border bg-background">
                <ChartSkeleton />
              </section>
              <section className="rounded-lg border border-border bg-background">
                <ChartSkeleton />
              </section>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              <ResourceTrendChart
                buckets={resourceBuckets}
                emptyLabel={t('charts.no_data')}
                formatter={(value) => `${formatNumber(value)}%`}
                series={[
                  {
                    getValue: (bucket) => bucket.cpuPercent,
                    label: t('resources.cpu'),
                    tone: getCpuTone(resources?.totalCpuPercent),
                  },
                ]}
                title={t('resources.cpu_trend')}
              />
              <ResourceTrendChart
                buckets={resourceBuckets}
                emptyLabel={t('charts.no_data')}
                formatter={formatBytes}
                series={[
                  {
                    getValue: (bucket) => bucket.memoryBytes,
                    label: t('resources.memory'),
                    tone: getMemoryTone(resources?.totalMemoryBytes),
                  },
                ]}
                title={t('resources.memory_trend')}
              />
              <ResourceTrendChart
                buckets={resourceBuckets}
                emptyLabel={t('charts.no_data')}
                formatter={formatBytes}
                series={[
                  {
                    getValue: (bucket) => bucket.rxBytes,
                    label: t('resources.rx'),
                    tone: 'blue',
                  },
                  {
                    getValue: (bucket) => bucket.txBytes,
                    label: t('resources.tx'),
                    tone: 'amber',
                  },
                ]}
                title={t('resources.network_trend')}
              />
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-lg border border-border bg-background">
              <div className="grid grid-cols-[minmax(0,1fr)_90px_90px_120px_120px_120px] gap-4 border-border border-b px-4 py-3 text-muted-foreground text-xs">
                <span>{t('resources.container')}</span>
                <span>{t('resources.health')}</span>
                <span>{t('resources.uptime')}</span>
                <span>{t('resources.cpu')}</span>
                <span>{t('resources.memory')}</span>
                <span>{t('resources.network')}</span>
              </div>
              {resourcesQuery.isLoading ? (
                <LoadingSkeleton rows={8} />
              ) : (resources?.allContainers ?? []).length > 0 ? (
                (resources?.allContainers ?? []).map((container) => {
                  const cpuTone = getCpuTone(container.cpuPercent);
                  const memoryTone = getMemoryTone(container.memoryBytes);
                  const memoryMb =
                    container.memoryBytes == null
                      ? null
                      : container.memoryBytes / 1024 / 1024;

                  return (
                    <div
                      className="grid grid-cols-[minmax(0,1fr)_90px_90px_120px_120px_120px] items-center gap-4 border-border/50 border-b px-4 py-3 text-sm"
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
                      <span className="font-mono text-muted-foreground text-xs">
                        {container.runningFor ?? '-'}
                      </span>
                      <div>
                        <span
                          className={cn(
                            'font-medium',
                            toneClasses[cpuTone].text
                          )}
                        >
                          {formatNumber(container.cpuPercent)}%
                        </span>
                        <div className="mt-1 h-1 rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              toneClasses[cpuTone].bar
                            )}
                            style={{
                              width: `${getPercent(container.cpuPercent, 40)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <span
                          className={cn(
                            'font-medium',
                            toneClasses[memoryTone].text
                          )}
                        >
                          {formatBytes(container.memoryBytes)}
                        </span>
                        <div className="mt-1 h-1 rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              toneClasses[memoryTone].bar
                            )}
                            style={{
                              width: `${getPercent(memoryMb, 1024)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="font-mono text-muted-foreground text-xs">
                        {formatBytes(container.rxBytes)} /{' '}
                        {formatBytes(container.txBytes)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-12 text-center text-muted-foreground text-sm">
                  {t('empty.containers')}
                </div>
              )}
            </section>
            <section className="rounded-lg border border-border bg-background p-4">
              <Terminal className="mb-3 h-4 w-4 text-muted-foreground" />
              <p className="font-medium text-sm">{t('resources.summary')}</p>
              {resourcesQuery.isLoading ? (
                <LoadingSkeleton className="px-0" rows={5} />
              ) : (
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
                    label={t('resources.network')}
                    value={`${formatBytes(resources?.totalRxBytes)} / ${formatBytes(resources?.totalTxBytes)}`}
                  />
                  <MetricCard
                    label={t('resources.services')}
                    value={formatNumber(resources?.serviceHealth.length)}
                  />
                </div>
              )}
            </section>
          </div>
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
