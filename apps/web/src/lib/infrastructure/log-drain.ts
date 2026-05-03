import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import { extractIPFromHeaders } from '@tuturuuu/utils/abuse-protection';
import { extractUserAgentFromHeaders } from '@tuturuuu/utils/abuse-protection/user-agent';
import postgres, { type Sql } from 'postgres';

export type LogDrainLevel = 'debug' | 'error' | 'info' | 'warn';
export type LogDrainSource = 'api' | 'cron' | 'server';

export interface LogDrainEvent {
  deploymentColor: string | null;
  deploymentStamp: string | null;
  durationMs: number | null;
  errorName: string | null;
  errorStack: string | null;
  ipAddress: string | null;
  level: LogDrainLevel;
  message: string;
  metadata: Record<string, unknown>;
  requestId: string | null;
  route: string | null;
  source: LogDrainSource;
  status: number | null;
  time: number;
  userAgent: string | null;
}

interface LogDrainContext {
  cronJobId: string | null;
  events: LogDrainEvent[];
  ipAddress: string | null;
  method: string | null;
  path: string | null;
  requestId: string;
  source: LogDrainSource;
  startedAt: number;
  userAgent: string | null;
}

interface RequestDrainOptions {
  request: Request;
  route?: string;
  source?: Extract<LogDrainSource, 'api' | 'server'>;
}

interface CronDrainOptions {
  jobId: string;
  path: string;
  request?: Request;
}

const LOG_DRAIN_ENABLED_KEY = 'PLATFORM_LOG_DRAIN_ENABLED';
const LOG_DRAIN_DATABASE_URL_KEY = 'PLATFORM_LOG_DRAIN_DATABASE_URL';
const LOG_DRAIN_RAW_RETENTION_DAYS_KEY =
  'PLATFORM_LOG_DRAIN_RAW_RETENTION_DAYS';
const LOG_DRAIN_SUMMARY_RETENTION_DAYS_KEY =
  'PLATFORM_LOG_DRAIN_SUMMARY_RETENTION_DAYS';
const DEFAULT_RAW_RETENTION_DAYS = 30;
const DEFAULT_SUMMARY_RETENTION_DAYS = 90;
const MAX_SERIALIZED_ARG_LENGTH = 4_000;
const MAX_LOG_EVENTS_PER_CONTEXT = 500;

const storage = new AsyncLocalStorage<LogDrainContext>();

let sqlClient: Sql | null = null;
let schemaReady: Promise<void> | null = null;
let consoleDrainInstalled = false;

const originalConsole = {
  debug: console.debug.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  log: console.log.bind(console),
  warn: console.warn.bind(console),
};

function isLogDrainEnabled() {
  const configured = process.env[LOG_DRAIN_ENABLED_KEY]?.trim().toLowerCase();
  if (configured === '0' || configured === 'false' || configured === 'off') {
    return false;
  }

  return Boolean(process.env[LOG_DRAIN_DATABASE_URL_KEY]?.trim());
}

export function getLogDrainSqlClient() {
  if (!isLogDrainEnabled()) {
    return null;
  }

  if (!sqlClient) {
    sqlClient = postgres(process.env[LOG_DRAIN_DATABASE_URL_KEY] as string, {
      connect_timeout: 2,
      idle_timeout: 10,
      max: 3,
      prepare: false,
    });
  }

  return sqlClient;
}

