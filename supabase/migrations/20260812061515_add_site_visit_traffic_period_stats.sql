drop function if exists public.get_site_visit_traffic_stats(text, integer);

create or replace function public.get_site_visit_traffic_stats(
  p_period text default '24h',
  p_offset integer default 0
)
returns table(
  bucket_start timestamptz,
  page_views bigint,
  unique_visitors bigint,
  total_page_views bigint,
  total_unique_visitors bigint
)
language sql
stable
security invoker
as $$
with settings as (
  select
    case when lower(coalesce(p_period, '24h')) in ('24h', '7d', '30d')
      then lower(coalesce(p_period, '24h'))
      else '24h'
    end as period_key,
    greatest(coalesce(p_offset, 0), 0) as period_offset,
    now() at time zone 'Asia/Ho_Chi_Minh' as now_vn
),
bounds as (
  select
    period_key,
    case period_key
      when '7d' then date_trunc('day', now_vn) - interval '6 days' - (period_offset * interval '7 days')
      when '30d' then date_trunc('day', now_vn) - interval '29 days' - (period_offset * interval '30 days')
      else date_trunc('hour', now_vn) - interval '23 hours' - (period_offset * interval '24 hours')
    end as local_from,
    case period_key
      when '7d' then date_trunc('day', now_vn) + interval '1 day' - (period_offset * interval '7 days')
      when '30d' then date_trunc('day', now_vn) + interval '1 day' - (period_offset * interval '30 days')
      else date_trunc('hour', now_vn) + interval '1 hour' - (period_offset * interval '24 hours')
    end as local_to,
    case when period_key = '24h' then interval '1 hour' else interval '1 day' end as bucket_step
  from settings
),
buckets as (
  select
    b.period_key,
    b.local_from,
    b.local_to,
    generate_series(b.local_from, b.local_to - b.bucket_step, b.bucket_step) as bucket_local
  from bounds b
),
visits as (
  select
    sv.visitor_id,
    sv.created_at,
    case
      when b.period_key = '24h' then date_trunc('hour', sv.created_at at time zone 'Asia/Ho_Chi_Minh')
      else date_trunc('day', sv.created_at at time zone 'Asia/Ho_Chi_Minh')
    end as bucket_local
  from public.site_visits sv
  cross join bounds b
  where sv.created_at >= (b.local_from at time zone 'Asia/Ho_Chi_Minh')
    and sv.created_at < (b.local_to at time zone 'Asia/Ho_Chi_Minh')
),
bucket_totals as (
  select
    v.bucket_local,
    count(*)::bigint as page_views,
    count(distinct v.visitor_id)::bigint as unique_visitors
  from visits v
  group by v.bucket_local
),
period_totals as (
  select
    count(*)::bigint as page_views,
    count(distinct visitor_id)::bigint as unique_visitors
  from visits
)
select
  (b.bucket_local at time zone 'Asia/Ho_Chi_Minh') as bucket_start,
  coalesce(bt.page_views, 0)::bigint as page_views,
  coalesce(bt.unique_visitors, 0)::bigint as unique_visitors,
  pt.page_views as total_page_views,
  pt.unique_visitors as total_unique_visitors
from buckets b
left join bucket_totals bt on bt.bucket_local = b.bucket_local
cross join period_totals pt
order by b.bucket_local;
$$;

grant execute on function public.get_site_visit_traffic_stats(text, integer) to authenticated;

notify pgrst, 'reload schema';;
