-- Tulearn learner app data model.
-- Protected education content stays in existing workspace/user-group tables;
-- these tables only store Tulearn-specific access links and gamification state.

create table if not exists public.tulearn_parent_student_links (
  id uuid primary key default gen_random_uuid(),
  ws_id uuid not null references public.workspaces(id) on update cascade on delete cascade,
  parent_user_id uuid not null references public.users(id) on update cascade on delete cascade,
  student_platform_user_id uuid not null references public.users(id) on update cascade on delete cascade,
  student_workspace_user_id uuid not null references public.workspace_users(id) on update cascade on delete cascade,
  status text not null default 'active' check (status in ('pending', 'active', 'revoked')),
  created_by uuid references public.users(id) on update cascade on delete set null,
  created_at timestamp with time zone not null default now(),
  accepted_at timestamp with time zone,
  revoked_at timestamp with time zone,
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists tulearn_parent_student_links_active_key
  on public.tulearn_parent_student_links (ws_id, parent_user_id, student_workspace_user_id)
  where status = 'active';

create index if not exists tulearn_parent_student_links_parent_idx
  on public.tulearn_parent_student_links (parent_user_id, status);

create index if not exists tulearn_parent_student_links_student_idx
  on public.tulearn_parent_student_links (student_platform_user_id, status);

create table if not exists public.tulearn_parent_invites (
  id uuid primary key default gen_random_uuid(),
  ws_id uuid not null references public.workspaces(id) on update cascade on delete cascade,
  student_workspace_user_id uuid not null references public.workspace_users(id) on update cascade on delete cascade,
  parent_email text not null,
  token_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references public.users(id) on update cascade on delete set null,
  parent_user_id uuid references public.users(id) on update cascade on delete set null,
  expires_at timestamp with time zone not null,
  accepted_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists tulearn_parent_invites_token_hash_key
  on public.tulearn_parent_invites (token_hash);

create index if not exists tulearn_parent_invites_email_idx
  on public.tulearn_parent_invites (lower(parent_email), status);

create table if not exists public.tulearn_gamification_events (
  id uuid primary key default gen_random_uuid(),
  ws_id uuid not null references public.workspaces(id) on update cascade on delete cascade,
  user_id uuid not null references public.users(id) on update cascade on delete cascade,
  source_type text not null check (
    source_type in ('module', 'quiz', 'quiz_set', 'flashcard', 'assignment', 'daily_goal', 'manual')
  ),
  source_id text,
  xp integer not null check (xp > 0),
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

create unique index if not exists tulearn_gamification_events_idempotency_key
  on public.tulearn_gamification_events (ws_id, user_id, idempotency_key);

create index if not exists tulearn_gamification_events_user_created_idx
  on public.tulearn_gamification_events (ws_id, user_id, created_at desc);

create table if not exists public.tulearn_learner_state (
  ws_id uuid not null references public.workspaces(id) on update cascade on delete cascade,
  user_id uuid not null references public.users(id) on update cascade on delete cascade,
  hearts integer not null default 5 check (hearts >= 0),
  max_hearts integer not null default 5 check (max_hearts > 0),
  xp_total integer not null default 0 check (xp_total >= 0),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  streak_freezes integer not null default 0 check (streak_freezes >= 0),
  last_activity_date date,
  last_heart_refill_at timestamp with time zone not null default now(),
  selected_workspace_id uuid references public.workspaces(id) on update cascade on delete set null,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (ws_id, user_id),
  constraint tulearn_learner_state_hearts_lte_max_check check (hearts <= max_hearts)
);

alter table public.tulearn_parent_student_links enable row level security;
alter table public.tulearn_parent_invites enable row level security;
alter table public.tulearn_gamification_events enable row level security;
alter table public.tulearn_learner_state enable row level security;

create policy "Parents and linked students can view Tulearn links"
on public.tulearn_parent_student_links
for select
to authenticated
using (
  auth.uid() = parent_user_id
  or auth.uid() = student_platform_user_id
  or exists (
    select 1
    from public.workspace_members wm
    where wm.ws_id = tulearn_parent_student_links.ws_id
      and wm.user_id = auth.uid()
  )
);

create policy "Users can view own Tulearn invites"
on public.tulearn_parent_invites
for select
to authenticated
using (
  auth.uid() = parent_user_id
  or auth.uid() = invited_by
  or exists (
    select 1
    from public.workspace_members wm
    where wm.ws_id = tulearn_parent_invites.ws_id
      and wm.user_id = auth.uid()
  )
);

create policy "Learners can view own Tulearn events"
on public.tulearn_gamification_events
for select
to authenticated
using (auth.uid() = user_id);

create policy "Learners can view own Tulearn state"
on public.tulearn_learner_state
for select
to authenticated
using (auth.uid() = user_id);

create policy "Learners can insert own Tulearn state"
on public.tulearn_learner_state
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Learners can update own Tulearn state"
on public.tulearn_learner_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select on public.tulearn_parent_student_links to authenticated;
grant select on public.tulearn_parent_invites to authenticated;
grant select on public.tulearn_gamification_events to authenticated;
grant select, insert, update on public.tulearn_learner_state to authenticated;

grant all on public.tulearn_parent_student_links to service_role;
grant all on public.tulearn_parent_invites to service_role;
grant all on public.tulearn_gamification_events to service_role;
grant all on public.tulearn_learner_state to service_role;