export async function ensureLogDrainSchema() {
  const sql = getLogDrainSqlClient();
  if (!sql) {
    return;
  }

  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS deployments (
        id BIGSERIAL PRIMARY KEY,
        deployment_stamp TEXT UNIQUE,
        color TEXT,
        commit_hash TEXT,
        commit_subject TEXT,
        environment TEXT DEFAULT 'production',
        status TEXT DEFAULT 'unknown',
        started_at TIMESTAMPTZ,
        activated_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        method TEXT,
        path TEXT,
        route TEXT,
        status INTEGER,
        duration_ms INTEGER,
        deployment_color TEXT,
        deployment_stamp TEXT,
        cron_job_id TEXT,
        error_message TEXT,
        error_name TEXT,
        error_stack TEXT,
        ip_address TEXT,
        user_agent TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS log_events (
        id BIGSERIAL PRIMARY KEY,
        request_id TEXT REFERENCES requests(id) ON DELETE SET NULL,
        source TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        route TEXT,
        status INTEGER,
        duration_ms INTEGER,
        deployment_color TEXT,
        deployment_stamp TEXT,
        error_name TEXT,
        error_stack TEXT,
        ip_address TEXT,
        user_agent TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS cron_runs (
        id TEXT PRIMARY KEY,
        request_id TEXT REFERENCES requests(id) ON DELETE SET NULL,
        job_id TEXT NOT NULL,
        path TEXT NOT NULL,
        status TEXT NOT NULL,
        http_status INTEGER,
        duration_ms INTEGER,
        error_message TEXT,
        response TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS usage_events (
        id BIGSERIAL PRIMARY KEY,
        request_id TEXT REFERENCES requests(id) ON DELETE SET NULL,
        source TEXT NOT NULL,
        metric TEXT NOT NULL,
        value DOUBLE PRECISION NOT NULL,
        unit TEXT,
        route TEXT,
        deployment_color TEXT,
        deployment_stamp TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`ALTER TABLE requests ADD COLUMN IF NOT EXISTS ip_address TEXT`;
    await sql`ALTER TABLE requests ADD COLUMN IF NOT EXISTS user_agent TEXT`;
    await sql`ALTER TABLE log_events ADD COLUMN IF NOT EXISTS ip_address TEXT`;
    await sql`ALTER TABLE log_events ADD COLUMN IF NOT EXISTS user_agent TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS log_events_created_at_idx ON log_events (created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS log_events_level_created_at_idx ON log_events (level, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS log_events_request_id_idx ON log_events (request_id)`;
    await sql`CREATE INDEX IF NOT EXISTS requests_started_at_idx ON requests (started_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS requests_status_started_at_idx ON requests (status, started_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS requests_path_started_at_idx ON requests (path, started_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS cron_runs_job_started_at_idx ON cron_runs (job_id, started_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS usage_events_metric_created_at_idx ON usage_events (metric, created_at DESC)`;
  })();

  await schemaReady;
}

function getRequestClientMetadata(request: Request | undefined) {
  if (!request) {
    return {
      ipAddress: null,
      userAgent: null,
    };
  }

  const ipAddress = extractIPFromHeaders(request.headers);
  return {
    ipAddress: ipAddress === 'unknown' ? null : ipAddress,
    userAgent: extractUserAgentFromHeaders(request.headers),
  };
}

function getDeploymentMetadata() {
  return {
    deploymentColor: process.env.PLATFORM_BLUE_GREEN_COLOR?.trim() || null,
    deploymentStamp: process.env.PLATFORM_DEPLOYMENT_STAMP?.trim() || null,
  };
}

function getRetentionDays(key: string, fallback: number) {
  const parsed = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function truncate(value: string, maxLength = MAX_SERIALIZED_ARG_LENGTH) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function redactString(value: string) {
  return value
    .replace(/(bearer\s+)[a-z0-9._~+/=-]+/giu, '$1[redacted]')
    .replace(/([?&](?:token|key|secret|password)=)[^&\s]+/giu, '$1[redacted]');
}

function serializeArg(arg: unknown): string {
  if (arg instanceof Error) {
    return truncate(redactString(arg.stack || arg.message));
  }

  if (typeof arg === 'string') {
    return truncate(redactString(arg));
  }

  try {
    return truncate(redactString(JSON.stringify(arg)));
  } catch {
    return truncate(String(arg));
  }
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack ?? null,
    };
  }

  return {
    message: serializeArg(error),
    name: null,
    stack: null,
  };
}

function createEvent(
  level: LogDrainLevel,
  args: unknown[],
  metadata: Record<string, unknown> = {}
): LogDrainEvent {
  const context = storage.getStore();
  const errorArg = args.find((arg) => arg instanceof Error);
  const error = errorArg ? normalizeError(errorArg) : null;
  const deployment = getDeploymentMetadata();

  return {
    deploymentColor: deployment.deploymentColor,
    deploymentStamp: deployment.deploymentStamp,
    durationMs: null,
    errorName: error?.name ?? null,
    errorStack: error?.stack ?? null,
    ipAddress: context?.ipAddress ?? null,
    level,
    message: args.map(serializeArg).join(' '),
    metadata,
    requestId: context?.requestId ?? null,
    route: context?.path ?? null,
    source: context?.source ?? 'server',
    status: null,
    time: Date.now(),
    userAgent: context?.userAgent ?? null,
  };
}

function captureEvent(event: LogDrainEvent) {
  const context = storage.getStore();
  if (context && context.events.length < MAX_LOG_EVENTS_PER_CONTEXT) {
    context.events.push(event);
    return;
  }

  void persistStandaloneEvent(event);
}

async function persistStandaloneEvent(event: LogDrainEvent) {
  try {
    await ensureLogDrainSchema();
    const sql = getLogDrainSqlClient();
    if (!sql) {
      return;
    }

    await sql`
      INSERT INTO log_events (
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
        ip_address,
        user_agent,
        metadata,
        created_at
      )
      VALUES (
        ${event.requestId},
        ${event.source},
        ${event.level},
        ${event.message},
        ${event.route},
        ${event.status},
        ${event.durationMs},
        ${event.deploymentColor},
        ${event.deploymentStamp},
        ${event.errorName},
        ${event.errorStack},
        ${event.ipAddress},
        ${event.userAgent},
        ${JSON.stringify(event.metadata)}::jsonb,
        ${new Date(event.time)}
      )
    `;
  } catch {
    // Logging must never break the caller.
  }
}

async function persistContext({
  context,
  error,
  response,
}: {
  context: LogDrainContext;
  error: unknown;
  response: Response | null;
}) {
  try {
    await ensureLogDrainSchema();
    const sql = getLogDrainSqlClient();
    if (!sql) {
      return;
    }

    const endedAt = Date.now();
    const normalizedError = error ? normalizeError(error) : null;
    const status =
      response?.status ??
      (normalizedError ? 500 : context.source === 'cron' ? 200 : null);
    const durationMs = Math.max(0, endedAt - context.startedAt);
    const deployment = getDeploymentMetadata();
    const requestMetadata = {};

    await sql.begin(async (transaction) => {
      await transaction`
        INSERT INTO requests (
          id,
          source,
          method,
          path,
          route,
          status,
          duration_ms,
          deployment_color,
          deployment_stamp,
          cron_job_id,
          error_message,
          error_name,
          error_stack,
          ip_address,
          user_agent,
          metadata,
          started_at,
          ended_at
        )
        VALUES (
          ${context.requestId},
          ${context.source},
          ${context.method},
          ${context.path},
          ${context.path},
          ${status},
          ${durationMs},
          ${deployment.deploymentColor},
          ${deployment.deploymentStamp},
          ${context.cronJobId},
          ${normalizedError?.message ?? null},
          ${normalizedError?.name ?? null},
          ${normalizedError?.stack ?? null},
          ${context.ipAddress},
          ${context.userAgent},
          ${JSON.stringify(requestMetadata)}::jsonb,
          ${new Date(context.startedAt)},
          ${new Date(endedAt)}
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          duration_ms = EXCLUDED.duration_ms,
          error_message = EXCLUDED.error_message,
          error_name = EXCLUDED.error_name,
          error_stack = EXCLUDED.error_stack,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent,
          ended_at = EXCLUDED.ended_at
      `;

      if (context.source === 'cron' && context.cronJobId && context.path) {
        await transaction`
          INSERT INTO cron_runs (
            id,
            request_id,
            job_id,
            path,
            status,
            http_status,
            duration_ms,
            error_message,
            response,
            metadata,
            started_at,
            ended_at
          )
          VALUES (
            ${context.requestId},
            ${context.requestId},
            ${context.cronJobId},
            ${context.path},
            ${normalizedError || (status && status >= 500) ? 'failed' : 'success'},
            ${status},
            ${durationMs},
            ${normalizedError?.message ?? null},
            ${null},
            ${JSON.stringify({})}::jsonb,
            ${new Date(context.startedAt)},
            ${new Date(endedAt)}
          )
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            http_status = EXCLUDED.http_status,
            duration_ms = EXCLUDED.duration_ms,
            error_message = EXCLUDED.error_message,
            ended_at = EXCLUDED.ended_at
        `;
      }

      for (const event of context.events) {
        await transaction`
          INSERT INTO log_events (
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
            ip_address,
            user_agent,
            metadata,
            created_at
          )
          VALUES (
            ${context.requestId},
            ${event.source},
            ${event.level},
            ${event.message},
            ${event.route},
            ${status},
            ${durationMs},
            ${event.deploymentColor},
            ${event.deploymentStamp},
            ${event.errorName},
            ${event.errorStack},
            ${event.ipAddress},
            ${event.userAgent},
            ${JSON.stringify(event.metadata)}::jsonb,
            ${new Date(event.time)}
          )
        `;
      }
    });

    await pruneOldLogDrainRecords();
  } catch {
    // Logging must never break the caller.
  }
}

export async function pruneOldLogDrainRecords() {
  const sql = getLogDrainSqlClient();
  if (!sql) {
    return;
  }

  const rawRetentionDays = getRetentionDays(
    LOG_DRAIN_RAW_RETENTION_DAYS_KEY,
    DEFAULT_RAW_RETENTION_DAYS
  );
  const summaryRetentionDays = getRetentionDays(
    LOG_DRAIN_SUMMARY_RETENTION_DAYS_KEY,
    DEFAULT_SUMMARY_RETENTION_DAYS
  );

  await sql`DELETE FROM log_events WHERE created_at < now() - make_interval(days => ${rawRetentionDays})`;
  await sql`DELETE FROM usage_events WHERE created_at < now() - make_interval(days => ${summaryRetentionDays})`;
  await sql`DELETE FROM cron_runs WHERE created_at < now() - make_interval(days => ${summaryRetentionDays})`;
  await sql`DELETE FROM requests WHERE created_at < now() - make_interval(days => ${summaryRetentionDays})`;
}

function createRequestId(prefix: string) {
  return `${prefix}-${Date.now()}-${crypto.randomUUID()}`;
}

async function runWithLogDrain<T>(
  context: LogDrainContext,
  handler: () => Promise<T>
) {
  let response: Response | null = null;
  let error: unknown = null;

  try {
    return await storage.run(context, async () => {
      try {
        const result = await handler();
        if (result instanceof Response) {
          response = result;
        }
        return result;
      } catch (caught) {
        error = caught;
        captureEvent(createEvent('error', ['Unhandled server error', caught]));
        throw caught;
      }
    });
  } finally {
    void persistContext({ context, error, response });
  }
}

export async function withRequestLogDrain<T extends Response>(
  options: RequestDrainOptions,
  handler: () => Promise<T>
) {
  const url = new URL(options.request.url);
  const clientMetadata = getRequestClientMetadata(options.request);
  const context: LogDrainContext = {
    cronJobId: null,
    events: [],
    ipAddress: clientMetadata.ipAddress,
    method: options.request.method,
    path: options.route ?? url.pathname,
    requestId:
      options.request.headers.get('x-request-id') ?? createRequestId('req'),
    source: options.source ?? 'api',
    startedAt: Date.now(),
    userAgent: clientMetadata.userAgent,
  };

  return runWithLogDrain(context, handler);
}

export async function withCronLogDrain<T extends Response>(
  options: CronDrainOptions,
  handler: () => Promise<T>
) {
  const clientMetadata = getRequestClientMetadata(options.request);
  const context: LogDrainContext = {
    cronJobId: options.jobId,
    events: [],
    ipAddress: clientMetadata.ipAddress,
    method: options.request?.method ?? 'GET',
    path: options.path,
    requestId:
      options.request?.headers.get('x-request-id') ?? createRequestId('cron'),
    source: 'cron',
    startedAt: Date.now(),
    userAgent: clientMetadata.userAgent,
  };

  return runWithLogDrain(context, handler);
}

function writeServerLog(level: LogDrainLevel, args: unknown[]) {
  captureEvent(createEvent(level, args, { logger: 'serverLogger' }));
}

export const serverLogger = {
  debug: (...args: unknown[]) => {
    originalConsole.debug(...args);
    writeServerLog('debug', args);
  },
  error: (...args: unknown[]) => {
    originalConsole.error(...args);
    writeServerLog('error', args);
  },
  info: (...args: unknown[]) => {
    originalConsole.info(...args);
    writeServerLog('info', args);
  },
  warn: (...args: unknown[]) => {
    originalConsole.warn(...args);
    writeServerLog('warn', args);
  },
};

export function installConsoleLogDrain() {
  if (consoleDrainInstalled) {
    return;
  }

  consoleDrainInstalled = true;

  console.debug = (...args: unknown[]) => {
    originalConsole.debug(...args);
    captureEvent(createEvent('debug', args, { logger: 'console' }));
  };
  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    captureEvent(createEvent('error', args, { logger: 'console' }));
  };
  console.info = (...args: unknown[]) => {
    originalConsole.info(...args);
    captureEvent(createEvent('info', args, { logger: 'console' }));
  };
  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    captureEvent(createEvent('info', args, { logger: 'console' }));
  };
  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    captureEvent(createEvent('warn', args, { logger: 'console' }));
  };
}

export async function drainLogEventForTest(event: LogDrainEvent) {
  await persistStandaloneEvent(event);
}
