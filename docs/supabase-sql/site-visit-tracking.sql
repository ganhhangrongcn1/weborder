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

notify pgrst, 'reload schema';

-- Verification queries.
select *
from public.get_site_visit_daily_stats(
  (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  (now() at time zone 'Asia/Ho_Chi_Minh')::date
);

select
  visit_date,
  count(*) as page_views,
  count(distinct visitor_id) as unique_visitors
from public.site_visits
where visit_date >= ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 7)
group by visit_date
order by visit_date desc;
