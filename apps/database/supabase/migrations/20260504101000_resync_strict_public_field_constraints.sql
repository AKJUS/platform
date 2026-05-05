-- Re-sync strict text and JSON payload enforcement for tables added after the
-- original hardening pass. Constraints are NOT VALID to avoid blocking deploys
-- on existing historical rows while the trigger guards future writes.

do $$
declare
  r record;
  existing_constraint record;
  v_effective_char_limit integer;
begin
  for r in
    select distinct
      cols.table_name
    from information_schema.columns cols
    join information_schema.tables t
      on t.table_schema = cols.table_schema
      and t.table_name = cols.table_name
    where cols.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and cols.table_name <> 'ai_gateway_models'
      and cols.data_type in ('text', 'character varying', 'character')
  loop
    execute format(
      'drop trigger if exists enforce_strict_text_field_limits on public.%I',
      r.table_name
    );

    execute format(
      'create trigger enforce_strict_text_field_limits before insert or update on public.%I for each row execute function public.enforce_strict_text_field_limits()',
      r.table_name
    );
  end loop;

  for r in
    select
      cols.table_name,
      cols.column_name,
      cols.character_maximum_length
    from information_schema.columns cols
    join information_schema.tables t
      on t.table_schema = cols.table_schema
      and t.table_name = cols.table_name
    where cols.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and cols.table_name <> 'ai_gateway_models'
      and cols.data_type in ('text', 'character varying', 'character')
  loop
    for existing_constraint in
      select con.conname
      from pg_constraint con
      join pg_class cls
        on cls.oid = con.conrelid
      join pg_namespace ns
        on ns.oid = cls.relnamespace
      where ns.nspname = 'public'
        and cls.relname = r.table_name
        and con.contype = 'c'
        and (
          con.conname = any (array[
            format('%s_length_check', r.column_name),
            format('%s_%s_length_check', r.table_name, r.column_name),
            format('%s_strict_length_check', r.column_name),
            format('%s_%s_strict_length_check', r.table_name, r.column_name),
            format('%s_bytes_check', r.column_name),
            format('%s_%s_bytes_check', r.table_name, r.column_name),
            format('%s_strict_bytes_check', r.column_name),
            format('%s_%s_strict_bytes_check', r.table_name, r.column_name)
          ])
          or position(
            format('char_length(%I)', r.column_name)
            in pg_get_constraintdef(con.oid)
          ) > 0
          or position(
            format('octet_length(%I)', r.column_name)
            in pg_get_constraintdef(con.oid)
          ) > 0
        )
    loop
      execute format(
        'alter table public.%I drop constraint if exists %I',
        r.table_name,
        existing_constraint.conname
      );
    end loop;

    v_effective_char_limit := coalesce(
      least(
        public.strict_text_field_char_limit(r.table_name, r.column_name),
        r.character_maximum_length
      ),
      public.strict_text_field_char_limit(r.table_name, r.column_name)
    );

    execute format(
      'alter table public.%I add constraint %I check (char_length(%I) <= %s) not valid',
      r.table_name,
      format('%s_strict_length_check', r.column_name),
      r.column_name,
      v_effective_char_limit
    );

    execute format(
      'alter table public.%I add constraint %I check (octet_length(%I) <= %s) not valid',
      r.table_name,
      format('%s_strict_bytes_check', r.column_name),
      r.column_name,
      public.strict_text_field_byte_limit(r.table_name, r.column_name)
    );
  end loop;

  for r in
    select
      cols.table_name,
      cols.column_name
    from information_schema.columns cols
    join information_schema.tables t
      on t.table_schema = cols.table_schema
      and t.table_name = cols.table_name
    where cols.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and cols.data_type in ('json', 'jsonb')
  loop
    for existing_constraint in
      select con.conname
      from pg_constraint con
      join pg_class cls
        on cls.oid = con.conrelid
      join pg_namespace ns
        on ns.oid = cls.relnamespace
      where ns.nspname = 'public'
        and cls.relname = r.table_name
        and con.contype = 'c'
        and (
          con.conname = any (array[
            format('%s_payload_size_check', r.column_name),
            format('%s_%s_payload_size_check', r.table_name, r.column_name),
            format('%s_strict_payload_size_check', r.column_name),
            format('%s_%s_strict_payload_size_check', r.table_name, r.column_name)
          ])
          or position(
            format('octet_length((%I)::text)', r.column_name)
            in pg_get_constraintdef(con.oid)
          ) > 0
          or position(
            format('octet_length(%I::text)', r.column_name)
            in pg_get_constraintdef(con.oid)
          ) > 0
        )
    loop
      execute format(
        'alter table public.%I drop constraint if exists %I',
        r.table_name,
        existing_constraint.conname
      );
    end loop;

    execute format(
      'alter table public.%I add constraint %I check (octet_length((%I)::text) <= %s) not valid',
      r.table_name,
      format('%s_strict_payload_size_check', r.column_name),
      r.column_name,
      public.strict_payload_field_byte_limit(r.table_name, r.column_name)
    );
  end loop;
end;
$$;
