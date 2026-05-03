import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  CronExecutionRecord,
  CronMonitoringControl,
  CronMonitoringJob,
  CronMonitoringSnapshot,
} from '@tuturuuu/internal-api/infrastructure';

const DEFAULT_CRON_STATUS_STALE_MS = 120_000;

function readJsonFile<T>(filePath: string, fallback: T, fsImpl = fs): T {
  if (!fsImpl.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fsImpl.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath: string, value: unknown, fsImpl = fs) {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
  fsImpl.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function resolveDockerWebRuntimeDir() {
  return (
    process.env.PLATFORM_BLUE_GREEN_MONITORING_DIR ||
    path.join(process.cwd(), 'tmp', 'docker-web')
  );
}

function resolveDockerWebControlDir() {
  return (
    process.env.PLATFORM_BLUE_GREEN_CONTROL_DIR ||
    path.join(process.cwd(), 'tmp', 'docker-web', 'watch', 'control')
  );
}

function resolveCronConfigPath() {
  if (process.env.PLATFORM_WEB_CRON_CONFIG_PATH) {
    return process.env.PLATFORM_WEB_CRON_CONFIG_PATH;
  }

  const candidates = [
    path.join(process.cwd(), 'apps', 'web', 'cron.config.json'),
    path.join(process.cwd(), 'cron.config.json'),
  ];

  return (
    candidates.find((candidate) => fs.existsSync(candidate)) ??
    path.join(process.cwd(), 'apps', 'web', 'cron.config.json')
  );
}

export function getCronMonitoringPaths() {
  const runtimeRoot = resolveDockerWebRuntimeDir();
  const runtimeDir =
    process.env.PLATFORM_CRON_MONITORING_DIR || path.join(runtimeRoot, 'cron');
  const controlDir =
    process.env.PLATFORM_CRON_CONTROL_DIR || resolveDockerWebControlDir();

  return {
    configFile: resolveCronConfigPath(),
    controlDir,
    controlFile: path.join(controlDir, 'cron-control.json'),
    executionDir: path.join(runtimeDir, 'executions'),
    runRequestsDir: path.join(controlDir, 'cron-run-requests'),
    runtimeDir,
    statusFile: path.join(runtimeDir, 'status.json'),
  };
}

function readCronConfig(paths = getCronMonitoringPaths(), fsImpl = fs) {
  const parsed = readJsonFile<{ jobs?: CronMonitoringJob[] }>(
    paths.configFile,
    { jobs: [] },
    fsImpl
  );

  return {
    jobs: Array.isArray(parsed.jobs)
      ? parsed.jobs.map((job) => ({
          description: String(job.description ?? ''),
          enabled: job.enabled !== false,
          failureStreak: 0,
          id: String(job.id),
          lastExecution: null,
          lastScheduledAt: null,
          nextRunAt: null,
          path: String(job.path),
          schedule: String(job.schedule),
        }))
      : [],
  };
}

function readExecutionRecords(
  paths = getCronMonitoringPaths(),
  fsImpl = fs
): CronExecutionRecord[] {
  if (!fsImpl.existsSync(paths.executionDir)) {
    return [];
  }

  return fsImpl
    .readdirSync(paths.executionDir)
    .filter((fileName) => fileName.endsWith('.jsonl'))
    .sort()
    .flatMap((fileName) =>
      fsImpl
        .readFileSync(path.join(paths.executionDir, fileName), 'utf8')
        .split(/\r?\n/u)
        .filter(Boolean)
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as CronExecutionRecord];
          } catch {
            return [];
          }
        })
    )
    .sort((left, right) => right.startedAt - left.startedAt);
}

function getDefaultControl(): CronMonitoringControl {
  return {
    enabled: true,
    updatedAt: null,
    updatedBy: null,
    updatedByEmail: null,
  };
}

function readControl(
  paths = getCronMonitoringPaths(),
  fsImpl = fs
): CronMonitoringControl {
  return {
    ...getDefaultControl(),
    ...readJsonFile<Partial<CronMonitoringControl>>(
      paths.controlFile,
      {},
      fsImpl
    ),
  };
}

function countQueuedRuns(paths = getCronMonitoringPaths(), fsImpl = fs) {
  if (!fsImpl.existsSync(paths.runRequestsDir)) {
    return 0;
  }

  return fsImpl
    .readdirSync(paths.runRequestsDir)
    .filter((fileName) => fileName.endsWith('.json')).length;
}

function normalizeStatusHealth(updatedAt: number | null, now: number) {
  if (updatedAt == null) {
    return 'missing' as const;
  }

  return now - updatedAt > DEFAULT_CRON_STATUS_STALE_MS
    ? ('stale' as const)
    : ('live' as const);
}

