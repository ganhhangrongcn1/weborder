-- Read-only audit. No schema/data/permission changes.
select s.account_key, s.branch_code, count(*) as days,
       min(f.metric_date) as from_date, max(f.metric_date) as to_date,
       sum(f.reach_count) as reach, sum(f.visit_count) as menu,
       sum(f.basket_count) as basket, sum(f.order_count) as checkout,
       max(f.last_synced_at) as synced_at
from public.partner_grab_conversion_funnel_daily f
join public.partner_review_sources s on s.id=f.source_id
where f.metric_date between date '2026-10-01' and date '2026-10-16'
group by s.account_key, s.branch_code order by s.account_key;

select jobid, jobname, schedule, active from cron.job
where jobname like 'grab-%' order by jobid;

select s.account_key, count(*) as branch_mismatches
from public.partner_grab_conversion_funnel_daily f
join public.partner_review_sources s on s.id=f.source_id
where f.branch_uuid is distinct from s.branch_uuid
group by s.account_key;

select relname, relrowsecurity from pg_class
where oid='public.partner_grab_conversion_funnel_daily'::regclass;
