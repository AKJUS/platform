-- Avoid firing the personal-workspace single-member trigger for an already
-- linked creator. A BEFORE INSERT trigger runs before ON CONFLICT can skip the
-- duplicate row, so the existence check must happen before the insert.

create or replace function public.auto_create_personal_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  existing_ws_id uuid;
  new_ws_id uuid;
begin
  select id into existing_ws_id
  from public.workspaces
  where creator_id = new.id and personal = true
  limit 1;

  if existing_ws_id is not null then
    update public.workspaces
    set deleted = false
    where id = existing_ws_id and deleted = true;

    if not exists (
      select 1
      from public.workspace_members
      where ws_id = existing_ws_id
        and user_id = new.id
    ) then
      insert into public.workspace_members (ws_id, user_id)
      values (existing_ws_id, new.id);
    end if;

    return new;
  end if;

  insert into public.workspaces (name, personal, creator_id)
  values ('PERSONAL', true, new.id)
  returning id into new_ws_id;

  if not exists (
    select 1
    from public.workspace_members
    where ws_id = new_ws_id
      and user_id = new.id
  ) then
    insert into public.workspace_members (ws_id, user_id)
    values (new_ws_id, new.id);
  end if;

  return new;
end;
$func$;
