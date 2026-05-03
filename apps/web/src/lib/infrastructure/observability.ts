import type {
  BlueGreenMonitoringRequestConsoleLog,
  BlueGreenMonitoringRequestLog,
  BlueGreenMonitoringWatcherLog,
  ObservabilityAnalytics,
  ObservabilityCronRun,
  ObservabilityDeployment,
  ObservabilityLogEvent,
  ObservabilityOverview,
  ObservabilityPaginatedResult,
  ObservabilityRequest,
} from '@tuturuuu/internal-api/infrastructure';
import {
  readBlueGreenMonitoringRequestArchive,
  readBlueGreenMonitoringSnapshot,
  readBlueGreenMonitoringWatcherLogArchive,
} from './blue-green-monitoring';
import { readCronExecutionArchive } from './cron-monitoring';
import { ensureLogDrainSchema, getLogDrainSqlClient } from './log-drain';

interface ObservabilityFilters {
  level?: string | null;
  page?: number;
  pageSize?: number;
  q?: string | null;
  source?: string | null;
  status?: string | null;
  timeframeHours?: number;
}

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_TIMEFRAME_HOURS = 24;
const MAX_PAGE_SIZE = 200;
const MAX_AGGREGATE_ROWS = 5_000;

function clampPage(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function clampPageSize(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Math.min(
    Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );
}

function clampTimeframeHours(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, 24 * 90)
    : DEFAULT_TIMEFRAME_HOURS;
}

export function parseObservabilityFilters(
  searchParams: URLSearchParams
): Required<
  Pick<ObservabilityFilters, 'page' | 'pageSize' | 'timeframeHours'>
> &
  Omit<ObservabilityFilters, 'page' | 'pageSize' | 'timeframeHours'> {
  const normalize = (value: string | null) => {
    const trimmed = value?.trim();
    return trimmed && trimmed !== 'all' ? trimmed : null;
  };

  return {
    level: normalize(searchParams.get('level')),
    page: clampPage(searchParams.get('page')),
    pageSize: clampPageSize(searchParams.get('pageSize')),
    q: normalize(searchParams.get('q')),
    source: normalize(searchParams.get('source')),
    status: normalize(searchParams.get('status')),
    timeframeHours: clampTimeframeHours(searchParams.get('timeframeHours')),
  };
}

