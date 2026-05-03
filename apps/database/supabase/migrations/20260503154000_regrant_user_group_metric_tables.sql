grant select, insert, update, delete on table "public"."user_group_metrics" to "authenticated";
grant select, insert, update, delete on table "public"."user_group_metric_categories" to "authenticated";
grant select, insert, update, delete on table "public"."user_group_metric_category_links" to "authenticated";

grant all privileges on table "public"."user_group_metrics" to "service_role";
grant all privileges on table "public"."user_group_metric_categories" to "service_role";
grant all privileges on table "public"."user_group_metric_category_links" to "service_role";
