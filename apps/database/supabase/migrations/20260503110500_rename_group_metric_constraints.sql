alter table if exists "public"."user_group_metric_categories"
rename constraint "healthcare_vital_groups_pkey" to "user_group_metric_categories_pkey";

alter table if exists "public"."user_group_metric_categories"
rename constraint "healthcare_vital_groups_ws_id_fkey" to "user_group_metric_categories_ws_id_fkey";

alter table if exists "public"."user_group_metric_category_links"
rename constraint "vital_group_vitals_pkey" to "user_group_metric_category_links_pkey";

alter table if exists "public"."user_group_metric_category_links"
rename constraint "vital_group_vitals_group_id_fkey" to "user_group_metric_category_links_category_id_fkey";

alter table if exists "public"."user_group_metric_category_links"
rename constraint "vital_group_vitals_vital_id_fkey" to "user_group_metric_category_links_metric_id_fkey";

alter table if exists "public"."user_group_metrics"
rename constraint "healthcare_vitals_pkey" to "user_group_metrics_pkey";

alter table if exists "public"."user_group_metrics"
rename constraint "healthcare_vitals_ws_id_fkey" to "user_group_metrics_ws_id_fkey";

alter table if exists "public"."user_group_metrics"
rename constraint "public_healthcare_vitals_group_id_fkey" to "user_group_metrics_group_id_fkey";

alter function "public"."get_healthcare_vital_groups_count"(uuid)
rename to "get_user_group_metric_categories_count";

alter function "public"."get_healthcare_vitals_count"(uuid)
rename to "get_user_group_metrics_count";
