alter table if exists "public"."healthcare_vitals"
rename to "user_group_metrics";

alter table if exists "public"."healthcare_vital_groups"
rename to "user_group_metric_categories";

alter table if exists "public"."vital_group_vitals"
rename to "user_group_metric_category_links";

alter table if exists "public"."user_group_metric_category_links"
rename column "group_id" to "category_id";

alter table if exists "public"."user_group_metric_category_links"
rename column "vital_id" to "metric_id";

alter table "public"."user_group_metrics"
add column if not exists "is_weighted" boolean not null default true;

comment on table "public"."user_group_metrics" is
  'Workspace user-group metrics. Renamed from healthcare_vitals.';

comment on table "public"."user_group_metric_categories" is
  'Workspace user-group metric categories. Renamed from healthcare_vital_groups.';

comment on table "public"."user_group_metric_category_links" is
  'Links group metrics to metric categories. Renamed from vital_group_vitals.';

set check_function_bodies = off;

create or replace function public.can_manage_indicator(p_indicator_id uuid)
returns boolean
language sql
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from user_group_metrics metric
    where metric.id = p_indicator_id
      and is_org_member(auth.uid(), metric.ws_id)
  );
$function$;

