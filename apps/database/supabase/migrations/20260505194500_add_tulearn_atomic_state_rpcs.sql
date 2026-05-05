create or replace function public.award_tulearn_xp(
  p_ws_id uuid,
  p_user_id uuid,
  p_source_type text,
  p_source_id text,
  p_xp integer,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  awarded boolean,
  xp integer,
  xp_total integer,
  current_streak integer,
  longest_streak integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.tulearn_learner_state%rowtype;
  v_today date := (now() at time zone 'utc')::date;
  v_yesterday date := ((now() at time zone 'utc')::date - 1);
  v_next_streak integer;
begin
  if p_xp <= 0 then
    raise exception 'XP must be positive';
  end if;

  begin
    insert into public.tulearn_gamification_events (
      ws_id,
      user_id,
      source_type,
      source_id,
      xp,
      idempotency_key,
      metadata
    )
    values (
      p_ws_id,
      p_user_id,
      p_source_type,
      p_source_id,
      p_xp,
      p_idempotency_key,
      coalesce(p_metadata, '{}'::jsonb)
    );
  exception
    when unique_violation then
      select *
      into v_state
      from public.tulearn_learner_state
      where ws_id = p_ws_id
        and user_id = p_user_id;

      return query select
        false,
        0,
        coalesce(v_state.xp_total, 0),
        coalesce(v_state.current_streak, 0),
        coalesce(v_state.longest_streak, 0);
      return;
  end;

  insert into public.tulearn_learner_state (ws_id, user_id)
  values (p_ws_id, p_user_id)
  on conflict (ws_id, user_id) do nothing;

  select *
  into v_state
  from public.tulearn_learner_state
  where ws_id = p_ws_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Unable to initialize Tulearn learner state';
  end if;

  v_next_streak := case
    when v_state.last_activity_date = v_today then v_state.current_streak
    when v_state.last_activity_date = v_yesterday then v_state.current_streak + 1
    else 1
  end;

  update public.tulearn_learner_state
  set
    xp_total = v_state.xp_total + p_xp,
    current_streak = v_next_streak,
    longest_streak = greatest(v_state.longest_streak, v_next_streak),
    last_activity_date = v_today,
    updated_at = now()
  where ws_id = p_ws_id
    and user_id = p_user_id
  returning *
  into v_state;

  return query select
    true,
    p_xp,
    v_state.xp_total,
    v_state.current_streak,
    v_state.longest_streak;
end;
$$;

create or replace function public.lose_tulearn_heart(
  p_ws_id uuid,
  p_user_id uuid
)
returns table (hearts integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.tulearn_learner_state%rowtype;
  v_next_hearts integer;
begin
  insert into public.tulearn_learner_state (ws_id, user_id)
  values (p_ws_id, p_user_id)
  on conflict (ws_id, user_id) do nothing;

  select *
  into v_state
  from public.tulearn_learner_state
  where ws_id = p_ws_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception 'Unable to initialize Tulearn learner state';
  end if;

  v_next_hearts := greatest(0, v_state.hearts - 1);

  update public.tulearn_learner_state
  set
    hearts = v_next_hearts,
    last_heart_refill_at = case
      when v_next_hearts < v_state.max_hearts then now()
      else v_state.last_heart_refill_at
    end,
    updated_at = now()
  where ws_id = p_ws_id
    and user_id = p_user_id
  returning *
  into v_state;

  return query select v_state.hearts;
end;
$$;

revoke all on function public.award_tulearn_xp(
  uuid,
  uuid,
  text,
  text,
  integer,
  text,
  jsonb
) from public;
revoke all on function public.lose_tulearn_heart(uuid, uuid) from public;

grant execute on function public.award_tulearn_xp(
  uuid,
  uuid,
  text,
  text,
  integer,
  text,
  jsonb
) to service_role;
grant execute on function public.lose_tulearn_heart(uuid, uuid) to service_role;
