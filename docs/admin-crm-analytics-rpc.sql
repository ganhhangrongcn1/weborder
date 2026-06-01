-- Phase 4 - Practical CRM analytics RPC
-- Goal:
-- 1. Keep customer segments and CRM filters on one Supabase backend contract.
-- 2. Measure repeat customers, new customers and inactive customer groups.
-- 3. Suggest voucher groups without sending vouchers automatically.
--
-- Safe to run multiple times.
-- Prerequisite: docs/admin-dashboard-summary-rpc.sql

create or replace function public.get_admin_crm_analytics()
returns table(
  summary jsonb,
  customers jsonb,
  top_customers_by_spent jsonb,
  top_customers_by_orders jsonb,
  filter_options jsonb,
  voucher_segments jsonb,
  vip_criteria jsonb
)
language sql
stable
security invoker
as $$
with raw_web_orders as (
  select public.normalize_vietnam_phone(o.customer_phone) as customer_phone
  from public.orders o
  where coalesce(trim(o.customer_phone), '') <> ''
),
raw_partner_orders as (
  select public.normalize_vietnam_phone(coalesce(nullif(trim(po.customer_phone_key), ''), po.customer_phone)) as customer_phone
  from public.partner_orders po
  where coalesce(trim(coalesce(nullif(po.customer_phone_key, ''), po.customer_phone)), '') <> ''
),
raw_customer_orders as (
  select customer_phone, count(*)::integer as raw_order_count
  from (
    select * from raw_web_orders
    union all
    select * from raw_partner_orders
  ) raw_orders
  where coalesce(customer_phone, '') <> ''
  group by customer_phone
),
web_orders as (
  select
    public.normalize_vietnam_phone(o.customer_phone) as customer_phone,
    o.created_at as order_time,
    coalesce(
      nullif(trim(o.delivery_branch_name), ''),
      nullif(trim(o.pickup_branch_name), ''),
      nullif(trim(o.branch_name), ''),
      'Chưa xác định'
    ) as branch_name,
    public.normalize_dashboard_channel(
      coalesce(o.metadata ->> 'orderSource', o.metadata ->> 'source', o.metadata ->> 'channel', 'website'),
      o.fulfillment_type
    ) as channel_key,
    greatest(coalesce(o.total_amount, 0)::numeric, 0) as total_spent
  from public.orders o
  where coalesce(trim(o.customer_phone), '') <> ''
    and public.normalize_order_counting_status(o.status) not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
partner_orders as (
  select
    public.normalize_vietnam_phone(coalesce(nullif(trim(po.customer_phone_key), ''), po.customer_phone)) as customer_phone,
    coalesce(po.order_time, po.created_at) as order_time,
    coalesce(
      nullif(trim(po.branch_name), ''),
      nullif(trim(po.nexpos_site_name), ''),
      nullif(trim(po.nexpos_hub_name), ''),
      'Chưa xác định'
    ) as branch_name,
    public.normalize_dashboard_channel(po.partner_source) as channel_key,
    greatest(coalesce(po.total_amount, 0)::numeric, 0) as total_spent
  from public.partner_orders po
  where coalesce(trim(coalesce(nullif(po.customer_phone_key, ''), po.customer_phone)), '') <> ''
    and public.normalize_order_counting_status(po.order_status) not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and public.normalize_order_counting_status(po.nexpos_status) not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
all_orders as (
  select * from web_orders
  union all
  select * from partner_orders
),
customer_orders as (
  select
    customer_phone,
    count(*)::integer as total_orders,
    coalesce(sum(total_spent), 0)::numeric as total_spent,
    min(order_time) as first_order_at,
    max(order_time) as last_order_at,
    count(*) filter (where order_time >= now() - interval '30 days')::integer as orders_30_days
  from all_orders
  where coalesce(customer_phone, '') <> ''
  group by customer_phone
),
latest_order as (
  select distinct on (customer_phone)
    customer_phone,
    branch_name as last_branch,
    channel_key as last_channel
  from all_orders
  where coalesce(customer_phone, '') <> ''
  order by customer_phone, order_time desc
),
profile_customers as (
  select distinct on (public.normalize_vietnam_phone(p.phone))
    public.normalize_vietnam_phone(p.phone) as customer_phone,
    coalesce(nullif(trim(p.name), ''), 'Khách hàng') as customer_name,
    coalesce(nullif(trim(p.metadata ->> 'source'), ''), 'profile') as profile_source
  from public.profiles p
  where p.role = 'customer'
    and coalesce(trim(p.phone), '') <> ''
  order by public.normalize_vietnam_phone(p.phone), p.updated_at desc nulls last
),
profile_variants as (
  select
    p.customer_phone,
    p.customer_name,
    p.profile_source,
    variant_phone
  from profile_customers p
  cross join lateral unnest(public.get_customer_phone_variants(p.customer_phone)) as variant_phone
),
configured_branches as (
  select distinct trim(b.name) as branch_name
  from public.branches b
  where coalesce(trim(b.name), '') <> ''
    and public.normalize_order_counting_status(b.name) not in ('chinhanhtest', 'test')
),
customer_orders_by_profile as (
  select
    pv.customer_phone,
    count(*)::integer as total_orders,
    coalesce(sum(o.total_spent), 0)::numeric as total_spent,
    min(o.order_time) as first_order_at,
    max(o.order_time) as last_order_at,
    count(*) filter (where o.order_time >= now() - interval '30 days')::integer as orders_30_days
  from profile_variants pv
  join all_orders o
    on o.customer_phone = pv.variant_phone
  group by pv.customer_phone
),
raw_customer_orders_by_profile as (
  select
    pv.customer_phone,
    coalesce(sum(ro.raw_order_count), 0)::integer as raw_order_count
  from profile_variants pv
  join raw_customer_orders ro
    on ro.customer_phone = pv.variant_phone
  group by pv.customer_phone
),
latest_order_by_profile as (
  select distinct on (pv.customer_phone)
    pv.customer_phone,
    o.branch_name as last_branch,
    o.channel_key as last_channel,
    o.order_time
  from profile_variants pv
  join all_orders o
    on o.customer_phone = pv.variant_phone
  order by pv.customer_phone, o.order_time desc
),
customer_base as (
  select
    p.customer_phone,
    p.customer_name,
    p.profile_source,
    coalesce(o.total_orders, 0)::integer as total_orders,
    coalesce(ro.raw_order_count, 0)::integer as raw_order_count,
    coalesce(o.total_spent, 0)::numeric as total_spent,
    o.first_order_at,
    o.last_order_at,
    coalesce(o.orders_30_days, 0)::integer as orders_30_days,
    coalesce(cb.branch_name, 'Chưa xác định') as last_branch,
    coalesce(l.last_channel, 'website') as last_channel,
    case
      when o.last_order_at is null then null
      else greatest(0, floor(extract(epoch from (now() - o.last_order_at)) / 86400))::integer
    end as days_since_last_order
  from profile_customers p
  left join customer_orders_by_profile o
    on o.customer_phone = p.customer_phone
  left join raw_customer_orders_by_profile ro
    on ro.customer_phone = p.customer_phone
  left join latest_order_by_profile l
    on l.customer_phone = p.customer_phone
  left join configured_branches cb
    on public.normalize_order_counting_status(cb.branch_name) = public.normalize_order_counting_status(l.last_branch)
),
segmented as (
  select
    c.*,
    (c.total_spent >= 1000000 or c.total_orders >= 10) as is_vip,
    case
      when c.total_orders = 0 and c.raw_order_count > 0 then 'excluded_order_only'
      when c.last_order_at is null then 'first_order_offer'
      when c.days_since_last_order >= 30 then 'winback_30'
      when c.days_since_last_order >= 15 then 'winback_15'
      when c.days_since_last_order >= 7 then 'winback_7'
      when c.total_spent >= 1000000 or c.total_orders >= 10 then 'vip_thank_you'
      when c.orders_30_days >= 2 then 'repeat_reward'
      else 'none'
    end as voucher_segment
  from customer_base c
),
customer_json as (
  select jsonb_agg(
    jsonb_build_object(
      'customer_phone', customer_phone,
      'customer_name', customer_name,
      'profile_source', profile_source,
      'total_orders', total_orders,
      'raw_order_count', raw_order_count,
      'total_spent', total_spent,
      'first_order_at', first_order_at,
      'last_order_at', last_order_at,
      'days_since_last_order', days_since_last_order,
      'last_branch', last_branch,
      'last_channel', last_channel,
      'orders_30_days', orders_30_days,
      'is_vip', is_vip,
      'voucher_segment', voucher_segment
    )
    order by last_order_at desc nulls last, total_spent desc
  ) as rows
  from segmented
),
segment_counts as (
  select voucher_segment, count(*)::integer as customer_count
  from segmented
  where voucher_segment <> 'none'
  group by voucher_segment
),
branches as (
  select branch_name as last_branch
  from configured_branches
),
channels as (
  select distinct last_channel
  from segmented
  where coalesce(last_channel, '') <> ''
)
select
  jsonb_build_object(
    'total_customers', count(*)::integer,
    'customers_with_orders', count(*) filter (where total_orders > 0)::integer,
    'repeat_customers_30_days', count(*) filter (where orders_30_days >= 2)::integer,
    'repeat_rate_30_days', case
      when count(*) filter (where orders_30_days > 0) > 0
        then (count(*) filter (where orders_30_days >= 2))::numeric / (count(*) filter (where orders_30_days > 0))
      else 0
    end,
    'new_customers_7_days', count(*) filter (where first_order_at >= now() - interval '7 days')::integer,
    'new_customers_30_days', count(*) filter (where first_order_at >= now() - interval '30 days')::integer,
    'inactive_7_days', count(*) filter (where days_since_last_order >= 7)::integer,
    'inactive_15_days', count(*) filter (where days_since_last_order >= 15)::integer,
    'inactive_30_days', count(*) filter (where days_since_last_order >= 30)::integer,
    'vip_customers', count(*) filter (where is_vip)::integer
  ) as summary,
  coalesce((select rows from customer_json), '[]'::jsonb) as customers,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('customer_phone', customer_phone, 'customer_name', customer_name, 'total_orders', total_orders, 'total_spent', total_spent)
        order by total_spent desc, total_orders desc
      )
      from (select * from segmented order by total_spent desc, total_orders desc limit 10) ranked
    ),
    '[]'::jsonb
  ) as top_customers_by_spent,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('customer_phone', customer_phone, 'customer_name', customer_name, 'total_orders', total_orders, 'total_spent', total_spent)
        order by total_orders desc, total_spent desc
      )
      from (select * from segmented order by total_orders desc, total_spent desc limit 10) ranked
    ),
    '[]'::jsonb
  ) as top_customers_by_orders,
  jsonb_build_object(
    'branches', coalesce((select jsonb_agg(last_branch order by last_branch) from branches), '[]'::jsonb),
    'channels', coalesce((select jsonb_agg(last_channel order by last_channel) from channels), '[]'::jsonb)
  ) as filter_options,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('segment', voucher_segment, 'customer_count', customer_count)
        order by customer_count desc, voucher_segment
      )
      from segment_counts
    ),
    '[]'::jsonb
  ) as voucher_segments,
  jsonb_build_object(
    'min_total_spent', 1000000,
    'min_total_orders', 10,
    'rule', 'Khách VIP khi tổng chi tiêu từ 1.000.000đ hoặc có từ 10 đơn hàng.'
  ) as vip_criteria
from segmented;
$$;

grant execute on function public.get_admin_crm_analytics() to anon, authenticated;

-- Verification query.
select *
from public.get_admin_crm_analytics();

-- Diagnostic query: inspect profiles without valid orders.
select
  customer ->> 'customer_phone' as customer_phone,
  customer ->> 'customer_name' as customer_name,
  customer ->> 'profile_source' as profile_source,
  (customer ->> 'raw_order_count')::integer as raw_order_count,
  customer ->> 'voucher_segment' as segment
from public.get_admin_crm_analytics() analytics
cross join lateral jsonb_array_elements(analytics.customers) customer
where (customer ->> 'total_orders')::integer = 0
order by (customer ->> 'raw_order_count')::integer desc, customer_phone;
