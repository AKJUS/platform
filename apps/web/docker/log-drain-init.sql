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
);

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
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

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
);

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
);

CREATE INDEX IF NOT EXISTS log_events_created_at_idx ON log_events (created_at DESC);
CREATE INDEX IF NOT EXISTS log_events_level_created_at_idx ON log_events (level, created_at DESC);
CREATE INDEX IF NOT EXISTS log_events_request_id_idx ON log_events (request_id);
CREATE INDEX IF NOT EXISTS requests_started_at_idx ON requests (started_at DESC);
CREATE INDEX IF NOT EXISTS requests_status_started_at_idx ON requests (status, started_at DESC);
CREATE INDEX IF NOT EXISTS requests_path_started_at_idx ON requests (path, started_at DESC);
CREATE INDEX IF NOT EXISTS cron_runs_job_started_at_idx ON cron_runs (job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_metric_created_at_idx ON usage_events (metric, created_at DESC);

