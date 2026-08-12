-- Site visit tracking - simple daily traffic analytics
-- Goal:
-- 1. Record customer website page views from the frontend.
-- 2. Count daily page views and unique visitors in the admin dashboard.
-- 3. Keep visitor tracking anonymous: no phone, no customer profile id, no IP stored.
--
-- Safe to run multiple times.

create table if not exists public.site_visits (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  visit_date date not null default ((now() at time zone 'Asia/Ho_Chi_Minh')::date),
  path text not null default '/',
  route_group text not null default 'customer',
  referrer text not null default '',
  source text not null default 'direct',
  device text not null default 'unknown',
  viewport_width integer,
  user_agent text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.site_visits enable row level security;

create index if not exists site_visits_visit_date_idx
  on public.site_visits (visit_date desc);

create index if not exists site_visits_created_at_idx
  on public.site_visits (created_at desc);

create index if not exists site_visits_route_group_idx
  on public.site_visits (route_group);

create index if not exists site_visits_source_idx
  on public.site_visits (source);

create index if not exists site_visits_visitor_date_idx
  on public.site_visits (visitor_id, visit_date);

drop policy if exists "site_visits_public_insert" on public.site_visits;
drop policy if exists "site_visits_staff_select" on public.site_visits;

create policy "site_visits_public_insert"
on public.site_visits
for insert
to anon, authenticated
with check (
  coalesce(trim(visitor_id), '') <> ''
  and char_length(visitor_id) <= 120
  and char_length(path) <= 240
  and char_length(route_group) <= 80
  and char_length(coalesce(referrer, '')) <= 500
  and char_length(source) <= 120
  and char_length(device) <= 40
  and char_length(coalesce(user_agent, '')) <= 500
  and visit_date >= ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1)
  and visit_date <= ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 1)
);

create policy "site_visits_staff_select"
on public.site_visits
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and lower(coalesce(p.role, '')) in ('admin', 'staff')
      and lower(coalesce(p.status, 'active')) = 'active'
  )
);

drop function if exists public.get_site_visit_daily_stats(date, date);

create or replace function public.get_site_visit_daily_stats(
  p_date_from date,
  p_date_to date
)
returns table(
  visit_date date,
  page_views bigint,
  unique_visitors bigint
)
language sql
stable
security invoker
as $$
with normalized_bounds as (
  select
    least(coalesce(p_date_from, (now() at time zone 'Asia/Ho_Chi_Minh')::date), coalesce(p_date_to, (now() at time zone 'Asia/Ho_Chi_Minh')::date)) as date_from,
    greatest(coalesce(p_date_from, (now() at time zone 'Asia/Ho_Chi_Minh')::date), coalesce(p_date_to, (now() at time zone 'Asia/Ho_Chi_Minh')::date)) as date_to
),
days as (
  select generate_series(date_from, date_to, interval '1 day')::date as visit_date
  from normalized_bounds
),
daily as (
  select
    sv.visit_date,
    count(*)::bigint as page_views,
    count(distinct sv.visitor_id)::bigint as unique_visitors
  from public.site_visits sv
  cross join normalized_bounds b
  where sv.visit_date >= b.date_from
    and sv.visit_date <= b.date_to
  group by sv.visit_date
)
select
  d.visit_date,
  coalesce(daily.page_views, 0)::bigint as page_views,
  coalesce(daily.unique_visitors, 0)::bigint as unique_visitors
from days d
left join daily
  on daily.visit_date = d.visit_date
order by d.visit_date;
$$;

grant usage on schema public to anon, authenticated;
grant insert on public.site_visits to anon, authenticated;
grant select on public.site_visits to authenticated;
grant execute on function public.get_site_visit_daily_stats(date, date) to authenticated;

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
set search_path = ''
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

notify pgrst, 'reload schema';

-- Verification queries.
select *
from public.get_site_visit_daily_stats(
  (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  (now() at time zone 'Asia/Ho_Chi_Minh')::date
);

select *
from public.get_site_visit_traffic_stats('24h', 0);

select
  visit_date,
  count(*) as page_views,
  count(distinct visitor_id) as unique_visitors
from public.site_visits
where visit_date >= ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 7)
group by visit_date
order by visit_date desc;
