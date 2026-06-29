-- Phase 2 - Admin dashboard aggregate RPC
-- Goal:
-- 1. Keep operational KPIs on one Supabase backend contract.
-- 2. Use Vietnam-local date ranges provided by the admin app.
-- 3. Report net received revenue:
--    - Web: total payment minus shipping fee.
--    - FoodApp: prefer reconciliation real_received / net_received fields.
--
-- Safe to run multiple times.
-- Prerequisite: docs/customer-order-counting-rpc.sql

create or replace function public.dashboard_to_numeric(p_value text)
returns numeric
language sql
immutable
as $$
  select case
    when trim(coalesce(p_value, '')) ~ '^-?[0-9]+([.][0-9]+)?$'
      then trim(p_value)::numeric
    else null
  end;
$$;

create or replace function public.normalize_dashboard_channel(
  p_source text,
  p_fulfillment_type text default ''
)
returns text
language sql
stable
as $$
  select case
    when public.normalize_order_counting_status(p_source) in ('grab', 'grabfood')
      then 'grabfood'
    when public.normalize_order_counting_status(p_source) in ('shopee', 'shopeefood')
      then 'shopeefood'
    when public.normalize_order_counting_status(p_source) in ('xanh', 'xanhngon')
      then 'xanhngon'
    when public.normalize_order_counting_status(p_source) in ('pos', 'posmobile', 'posapp', 'posmobileorder', 'taiquay')
      then 'pos'
    when public.normalize_order_counting_status(p_source) in ('qr', 'qrcounter', 'counter')
      then 'qr_counter'
    when public.normalize_order_counting_status(p_fulfillment_type) in ('qr', 'qrcounter', 'counter')
      then 'qr_counter'
    when public.normalize_order_counting_status(p_source) in (
      'web',
      'website',
      'weborder',
      'online',
      'ecommerce'
    ) then 'website'
    when coalesce(trim(p_source), '') = ''
      then 'unknown'
    else 'other'
  end;
$$;

drop function if exists public.get_admin_dashboard_summary(timestamptz, timestamptz, text);
drop function if exists public.get_admin_dashboard_summary(timestamptz, timestamptz, text, text);