export function readCronMonitoringSnapshot({
  fsImpl = fs,
  now = Date.now(),
  paths = getCronMonitoringPaths(),
}: {
  fsImpl?: typeof fs;
  now?: number;
  paths?: ReturnType<typeof getCronMonitoringPaths>;
} = {}): CronMonitoringSnapshot {
  const config = readCronConfig(paths, fsImpl);
  const persistedStatus = readJsonFile<Partial<CronMonitoringSnapshot>>(
    paths.statusFile,
    {},
    fsImpl
  );
  const executions = readExecutionRecords(paths, fsImpl);
  const control = readControl(paths, fsImpl);
  const persistedJobs = Array.isArray(persistedStatus.jobs)
    ? persistedStatus.jobs
    : [];
  const jobs = config.jobs.map((job) => ({
    ...job,
    ...(persistedJobs.find((candidate) => candidate.id === job.id) ?? {}),
  }));
  const lastExecution = executions[0] ?? persistedStatus.lastExecution ?? null;
  const failedExecutions = executions.filter(
    (execution) => execution.status !== 'success'
  );
  const failedJobs = jobs.filter((job) => (job.failureStreak ?? 0) > 0).length;
  const nextRunAt =
    jobs
      .map((job) => job.nextRunAt)
      .filter((value): value is number => typeof value === 'number')
      .sort((left, right) => left - right)[0] ?? null;
  const updatedAt =
    typeof persistedStatus.updatedAt === 'number'
      ? persistedStatus.updatedAt
      : null;

  return {
    control,
    enabled: control.enabled,
    jobs,
    lastExecution,
    nextRunAt,
    overview: {
      enabledJobs: jobs.filter((job) => job.enabled).length,
      failedExecutions: failedExecutions.length,
      failedJobs,
      queuedRuns: countQueuedRuns(paths, fsImpl),
      retainedExecutions: executions.length,
      totalJobs: jobs.length,
    },
    retainedExecutionCount: executions.length,
    source: {
      configAvailable: fsImpl.existsSync(paths.configFile),
      controlAvailable: fsImpl.existsSync(paths.controlFile),
      runtimeDirAvailable: fsImpl.existsSync(paths.runtimeDir),
      statusAvailable: fsImpl.existsSync(paths.statusFile),
    },
    status: normalizeStatusHealth(updatedAt, now),
    updatedAt,
  };
}

export function readCronExecutionArchive({
  fsImpl = fs,
  page = 1,
  pageSize = 25,
  paths = getCronMonitoringPaths(),
}: {
  fsImpl?: typeof fs;
  page?: number;
  pageSize?: number;
  paths?: ReturnType<typeof getCronMonitoringPaths>;
} = {}) {
  const boundedPage = Number.isInteger(page) && page > 0 ? page : 1;
  const boundedPageSize =
    Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 25;
  const executions = readExecutionRecords(paths, fsImpl);
  const offset = (boundedPage - 1) * boundedPageSize;
  const items = executions.slice(offset, offset + boundedPageSize);
  const pageCount = Math.max(1, Math.ceil(executions.length / boundedPageSize));

  return {
    hasNextPage: boundedPage < pageCount,
    hasPreviousPage: boundedPage > 1,
    items,
    limit: boundedPageSize,
    offset,
    page: boundedPage,
    pageCount,
    total: executions.length,
    window: {
      newestAt: executions[0]?.startedAt ?? null,
      oldestAt: executions.at(-1)?.startedAt ?? null,
    },
  };
}

export function updateCronMonitoringControl({
  enabled,
  fsImpl = fs,
  paths = getCronMonitoringPaths(),
  updatedBy,
  updatedByEmail,
}: {
  enabled: boolean;
  fsImpl?: typeof fs;
  paths?: ReturnType<typeof getCronMonitoringPaths>;
  updatedBy: string;
  updatedByEmail: string | null;
}) {
  const control: CronMonitoringControl = {
    enabled,
    updatedAt: Date.now(),
    updatedBy,
    updatedByEmail,
  };

  writeJsonFile(paths.controlFile, control, fsImpl);
  return control;
}

export function queueCronRunRequest({
  fsImpl = fs,
  jobId,
  paths = getCronMonitoringPaths(),
  requestedBy,
  requestedByEmail,
}: {
  fsImpl?: typeof fs;
  jobId: string;
  paths?: ReturnType<typeof getCronMonitoringPaths>;
  requestedBy: string;
  requestedByEmail: string | null;
}) {
  const request = {
    id: crypto.randomUUID(),
    jobId,
    requestedAt: Date.now(),
    requestedBy,
    requestedByEmail,
  };

  writeJsonFile(
    path.join(
      paths.runRequestsDir,
      `${request.requestedAt}-${request.id}.json`
    ),
    request,
    fsImpl
  );

  return request;
}
