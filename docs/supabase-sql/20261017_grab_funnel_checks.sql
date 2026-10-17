-- Read-only audit. Existing table reused; no schema, grants, RLS or schedules changed.
select s.account_key, s.branch_code, min(f.metric_date) as from_date,
       max(f.metric_date) as to_date, count(*) as days,
       sum(f.reach_count) as views, sum(f.visit_count) as menu_views,
       sum(f.basket_count) as baskets, sum(f.order_count) as checkouts,
       max(f.last_synced_at) as last_synced_at
from public.partner_grab_conversion_funnel_daily f
join public.partner_review_sources s on s.id = f.source_id
group by s.account_key, s.branch_code;

select account_key, metadata->'grab_funnel_last_run' as funnel_last_run
from public.partner_review_sources where account_key = 'grab_vietsing';

select policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
  and tablename = 'partner_grab_conversion_funnel_daily';

select jobid, jobname, schedule, active
from cron.job where jobname = 'grab-vietsing-pilot-hourly';
