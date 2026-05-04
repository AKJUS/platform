CREATE TABLE IF NOT EXISTS infrastructure_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  github_owner TEXT NOT NULL,
  github_repo TEXT NOT NULL,
  selected_branch TEXT NOT NULL DEFAULT 'production',
  app_root TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT 'production',
  preset TEXT NOT NULL DEFAULT 'nextjs',
  port INTEGER NOT NULL DEFAULT 3000,
  hostnames TEXT[] NOT NULL DEFAULT '{}'::text[],
  auto_deploy_enabled BOOLEAN NOT NULL DEFAULT true,
  nginx_enabled BOOLEAN NOT NULL DEFAULT true,
  log_drain_enabled BOOLEAN NOT NULL DEFAULT true,
  redis_enabled BOOLEAN NOT NULL DEFAULT true,
  cron_enabled BOOLEAN NOT NULL DEFAULT false,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  latest_commit_hash TEXT,
  latest_commit_short_hash TEXT,
  latest_commit_subject TEXT,
  latest_synced_at TIMESTAMPTZ,
  deployment_status TEXT NOT NULL DEFAULT 'synced',
  last_deployed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS infrastructure_project_branches (
  project_id TEXT NOT NULL REFERENCES infrastructure_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  commit_hash TEXT,
  commit_short_hash TEXT,
  commit_subject TEXT,
  committed_at TIMESTAMPTZ,
  protected BOOLEAN NOT NULL DEFAULT false,
  default_branch BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, name)
);

INSERT INTO infrastructure_projects (
  id,
  name,
  repo_url,
  github_owner,
  github_repo,
  selected_branch,
  app_root,
  environment,
  preset,
  port,
  hostnames,
  auto_deploy_enabled,
  nginx_enabled,
  log_drain_enabled,
  redis_enabled,
  cron_enabled,
  is_builtin
)
VALUES (
  'platform',
  'Tuturuuu Platform',
  'https://github.com/tutur3u/platform',
  'tutur3u',
  'platform',
  'production',
  'apps/web',
  'production',
  'nextjs',
  7803,
  ARRAY[]::text[],
  true,
  true,
  true,
  true,
  true,
  true
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS deployments (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL DEFAULT 'platform',
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
  project_id TEXT NOT NULL DEFAULT 'platform',
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
);

CREATE TABLE IF NOT EXISTS log_events (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL DEFAULT 'platform',
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
);

CREATE TABLE IF NOT EXISTS cron_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL DEFAULT 'platform',
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
  project_id TEXT NOT NULL DEFAULT 'platform',
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

CREATE INDEX IF NOT EXISTS infrastructure_projects_repo_idx ON infrastructure_projects (github_owner, github_repo);
CREATE INDEX IF NOT EXISTS infrastructure_project_branches_project_idx ON infrastructure_project_branches (project_id, name);
CREATE INDEX IF NOT EXISTS log_events_created_at_idx ON log_events (created_at DESC);
CREATE INDEX IF NOT EXISTS log_events_project_created_at_idx ON log_events (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS log_events_level_created_at_idx ON log_events (level, created_at DESC);
CREATE INDEX IF NOT EXISTS log_events_request_id_idx ON log_events (request_id);
CREATE INDEX IF NOT EXISTS requests_started_at_idx ON requests (started_at DESC);
CREATE INDEX IF NOT EXISTS requests_project_started_at_idx ON requests (project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS requests_status_started_at_idx ON requests (status, started_at DESC);
CREATE INDEX IF NOT EXISTS requests_path_started_at_idx ON requests (path, started_at DESC);
CREATE INDEX IF NOT EXISTS cron_runs_job_started_at_idx ON cron_runs (job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS cron_runs_project_started_at_idx ON cron_runs (project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_metric_created_at_idx ON usage_events (metric, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_project_metric_created_at_idx ON usage_events (project_id, metric, created_at DESC);
