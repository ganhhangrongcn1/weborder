-- Phase 1 trust upgrade - Admin dashboard daily revenue RPC
-- Goal:
-- 1. Keep the revenue chart fully server-side.
-- 2. Use the same order validity and net revenue rules as the dashboard summary.
-- 3. Return zero-value days so the chart never depends on browser-side order snapshots.
--
-- Safe to run multiple times.
-- Prerequisite: docs/supabase-sql/admin-dashboard-summary-rpc.sql

drop function if exists public.get_admin_dashboard_revenue_series(
  timestamptz,
  timestamptz,
  text
);
drop function if exists public.get_admin_dashboard_revenue_series(
  timestamptz,
  timestamptz,
  text,
  text
);

create or replace function public.get_admin_dashboard_revenue_series(
  p_date_from timestamptz,
  p_date_to timestamptz,
  p_branch_name text default null,
  p_branch_uuid text default null
)
returns table(
  metrics jsonb,
  daily_revenue jsonb
)
language sql
stable
security invoker
as $$
with bounds as (
  select
    p_date_from as date_from,
    p_date_to as date_to
),
days as (
  select day_value::date as day
  from bounds b
  cross join lateral generate_series(
    date_trunc('day', b.date_from at time zone 'Asia/Ho_Chi_Minh'),
    date_trunc('day', (b.date_to - interval '1 microsecond') at time zone 'Asia/Ho_Chi_Minh'),
    interval '1 day'
  ) as day_value
),
web_orders as (
  select
    o.created_at as order_time,
    case
      when public.normalize_order_counting_status(o.status) in (
        'cancel',
        'canceled',
        'cancelled',
        'huy',
        'dahuy',
        'refunded'
      ) then 'cancelled'
      when public.normalize_order_counting_status(o.status) in (
        'preorder',
        'preordered',
        'scheduled',
        'dattruoc'
      ) then 'preorder'
      when public.normalize_order_counting_status(o.status) in (
        'pending',
        'pendingzalo',
        'new'
      ) then 'pending'
      when public.normalize_order_counting_status(o.status) in (
        'delivering',
        'shipping'
      ) then 'delivering'
      when public.normalize_order_counting_status(o.status) in (
        'done',
        'completed',
        'complete',
        'finish',
        'finished',
        'served',
        'hoantat'
      ) then 'done'
      else 'preparing'
    end as status_group,
    greatest(
      coalesce(o.total_amount, 0)::numeric - coalesce(o.shipping_fee, 0)::numeric,
      0
    ) as net_revenue
  from public.orders o
  cross join bounds b
  where o.created_at >= b.date_from
    and o.created_at < b.date_to
    and (
      (coalesce(trim(p_branch_name), '') = '' and coalesce(trim(p_branch_uuid), '') = '')
      or (
        coalesce(trim(p_branch_uuid), '') <> ''
        and coalesce(o.delivery_branch_uuid, o.pickup_branch_uuid, o.branch_uuid)::text = trim(p_branch_uuid)
      )
      or public.normalize_order_counting_status(
        coalesce(
          nullif(trim(o.delivery_branch_name), ''),
          nullif(trim(o.pickup_branch_name), ''),
          nullif(trim(o.branch_name), ''),
          'Chưa xác định'
        )
      ) = public.normalize_order_counting_status(p_branch_name)
    )
),
partner_orders as (
  select
    coalesce(po.order_time, po.created_at) as order_time,
    case
      when public.normalize_order_counting_status(po.order_status) in (
        'cancel',
        'canceled',
        'cancelled',
        'huy',
        'dahuy',
        'refunded'
      )
        or public.normalize_order_counting_status(po.nexpos_status) in (
          'cancel',
          'canceled',
          'cancelled',
          'huy',
          'dahuy',
          'refunded'
        )
        or public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) in (
          'cancel',
          'canceled',
          'cancelled',
          'huy',
          'dahuy',
          'refunded'
        ) then 'cancelled'
      when public.normalize_order_counting_status(po.order_status) in (
        'preorder',
        'preordered',
        'scheduled',
        'dattruoc'
      )
        or public.normalize_order_counting_status(po.nexpos_status) in (
          'preorder',
          'preordered',
          'scheduled',
          'dattruoc'
        )
        or public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) in (
          'preorder',
          'preordered',
          'scheduled',
          'dattruoc'
        ) then 'preorder'
      when public.normalize_order_counting_status(po.order_status) in ('delivering', 'shipping')
        or public.normalize_order_counting_status(po.nexpos_status) in ('delivering', 'shipping')
        then 'delivering'
      when public.normalize_order_counting_status(po.order_status) in (
        'done',
        'completed',
        'complete',
        'finish',
        'finished',
        'served',
        'hoantat'
      )
        or public.normalize_order_counting_status(po.nexpos_status) in (
          'done',
          'completed',
          'complete',
          'finish',
          'finished',
          'served',
          'hoantat'
        ) then 'done'
      when public.normalize_order_counting_status(po.order_status) in (
        '',
        'pending',
        'pendingzalo',
        'new'
      )
        and public.normalize_order_counting_status(po.nexpos_status) in (
          '',
          'pending',
          'pendingzalo',
          'new'
        ) then 'pending'
      else 'preparing'
    end as status_group,
    greatest(
      coalesce(
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,real_received}'),
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,net_received}'),
        public.dashboard_to_numeric(po.raw_data ->> 'total_for_biz'),
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,gross_received}'),
        coalesce(po.total_amount, 0)::numeric - coalesce(po.shipping_fee, 0)::numeric
      ),
      0
    ) as net_revenue
  from public.partner_orders po
  cross join bounds b
  where coalesce(po.order_time, po.created_at) >= b.date_from
    and coalesce(po.order_time, po.created_at) < b.date_to
    and (
      (coalesce(trim(p_branch_name), '') = '' and coalesce(trim(p_branch_uuid), '') = '')
      or (
        coalesce(trim(p_branch_uuid), '') <> ''
        and po.branch_uuid::text = trim(p_branch_uuid)
      )
      or public.normalize_order_counting_status(
        coalesce(
          nullif(trim(po.branch_name), ''),
          nullif(trim(po.nexpos_site_name), ''),
          nullif(trim(po.nexpos_hub_name), ''),
          'Chưa xác định'
        )
      ) = public.normalize_order_counting_status(p_branch_name)
    )
),
unified_orders as (
  select * from web_orders
  union all
  select * from partner_orders
),
summary as (
  select
    count(*) filter (where status_group <> 'preorder')::integer as total_orders,
    coalesce(
      sum(net_revenue) filter (where status_group not in ('cancelled', 'preorder')),
      0
    )::numeric as net_revenue,
    count(*) filter (where status_group not in ('cancelled', 'preorder'))::integer as revenue_order_count,
    count(*) filter (where status_group = 'pending')::integer as pending_orders,
    count(*) filter (where status_group = 'preparing')::integer as preparing_orders,
    count(*) filter (where status_group = 'delivering')::integer as delivering_orders,
    count(*) filter (where status_group = 'cancelled')::integer as cancelled_orders,
    count(*) filter (where status_group = 'done')::integer as completed_orders
  from unified_orders
),
daily as (
  select
    d.day,
    count(u.order_time) filter (where u.status_group <> 'preorder')::integer as total_orders,
    coalesce(
      sum(u.net_revenue) filter (where u.status_group not in ('cancelled', 'preorder')),
      0
    )::numeric as net_revenue
  from days d
  left join unified_orders u
    on (u.order_time at time zone 'Asia/Ho_Chi_Minh')::date = d.day
  group by d.day
)
select
  jsonb_build_object(
    'total_orders', s.total_orders,
    'net_revenue', s.net_revenue,
    'average_order_value',
      case
        when s.revenue_order_count > 0 then s.net_revenue / s.revenue_order_count
        else 0
      end,
    'pending_orders', s.pending_orders,
    'preparing_orders', s.preparing_orders,
    'delivering_orders', s.delivering_orders,
    'cancelled_orders', s.cancelled_orders,
    'completed_orders', s.completed_orders
  ) as metrics,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'date', to_char(d.day, 'YYYY-MM-DD'),
          'total_orders', d.total_orders,
          'net_revenue', d.net_revenue
        )
        order by d.day
      )
      from daily d
    ),
    '[]'::jsonb
  ) as daily_revenue
from summary s;
$$;

grant execute on function public.get_admin_dashboard_revenue_series(
  timestamptz,
  timestamptz,
  text,
  text
) to anon, authenticated;

notify pgrst, 'reload schema';

-- Verification query: seven Vietnam-local days including today.
select *
from public.get_admin_dashboard_revenue_series(
  (
    date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh')
    - interval '6 days'
  ) at time zone 'Asia/Ho_Chi_Minh',
  (
    date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh')
    + interval '1 day'
  ) at time zone 'Asia/Ho_Chi_Minh',
  null,
  null
);
