begin;

select plan(16);

select has_table('public', 'tulearn_parent_student_links', 'parent student links table exists');
select has_table('public', 'tulearn_parent_invites', 'parent invites table exists');
select has_table('public', 'tulearn_gamification_events', 'gamification events table exists');
select has_table('public', 'tulearn_learner_state', 'learner state table exists');

select has_column('public', 'tulearn_parent_student_links', 'parent_user_id', 'links store the parent platform user');
select has_column('public', 'tulearn_parent_student_links', 'student_workspace_user_id', 'links store the student workspace user');
select has_column('public', 'tulearn_parent_invites', 'token_hash', 'invites store hashed tokens');
select has_column('public', 'tulearn_gamification_events', 'idempotency_key', 'events have idempotency keys');
select has_column('public', 'tulearn_learner_state', 'hearts', 'learner state stores hearts');
select has_column('public', 'tulearn_learner_state', 'xp_total', 'learner state stores total XP');

select indexes_are(
  'public',
  'tulearn_gamification_events',
  array[
    'tulearn_gamification_events_pkey',
    'tulearn_gamification_events_idempotency_key',
    'tulearn_gamification_events_user_created_idx'
  ]
);

select policies_are(
  'public',
  'tulearn_learner_state',
  array[
    'Learners can view own Tulearn state',
    'Learners can insert own Tulearn state',
    'Learners can update own Tulearn state'
  ]
);

select isnt_empty(
  $$
    select 1
    from pg_constraint
    where conname = 'tulearn_learner_state_hearts_lte_max_check'
  $$,
  'learner hearts cannot exceed max hearts'
);

select isnt_empty(
  $$
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'tulearn_parent_student_links'
      and indexname = 'tulearn_parent_student_links_active_key'
  $$,
  'active parent student links are unique'
);

select isnt_empty(
  $$
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'award_tulearn_xp'
  $$,
  'Tulearn XP awards use an atomic RPC'
);

select isnt_empty(
  $$
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'lose_tulearn_heart'
  $$,
  'Tulearn heart loss uses an atomic RPC'
);

select * from finish();

rollback;