function toMs(value: Date | string | number | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function statusMatches(
  status: number | null,
  filter: string | null | undefined
) {
  if (!filter) {
    return true;
  }

  if (filter === '5xx') {
    return status != null && status >= 500;
  }

  if (filter === '4xx') {
    return status != null && status >= 400 && status < 500;
  }

  if (filter === '3xx') {
    return status != null && status >= 300 && status < 400;
  }

  if (filter === '2xx') {
    return status != null && status >= 200 && status < 300;
  }

  return String(status) === filter;
}

async function getSql() {
  await ensureLogDrainSchema();
  return getLogDrainSqlClient();
}

function paginate<T>(
  items: T[],
  filters: Required<Pick<ObservabilityFilters, 'page' | 'pageSize'>>
): ObservabilityPaginatedResult<T> {
  const offset = (filters.page - 1) * filters.pageSize;
  const pageItems = items.slice(offset, offset + filters.pageSize);

  return {
    hasNextPage: offset + filters.pageSize < items.length,
    items: pageItems,
    page: filters.page,
    pageSize: filters.pageSize,
    total: items.length,
  };
}

function filterText(value: string | null | undefined, q: string) {
  return value?.toLowerCase().includes(q.toLowerCase()) ?? false;
}

function shouldIncludeText(
  q: string | null | undefined,
  values: Array<string | null | undefined>
) {
  const normalized = q?.trim();
  return !normalized || values.some((value) => filterText(value, normalized));
}

function mapLegacyRequest(request: BlueGreenMonitoringRequestLog) {
  const startedAt = request.time;
  const id = `legacy-request-${request.time}-${request.method ?? 'GET'}-${request.path}`;

  return {
    cronJobId: null,
    deploymentColor: request.deploymentColor,
    deploymentStamp: request.deploymentStamp,
    durationMs: request.requestTimeMs,
    endedAt: startedAt + (request.requestTimeMs ?? 0),
    errorMessage: null,
    id,
    logCount: request.consoleLogs?.length ?? 0,
    method: request.method,
    path: request.path,
    source: 'api' as const,
    startedAt,
    status: request.status,
  };
}

function mapLegacyWatcherLog(
  log: BlueGreenMonitoringWatcherLog
): ObservabilityLogEvent {
  return {
    createdAt: log.time,
    deploymentColor: log.activeColor,
    deploymentStamp: log.deploymentStamp,
    durationMs: null,
    errorName: null,
    errorStack: null,
    id: `legacy-watcher-${log.time}-${log.message}`,
    level:
      log.level === 'error' || log.level === 'warn' || log.level === 'debug'
        ? log.level
        : 'info',
    message: log.message,
    metadata: {
      commitHash: log.commitHash,
      deploymentKey: log.deploymentKey,
      deploymentKind: log.deploymentKind,
      deploymentStatus: log.deploymentStatus,
      legacySource: 'blue-green-watcher',
    },
    requestId: null,
    route: null,
    source: 'server',
    status: null,
  };
}

function mapLegacyConsoleLog(
  log: BlueGreenMonitoringRequestConsoleLog,
  request: BlueGreenMonitoringRequestLog
): ObservabilityLogEvent {
  return {
    createdAt: log.time,
    deploymentColor: log.deploymentColor ?? request.deploymentColor,
    deploymentStamp: request.deploymentStamp,
    durationMs: request.requestTimeMs,
    errorName: null,
    errorStack: null,
    id: `legacy-console-${log.time}-${request.path}-${log.message}`,
    level:
      log.level === 'error' || log.level === 'warn' || log.level === 'debug'
        ? log.level
        : 'info',
    message: log.message,
    metadata: {
      containerId: log.containerId,
      legacySource: 'blue-green-request-console',
    },
    requestId: `legacy-request-${request.time}-${request.method ?? 'GET'}-${request.path}`,
    route: request.path,
    source: 'api',
    status: request.status,
  };
}

function getLegacyTimeframeDays(timeframeHours: number) {
  return Math.max(1, Math.ceil(timeframeHours / 24));
}

function loadLegacyRequests(
  filters: Required<Pick<ObservabilityFilters, 'timeframeHours'>> &
    Omit<ObservabilityFilters, 'timeframeHours'>
) {
  const archive = readBlueGreenMonitoringRequestArchive({
    page: 1,
    pageSize: 100,
    q: filters.q ?? undefined,
    status: filters.status ?? undefined,
    timeframeDays: getLegacyTimeframeDays(filters.timeframeHours),
  });
  const cutoff = Date.now() - filters.timeframeHours * 60 * 60 * 1000;

  return archive.items
    .filter((request) => request.time >= cutoff)
    .filter((request) => statusMatches(request.status, filters.status))
    .filter((request) =>
      shouldIncludeText(filters.q, [
        request.path,
        request.host,
        request.method,
        request.deploymentStamp,
      ])
    )
    .map(mapLegacyRequest);
}

function loadLegacyLogs(
  filters: Required<Pick<ObservabilityFilters, 'timeframeHours'>> &
    Omit<ObservabilityFilters, 'timeframeHours'>
) {
  const cutoff = Date.now() - filters.timeframeHours * 60 * 60 * 1000;
  const watcherLogs = readBlueGreenMonitoringWatcherLogArchive({
    page: 1,
    pageSize: 100,
  }).items.map(mapLegacyWatcherLog);
  const requestConsoleLogs = readBlueGreenMonitoringRequestArchive({
    page: 1,
    pageSize: 100,
    q: filters.q ?? undefined,
    status: filters.status ?? undefined,
    timeframeDays: getLegacyTimeframeDays(filters.timeframeHours),
  }).items.flatMap((request) =>
    (request.consoleLogs ?? []).map((log) => mapLegacyConsoleLog(log, request))
  );

  return [...watcherLogs, ...requestConsoleLogs]
    .filter((log) => log.createdAt >= cutoff)
    .filter((log) => !filters.level || log.level === filters.level)
    .filter((log) => !filters.source || log.source === filters.source)
    .filter((log) => statusMatches(log.status, filters.status))
    .filter((log) =>
      shouldIncludeText(filters.q, [
        log.message,
        log.route,
        log.requestId,
        log.deploymentStamp,
      ])
    );
}

async function loadRecentLogs(
  filters: Required<Pick<ObservabilityFilters, 'timeframeHours'>> &
    Omit<ObservabilityFilters, 'timeframeHours'>
) {
  const sql = await getSql();
  if (!sql) {
    return loadLegacyLogs(filters);
  }

  const rows = await sql<
    Array<{
      created_at: Date;
      deployment_color: string | null;
      deployment_stamp: string | null;
      duration_ms: number | null;
      error_name: string | null;
      error_stack: string | null;
      id: string;
      level: ObservabilityLogEvent['level'];
      message: string;
      metadata: Record<string, unknown> | null;
      request_id: string | null;
      route: string | null;
      source: ObservabilityLogEvent['source'];
      status: number | null;
    }>
  >`
    SELECT
      id::text,
      request_id,
      source,
      level,
      message,
      route,
      status,
      duration_ms,
      deployment_color,
      deployment_stamp,
      error_name,
      error_stack,
      metadata,
      created_at
    FROM log_events
    WHERE created_at >= now() - make_interval(hours => ${filters.timeframeHours})
    ORDER BY created_at DESC
    LIMIT ${MAX_AGGREGATE_ROWS}
  `;

  const q = filters.q?.trim();

  const postgresLogs = rows
    .filter((row) => !filters.level || row.level === filters.level)
    .filter((row) => !filters.source || row.source === filters.source)
    .filter((row) => statusMatches(row.status, filters.status))
    .filter(
      (row) =>
        !q ||
        filterText(row.message, q) ||
        filterText(row.route, q) ||
        filterText(row.request_id, q)
    )
    .map((row) => ({
      createdAt: toMs(row.created_at) ?? Date.now(),
      deploymentColor: row.deployment_color,
      deploymentStamp: row.deployment_stamp,
      durationMs: row.duration_ms,
      errorName: row.error_name,
      errorStack: row.error_stack,
      id: row.id,
      level: row.level,
      message: row.message,
      metadata: toRecord(row.metadata),
      requestId: row.request_id,
      route: row.route,
      source: row.source,
      status: row.status,
    }));

  return [...postgresLogs, ...loadLegacyLogs(filters)].sort(
    (left, right) => right.createdAt - left.createdAt
  );
}

async function loadRecentRequests(
  filters: Required<Pick<ObservabilityFilters, 'timeframeHours'>> &
    Omit<ObservabilityFilters, 'timeframeHours'>
) {
  const sql = await getSql();
  if (!sql) {
    return loadLegacyRequests(filters);
  }

  const rows = await sql<
    Array<{
      cron_job_id: string | null;
      deployment_color: string | null;
      deployment_stamp: string | null;
      duration_ms: number | null;
      ended_at: Date;
      error_message: string | null;
      id: string;
      log_count: number;
      method: string | null;
      path: string | null;
      source: ObservabilityRequest['source'];
      started_at: Date;
      status: number | null;
    }>
  >`
    SELECT
      requests.id,
      requests.source,
      requests.method,
      requests.path,
      requests.status,
      requests.duration_ms,
      requests.deployment_color,
      requests.deployment_stamp,
      requests.cron_job_id,
      requests.error_message,
      requests.started_at,
      requests.ended_at,
      count(log_events.id)::int AS log_count
    FROM requests
    LEFT JOIN log_events ON log_events.request_id = requests.id
    WHERE requests.started_at >= now() - make_interval(hours => ${filters.timeframeHours})
    GROUP BY requests.id
    ORDER BY requests.started_at DESC
    LIMIT ${MAX_AGGREGATE_ROWS}
  `;

  const q = filters.q?.trim();

  const postgresRequests = rows
    .filter((row) => !filters.source || row.source === filters.source)
    .filter((row) => statusMatches(row.status, filters.status))
    .filter(
      (row) =>
        !q ||
        filterText(row.path, q) ||
        filterText(row.id, q) ||
        filterText(row.error_message, q) ||
        filterText(row.cron_job_id, q)
    )
    .map((row) => ({
      cronJobId: row.cron_job_id,
      deploymentColor: row.deployment_color,
      deploymentStamp: row.deployment_stamp,
      durationMs: row.duration_ms,
      endedAt: toMs(row.ended_at) ?? Date.now(),
      errorMessage: row.error_message,
      id: row.id,
      logCount: row.log_count,
      method: row.method,
      path: row.path,
      source: row.source,
      startedAt: toMs(row.started_at) ?? Date.now(),
      status: row.status,
    }));

  return [...postgresRequests, ...loadLegacyRequests(filters)].sort(
    (left, right) => right.startedAt - left.startedAt
  );
}

export async function readObservabilityLogs(
  filters: ObservabilityFilters = {}
) {
  return paginate(await loadRecentLogs(parseFilterDefaults(filters)), {
    page: clampPage(filters.page),
    pageSize: clampPageSize(filters.pageSize),
  });
}

export async function readObservabilityRequests(
  filters: ObservabilityFilters = {}
) {
  return paginate(await loadRecentRequests(parseFilterDefaults(filters)), {
    page: clampPage(filters.page),
    pageSize: clampPageSize(filters.pageSize),
  });
}

export async function readObservabilityCronRuns(
  filters: ObservabilityFilters = {}
) {
  const sql = await getSql();
  if (!sql) {
    const archive = readCronExecutionArchive({
      page: clampPage(filters.page),
      pageSize: clampPageSize(filters.pageSize),
    });
    return {
      hasNextPage: archive.hasNextPage,
      items: archive.items.map((item) => ({
        durationMs: item.durationMs,
        endedAt: item.endedAt,
        errorMessage: item.error,
        httpStatus: item.httpStatus,
        id: item.id,
        jobId: item.jobId,
        path: item.path,
        requestId: item.triggerId,
        startedAt: item.startedAt,
        status: item.status,
      })),
      page: archive.page,
      pageSize: archive.limit,
      total: archive.total,
    };
  }

  const normalized = parseFilterDefaults(filters);
  const rows = await sql<
    Array<{
      duration_ms: number | null;
      ended_at: Date;
      error_message: string | null;
      http_status: number | null;
      id: string;
      job_id: string;
      path: string;
      request_id: string | null;
      started_at: Date;
      status: string;
    }>
  >`
    SELECT id, request_id, job_id, path, status, http_status, duration_ms, error_message, started_at, ended_at
    FROM cron_runs
    WHERE started_at >= now() - make_interval(hours => ${normalized.timeframeHours})
    ORDER BY started_at DESC
    LIMIT ${MAX_AGGREGATE_ROWS}
  `;

  const q = normalized.q?.trim();
  const items = rows
    .filter((row) => statusMatches(row.http_status, normalized.status))
    .filter(
      (row) =>
        !q ||
        filterText(row.id, q) ||
        filterText(row.job_id, q) ||
        filterText(row.path, q) ||
        filterText(row.error_message, q)
    )
    .map(
      (row): ObservabilityCronRun => ({
        durationMs: row.duration_ms,
        endedAt: toMs(row.ended_at) ?? Date.now(),
        errorMessage: row.error_message,
        httpStatus: row.http_status,
        id: row.id,
        jobId: row.job_id,
        path: row.path,
        requestId: row.request_id,
        startedAt: toMs(row.started_at) ?? Date.now(),
        status: row.status,
      })
    );

  return paginate(items, {
    page: clampPage(filters.page),
    pageSize: clampPageSize(filters.pageSize),
  });
}

export async function readObservabilityDeployments(
  filters: ObservabilityFilters = {}
) {
  const requests = await loadRecentRequests(parseFilterDefaults(filters));
  const byStamp = new Map<string, ObservabilityDeployment>();
  const snapshot = readBlueGreenMonitoringSnapshot({
    requestPreviewLimit: 0,
    watcherLogLimit: 0,
  });

  for (const deployment of snapshot.deployments) {
    const key =
      deployment.deploymentStamp ??
      deployment.commitHash ??
      deployment.activeColor ??
      'unknown';
    byStamp.set(key, {
      color: deployment.activeColor ?? null,
      commitHash: deployment.commitHash ?? null,
      commitShortHash: deployment.commitShortHash ?? null,
      commitSubject: deployment.commitSubject ?? null,
      deploymentStamp: deployment.deploymentStamp ?? null,
      durationMs: deployment.buildDurationMs ?? deployment.lifetimeMs ?? null,
      errorCount: deployment.errorCount ?? 0,
      lastRequestAt: deployment.lastRequestAt ?? null,
      requestCount: deployment.requestCount ?? 0,
      runtimeState: deployment.runtimeState ?? null,
      startedAt: deployment.startedAt ?? deployment.activatedAt ?? null,
      status: deployment.status ?? 'unknown',
    });
  }

  for (const request of requests) {
    const key =
      request.deploymentStamp ??
      request.deploymentColor ??
      request.source ??
      'unknown';
    const current = byStamp.get(key) ?? {
      color: request.deploymentColor,
      commitHash: null,
      commitShortHash: null,
      commitSubject: null,
      deploymentStamp: request.deploymentStamp,
      durationMs: null,
      errorCount: 0,
      lastRequestAt: null,
      runtimeState: null,
      requestCount: 0,
      startedAt: null,
      status: 'ready',
    };

    current.requestCount += 1;
    current.errorCount +=
      request.status != null && request.status >= 500 ? 1 : 0;
    current.lastRequestAt = Math.max(
      current.lastRequestAt ?? 0,
      request.startedAt
    );
    current.startedAt =
      current.startedAt == null
        ? request.startedAt
        : Math.min(current.startedAt, request.startedAt);
    byStamp.set(key, current);
  }

  return paginate([...byStamp.values()], {
    page: clampPage(filters.page),
    pageSize: clampPageSize(filters.pageSize),
  });
}

function parseFilterDefaults(filters: ObservabilityFilters) {
  return {
    ...filters,
    page: clampPage(filters.page),
    pageSize: clampPageSize(filters.pageSize),
    timeframeHours: clampTimeframeHours(filters.timeframeHours),
  };
}

function getTopRoutes(requests: ObservabilityRequest[]) {
  const byPath = new Map<
    string,
    { duration: number; errorCount: number; requestCount: number }
  >();

  for (const request of requests) {
    const path = request.path ?? 'unknown';
    const current = byPath.get(path) ?? {
      duration: 0,
      errorCount: 0,
      requestCount: 0,
    };
    current.requestCount += 1;
    current.duration += request.durationMs ?? 0;
    current.errorCount +=
      request.status != null && request.status >= 500 ? 1 : 0;
    byPath.set(path, current);
  }

  return [...byPath.entries()]
    .map(([path, value]) => ({
      averageDurationMs:
        value.requestCount > 0 ? value.duration / value.requestCount : null,
      errorCount: value.errorCount,
      path,
      requestCount: value.requestCount,
    }))
    .sort((left, right) => right.requestCount - left.requestCount)
    .slice(0, 10);
}

export async function readObservabilityOverview(
  filters: ObservabilityFilters = {}
): Promise<ObservabilityOverview> {
  const normalized = parseFilterDefaults(filters);
  const [requests, logs, cronRuns] = await Promise.all([
    loadRecentRequests(normalized),
    loadRecentLogs(normalized),
    readObservabilityCronRuns({
      ...normalized,
      page: 1,
      pageSize: MAX_PAGE_SIZE,
    }),
  ]);
  const serverErrorCount = requests.filter(
    (request) => request.status != null && request.status >= 500
  ).length;
  const durations = requests
    .map((request) => request.durationMs)
    .filter((duration): duration is number => duration != null)
    .sort((left, right) => left - right);
  const p95Index =
    durations.length > 0 ? Math.floor((durations.length - 1) * 0.95) : -1;
  const failedCronRuns = cronRuns.items.filter(
    (run) => run.status === 'failed'
  ).length;
  const sourceCounts = requests.reduce<Record<string, number>>(
    (counts, request) => {
      counts[request.source] = (counts[request.source] ?? 0) + 1;
      return counts;
    },
    {}
  );

  return {
    cronFailureRate:
      cronRuns.total > 0
        ? Math.round((failedCronRuns / cronRuns.total) * 100)
        : 0,
    errorRate:
      requests.length > 0
        ? Math.round((serverErrorCount / requests.length) * 100)
        : 0,
    lastEventAt: logs[0]?.createdAt ?? requests[0]?.startedAt ?? null,
    p95DurationMs: p95Index >= 0 ? (durations[p95Index] ?? null) : null,
    recentErrors: logs.filter((log) => log.level === 'error').slice(0, 5),
    requestCount: requests.length,
    serverErrorCount,
    slowRequestCount: requests.filter(
      (request) => (request.durationMs ?? 0) >= 1_000
    ).length,
    sourceCounts,
    topRoutes: getTopRoutes(requests),
  };
}

export async function readObservabilityAnalytics(
  filters: ObservabilityFilters = {}
): Promise<ObservabilityAnalytics> {
  const normalized = parseFilterDefaults(filters);
  const [requests, cronRuns] = await Promise.all([
    loadRecentRequests(normalized),
    readObservabilityCronRuns({
      ...normalized,
      page: 1,
      pageSize: MAX_PAGE_SIZE,
    }),
  ]);
  const bucketCount = Math.min(24, normalized.timeframeHours);
  const bucketMs = (normalized.timeframeHours * 60 * 60 * 1000) / bucketCount;
  const start = Date.now() - normalized.timeframeHours * 60 * 60 * 1000;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    bucketStart: start + index * bucketMs,
    cronRuns: 0,
    errors: 0,
    requests: 0,
    serverErrors: 0,
  }));
  const statusFamilies: ObservabilityAnalytics['statusFamilies'] = {
    clientError: 0,
    redirect: 0,
    serverError: 0,
    success: 0,
    unknown: 0,
  };

  for (const request of requests) {
    const bucketIndex = Math.min(
      buckets.length - 1,
      Math.max(0, Math.floor((request.startedAt - start) / bucketMs))
    );
    const bucket = buckets[bucketIndex];
    if (!bucket) {
      continue;
    }
    bucket.requests += 1;
    if (request.status == null) statusFamilies.unknown += 1;
    else if (request.status >= 500) {
      statusFamilies.serverError += 1;
      bucket.serverErrors += 1;
    } else if (request.status >= 400) statusFamilies.clientError += 1;
    else if (request.status >= 300) statusFamilies.redirect += 1;
    else statusFamilies.success += 1;
  }

  const cronByJob = new Map<
    string,
    { failureCount: number; runCount: number }
  >();
  for (const run of cronRuns.items) {
    const bucketIndex = Math.min(
      buckets.length - 1,
      Math.max(0, Math.floor((run.startedAt - start) / bucketMs))
    );
    const bucket = buckets[bucketIndex];
    if (!bucket) {
      continue;
    }
    bucket.cronRuns += 1;
    bucket.errors += run.status === 'failed' ? 1 : 0;
    const current = cronByJob.get(run.jobId) ?? {
      failureCount: 0,
      runCount: 0,
    };
    current.runCount += 1;
    current.failureCount += run.status === 'failed' ? 1 : 0;
    cronByJob.set(run.jobId, current);
  }

  return {
    buckets,
    statusFamilies,
    topCronJobs: [...cronByJob.entries()]
      .map(([jobId, value]) => ({ jobId, ...value }))
      .sort((left, right) => right.runCount - left.runCount)
      .slice(0, 10),
    topRoutes: getTopRoutes(requests),
  };
}