create or replace function public.get_admin_dashboard_summary(
  p_date_from timestamptz,
  p_date_to timestamptz,
  p_branch_name text default null,
  p_branch_uuid text default null
)
returns table(
  total_customers bigint,
  period_customers bigint,
  current_metrics jsonb,
  previous_metrics jsonb,
  week_metrics jsonb,
  channel_breakdown jsonb
)
language sql
stable
security invoker
as $$
with bounds as (
  select
    p_date_from as current_from,
    p_date_to as current_to,
    p_date_from - (p_date_to - p_date_from) as previous_from,
    p_date_from as previous_to,
    p_date_from - interval '7 days' as week_from,
    p_date_to - interval '7 days' as week_to
),
periods as (
  select 'current'::text as period_key, current_from as date_from, current_to as date_to
  from bounds
  union all
  select 'previous', previous_from, previous_to
  from bounds
  union all
  select 'week', week_from, week_to
  from bounds
),
web_orders as (
  select
    o.created_at as order_time,
    public.normalize_vietnam_phone(o.customer_phone) as customer_key,
    coalesce(
      nullif(trim(o.delivery_branch_name), ''),
      nullif(trim(o.pickup_branch_name), ''),
      nullif(trim(o.branch_name), ''),
      'Chưa xác định'
    ) as branch_name,
    coalesce(o.delivery_branch_uuid, o.pickup_branch_uuid, o.branch_uuid)::text as branch_uuid,
    public.normalize_dashboard_channel(
      coalesce(
        nullif(trim(o.metadata ->> 'orderSource'), ''),
        nullif(trim(o.metadata ->> 'source'), ''),
        nullif(trim(o.metadata ->> 'channel'), ''),
        nullif(trim(o.metadata ->> 'sourceType'), ''),
        nullif(trim(o.metadata ->> 'platform'), ''),
        ''
      ),
      o.fulfillment_type
    ) as channel_key,
    case
      when public.normalize_order_counting_status(o.status) in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded')
        then 'cancelled'
      when public.normalize_order_counting_status(o.status) in ('preorder', 'preordered', 'scheduled', 'dattruoc')
        then 'preorder'
      when public.normalize_order_counting_status(o.status) in ('pending', 'pendingzalo', 'new')
        then 'pending'
      when public.normalize_order_counting_status(o.status) in ('delivering', 'shipping')
        then 'delivering'
      when public.normalize_order_counting_status(o.status) in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
        then 'done'
      else 'preparing'
    end as status_group,
    greatest(coalesce(o.total_amount, 0)::numeric - coalesce(o.shipping_fee, 0)::numeric, 0) as net_revenue
  from public.orders o
  cross join bounds b
  where o.created_at >= least(b.previous_from, b.week_from)
    and o.created_at < b.current_to
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
    public.normalize_vietnam_phone(
      coalesce(nullif(trim(po.customer_phone_key), ''), po.customer_phone)
    ) as customer_key,
    coalesce(
      nullif(trim(po.branch_name), ''),
      nullif(trim(po.nexpos_site_name), ''),
      nullif(trim(po.nexpos_hub_name), ''),
      'Chưa xác định'
    ) as branch_name,
    po.branch_uuid::text as branch_uuid,
    public.normalize_dashboard_channel(po.partner_source) as channel_key,
    case
      when public.normalize_order_counting_status(po.order_status) in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded')
        or public.normalize_order_counting_status(po.nexpos_status) in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded')
        or public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded')
        then 'cancelled'
      when public.normalize_order_counting_status(po.order_status) in ('preorder', 'preordered', 'scheduled', 'dattruoc')
        or public.normalize_order_counting_status(po.nexpos_status) in ('preorder', 'preordered', 'scheduled', 'dattruoc')
        or public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) in ('preorder', 'preordered', 'scheduled', 'dattruoc')
        then 'preorder'
      when public.normalize_order_counting_status(po.order_status) in ('delivering', 'shipping')
        or public.normalize_order_counting_status(po.nexpos_status) in ('delivering', 'shipping')
        then 'delivering'
      when public.normalize_order_counting_status(po.order_status) in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
        or public.normalize_order_counting_status(po.nexpos_status) in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
        then 'done'
      when public.normalize_order_counting_status(po.order_status) in ('', 'pending', 'pendingzalo', 'new')
        and public.normalize_order_counting_status(po.nexpos_status) in ('', 'pending', 'pendingzalo', 'new')
        then 'pending'
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
  where coalesce(po.order_time, po.created_at) >= least(b.previous_from, b.week_from)
    and coalesce(po.order_time, po.created_at) < b.current_to
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
period_metrics as (
  select
    p.period_key,
    count(*) filter (where u.status_group <> 'preorder')::integer as total_orders,
    coalesce(sum(u.net_revenue) filter (where u.status_group not in ('cancelled', 'preorder')), 0)::numeric as net_revenue,
    count(*) filter (where u.status_group not in ('cancelled', 'preorder'))::integer as revenue_order_count,
    count(*) filter (where u.status_group = 'pending')::integer as pending_orders,
    count(*) filter (where u.status_group = 'preparing')::integer as preparing_orders,
    count(*) filter (where u.status_group = 'delivering')::integer as delivering_orders,
    count(*) filter (where u.status_group = 'cancelled')::integer as cancelled_orders,
    count(*) filter (where u.status_group = 'done')::integer as completed_orders
  from periods p
  left join unified_orders u
    on u.order_time >= p.date_from
   and u.order_time < p.date_to
  group by p.period_key
),
metric_json as (
  select
    period_key,
    jsonb_build_object(
      'total_orders', total_orders,
      'net_revenue', net_revenue,
      'average_order_value', case when revenue_order_count > 0 then net_revenue / revenue_order_count else 0 end,
      'pending_orders', pending_orders,
      'preparing_orders', preparing_orders,
      'delivering_orders', delivering_orders,
      'cancelled_orders', cancelled_orders,
      'completed_orders', completed_orders,
      'cancel_rate', case when total_orders > 0 then cancelled_orders::numeric / total_orders else 0 end
    ) as metrics
  from period_metrics
),
channels as (
  select
    u.channel_key,
    count(*) filter (where u.status_group <> 'preorder')::integer as total_orders,
    count(*) filter (where u.status_group not in ('cancelled', 'preorder'))::integer as revenue_order_count,
    coalesce(sum(u.net_revenue) filter (where u.status_group not in ('cancelled', 'preorder')), 0)::numeric as net_revenue
  from unified_orders u
  cross join bounds b
  where u.order_time >= b.current_from
    and u.order_time < b.current_to
  group by u.channel_key
)
select
  (
    select count(*)::bigint
    from public.profiles p
    where p.role = 'customer'
  ) as total_customers,
  (
    select count(distinct u.customer_key)::bigint
    from unified_orders u
    cross join bounds b
    where u.order_time >= b.current_from
      and u.order_time < b.current_to
      and u.status_group not in ('cancelled', 'preorder')
      and coalesce(u.customer_key, '') <> ''
  ) as period_customers,
  coalesce((select metrics from metric_json where period_key = 'current'), '{}'::jsonb) as current_metrics,
  coalesce((select metrics from metric_json where period_key = 'previous'), '{}'::jsonb) as previous_metrics,
  coalesce((select metrics from metric_json where period_key = 'week'), '{}'::jsonb) as week_metrics,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'channel', channel_key,
          'total_orders', total_orders,
          'revenue_order_count', revenue_order_count,
          'net_revenue', net_revenue
        )
        order by total_orders desc, channel_key
      )
      from channels
    ),
    '[]'::jsonb
  ) as channel_breakdown;
$$;

grant execute on function public.dashboard_to_numeric(text) to anon, authenticated;
grant execute on function public.normalize_dashboard_channel(text, text) to anon, authenticated;
grant execute on function public.get_admin_dashboard_summary(timestamptz, timestamptz, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Verification query: Vietnam-local current day.
select *
from public.get_admin_dashboard_summary(
  date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh',
  (date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') + interval '1 day') at time zone 'Asia/Ho_Chi_Minh',
  null,
  null
);
