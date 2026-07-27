-- Phase 3 - Admin business analytics RPC
-- Goal:
-- 1. Keep business-performance analytics on one Supabase backend contract.
-- 2. Compare gross revenue with net received revenue.
-- 3. Aggregate products, hourly revenue and branch performance server-side.
--
-- Safe to run multiple times.
-- Prerequisite: docs/admin-dashboard-summary-rpc.sql

create or replace function public.admin_branch_filter_matches(
  p_branch_uuid text default null,
  p_branch_name text default null,
  p_order_branch_uuid text default null,
  p_order_branch_name text default null
)
returns boolean
language sql
stable
as $$
  select case
    when coalesce(trim(p_branch_uuid), '') = ''
      and coalesce(trim(p_branch_name), '') = ''
      then true
    when coalesce(trim(p_branch_uuid), '') <> ''
      and coalesce(trim(p_order_branch_uuid), '') = coalesce(trim(p_branch_uuid), '')
      then true
    when coalesce(trim(p_branch_name), '') <> ''
      and public.normalize_order_counting_status(p_order_branch_name)
        = public.normalize_order_counting_status(p_branch_name)
      then true
    else false
  end;
$$;

drop function if exists public.get_admin_business_analytics(timestamptz, timestamptz);
drop function if exists public.get_admin_business_analytics(timestamptz, timestamptz, text);
drop function if exists public.get_admin_business_analytics(timestamptz, timestamptz, text, text);

create or replace function public.get_admin_business_analytics(
  p_date_from timestamptz,
  p_date_to timestamptz,
  p_branch_name text default null,
  p_branch_uuid text default null
)
returns table(
  finance_summary jsonb,
  top_products_by_quantity jsonb,
  top_products_by_revenue jsonb,
  slow_products_30_days jsonb,
  hourly_revenue jsonb,
  branch_performance jsonb,
  channel_finance jsonb
)
language sql
stable
security invoker
as $$
with bounds as (
  select
    p_date_from as date_from,
    p_date_to as date_to,
    p_date_to - interval '30 days' as slow_from
),
web_orders as materialized (
  select
    o.id::text as order_id,
    o.created_at as order_time,
    coalesce(o.delivery_branch_uuid::text, o.pickup_branch_uuid::text, o.branch_uuid::text, '') as branch_uuid,
    coalesce(
      nullif(trim(o.delivery_branch_name), ''),
      nullif(trim(o.pickup_branch_name), ''),
      nullif(trim(o.branch_name), ''),
      'Chưa xác định'
    ) as branch_name,
    'owned'::text as channel_group,
    case
      when public.normalize_order_counting_status(o.status) in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
        then false
      else true
    end as is_valid,
    greatest(coalesce(o.total_amount, 0)::numeric, 0) as gross_revenue,
    greatest(coalesce(o.total_amount, 0)::numeric - coalesce(o.shipping_fee, 0)::numeric, 0) as net_revenue,
    greatest(coalesce(o.promo_discount, 0)::numeric + coalesce(o.points_discount, 0)::numeric, 0) as discount_amount,
    greatest(coalesce(o.promo_discount, 0)::numeric, 0) as voucher_amount,
    0::numeric as platform_fee
  from public.orders o
  cross join bounds b
  where o.created_at >= least(b.date_from, b.slow_from)
    and o.created_at < b.date_to
    and (
      (
        coalesce(trim(p_branch_uuid), '') = ''
        and coalesce(trim(p_branch_name), '') = ''
      )
      or public.admin_branch_filter_matches(
        p_branch_uuid,
        p_branch_name,
        coalesce(o.delivery_branch_uuid::text, o.pickup_branch_uuid::text, o.branch_uuid::text, ''),
        coalesce(
          nullif(trim(o.delivery_branch_name), ''),
          nullif(trim(o.pickup_branch_name), ''),
          nullif(trim(o.branch_name), ''),
          'Chưa xác định'
        )
      )
    )
),
partner_orders as materialized (
  select
    po.id::text as order_id,
    coalesce(po.order_time, po.created_at) as order_time,
    coalesce(po.branch_uuid::text, po.raw_data ->> 'branch_uuid', '') as branch_uuid,
    coalesce(
      nullif(trim(po.branch_name), ''),
      nullif(trim(po.nexpos_site_name), ''),
      nullif(trim(po.nexpos_hub_name), ''),
      'Chưa xác định'
    ) as branch_name,
    'partner'::text as channel_group,
    case
      when public.normalize_order_counting_status(po.order_status) in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
        or public.normalize_order_counting_status(po.nexpos_status) in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
        or public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
        then false
      else true
    end as is_valid,
    greatest(
      coalesce(
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,original_price}'),
        coalesce(po.subtotal, 0)::numeric,
        coalesce(po.total_amount, 0)::numeric
      ),
      0
    ) as gross_revenue,
    greatest(
      coalesce(
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,real_received}'),
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,net_received}'),
        public.dashboard_to_numeric(po.raw_data ->> 'total_for_biz'),
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,gross_received}'),
        coalesce(po.total_amount, 0)::numeric - coalesce(po.shipping_fee, 0)::numeric
      ),
      0
    ) as net_revenue,
    greatest(
      coalesce(
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,total_promotion_price}'),
        coalesce(po.discount_amount, 0)::numeric
      ),
      0
    ) as discount_amount,
    greatest(
      coalesce(
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,other_promotion_price}'),
        coalesce(po.discount_amount, 0)::numeric
      ),
      0
    ) as voucher_amount,
    greatest(
      coalesce(
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,platform_fee}'),
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,commission_fee}'),
        public.dashboard_to_numeric(po.raw_data #>> '{finance_data,service_fee}'),
        0
      ),
      0
    ) as platform_fee
  from public.partner_orders po
  cross join bounds b
  where coalesce(po.order_time, po.created_at) >= least(b.date_from, b.slow_from)
    and coalesce(po.order_time, po.created_at) < b.date_to
    and (
      (
        coalesce(trim(p_branch_uuid), '') = ''
        and coalesce(trim(p_branch_name), '') = ''
      )
      or public.admin_branch_filter_matches(
        p_branch_uuid,
        p_branch_name,
        coalesce(po.branch_uuid::text, po.raw_data ->> 'branch_uuid', ''),
        coalesce(
          nullif(trim(po.branch_name), ''),
          nullif(trim(po.nexpos_site_name), ''),
          nullif(trim(po.nexpos_hub_name), ''),
          'Chưa xác định'
        )
      )
    )
),
all_orders as materialized (
  select * from web_orders
  union all
  select * from partner_orders
),
current_orders as materialized (
  select o.*
  from all_orders o
  cross join bounds b
  where o.is_valid
    and o.order_time >= b.date_from
    and o.order_time < b.date_to
),
web_product_sales as (
  select
    coalesce(nullif(trim(oi.product_name), ''), 'Món chưa đặt tên') as product_name,
    coalesce(
      sum(greatest(coalesce(oi.quantity, 0), 0)::numeric)
        filter (where o.order_time >= b.date_from),
      0
    )::numeric as current_quantity,
    coalesce(
      sum(greatest(coalesce(oi.line_total, oi.unit_price * oi.quantity, 0), 0)::numeric)
        filter (where o.order_time >= b.date_from),
      0
    )::numeric as current_revenue,
    coalesce(sum(greatest(coalesce(oi.quantity, 0), 0)::numeric), 0)::numeric as slow_quantity,
    coalesce(
      sum(greatest(coalesce(oi.line_total, oi.unit_price * oi.quantity, 0), 0)::numeric),
      0
    )::numeric as slow_revenue
  from public.order_items oi
  join web_orders o
    on o.order_id = oi.order_id::text
  cross join bounds b
  where o.is_valid
  group by coalesce(nullif(trim(oi.product_name), ''), 'Món chưa đặt tên')
),
partner_product_sales as (
  select
    coalesce(
      nullif(trim(poi.web_product_name), ''),
      nullif(trim(poi.partner_item_name), ''),
      'Món chưa đặt tên'
    ) as product_name,
    coalesce(
      sum(greatest(coalesce(poi.quantity, 0), 0)::numeric)
        filter (where o.order_time >= b.date_from),
      0
    )::numeric as current_quantity,
    coalesce(
      sum(greatest(coalesce(poi.line_total, poi.unit_price * poi.quantity, 0), 0)::numeric)
        filter (where o.order_time >= b.date_from),
      0
    )::numeric as current_revenue,
    coalesce(sum(greatest(coalesce(poi.quantity, 0), 0)::numeric), 0)::numeric as slow_quantity,
    coalesce(
      sum(greatest(coalesce(poi.line_total, poi.unit_price * poi.quantity, 0), 0)::numeric),
      0
    )::numeric as slow_revenue
  from public.partner_order_items poi
  join partner_orders o
    on o.order_id = poi.partner_order_id::text
  cross join bounds b
  where o.is_valid
  group by coalesce(
    nullif(trim(poi.web_product_name), ''),
    nullif(trim(poi.partner_item_name), ''),
    'Món chưa đặt tên'
  )
),
product_sales_by_source as (
  select * from web_product_sales
  union all
  select * from partner_product_sales
),
product_sales as (
  select
    product_name,
    coalesce(sum(current_quantity), 0)::numeric as current_quantity,
    coalesce(sum(current_revenue), 0)::numeric as current_revenue,
    coalesce(sum(slow_quantity), 0)::numeric as slow_quantity,
    coalesce(sum(slow_revenue), 0)::numeric as slow_revenue
  from product_sales_by_source
  group by product_name
),
current_product_sales as (
  select
    product_name,
    current_quantity as quantity,
    current_revenue as revenue
  from product_sales
  where current_quantity > 0
),
slow_product_sales as (
  select
    product_name,
    slow_quantity as quantity,
    slow_revenue as revenue
  from product_sales
  where slow_quantity > 0
    and slow_revenue > 0
    and lower(product_name) not like '%test%'
    and lower(product_name) not like '%không làm%'
    and lower(product_name) not like '%tặng kèm%'
    and lower(product_name) not like '%miễn phí%'
    and lower(product_name) not like '%nội bộ%'
),
hourly as (
  select
    extract(hour from order_time at time zone 'Asia/Ho_Chi_Minh')::integer as hour_of_day,
    count(*)::integer as total_orders,
    coalesce(sum(net_revenue), 0)::numeric as net_revenue
  from current_orders
  group by extract(hour from order_time at time zone 'Asia/Ho_Chi_Minh')
),
branches as (
  select
    branch_uuid,
    branch_name,
    count(*)::integer as total_orders,
    coalesce(sum(gross_revenue), 0)::numeric as gross_revenue,
    coalesce(sum(net_revenue), 0)::numeric as net_revenue,
    case when count(*) > 0 then coalesce(sum(net_revenue), 0)::numeric / count(*) else 0 end as average_order_value
  from current_orders
  group by branch_uuid, branch_name
),
channel_totals as (
  select
    channel_group,
    count(*)::integer as total_orders,
    coalesce(sum(gross_revenue), 0)::numeric as gross_revenue,
    coalesce(sum(discount_amount), 0)::numeric as promotion_amount,
    greatest(
      coalesce(sum(platform_fee), 0),
      coalesce(sum(gross_revenue), 0) - coalesce(sum(discount_amount), 0) - coalesce(sum(net_revenue), 0),
      0
    )::numeric as platform_fee,
    coalesce(sum(net_revenue), 0)::numeric as net_revenue
  from current_orders
  group by channel_group
)
select
  jsonb_build_object(
    'total_orders', count(*)::integer,
    'gross_revenue', coalesce(sum(gross_revenue), 0)::numeric,
    'net_revenue', coalesce(sum(net_revenue), 0)::numeric,
    'discount_amount', coalesce(sum(discount_amount), 0)::numeric,
    'voucher_amount', coalesce(sum(voucher_amount), 0)::numeric,
    'platform_fee', coalesce(sum(platform_fee), 0)::numeric,
    'revenue_gap', greatest(coalesce(sum(gross_revenue), 0)::numeric - coalesce(sum(net_revenue), 0)::numeric, 0)
  ) as finance_summary,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object('name', product_name, 'quantity', quantity, 'revenue', revenue) order by quantity desc, revenue desc, product_name)
      from (select * from current_product_sales order by quantity desc, revenue desc, product_name limit 8) ranked
    ),
    '[]'::jsonb
  ) as top_products_by_quantity,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object('name', product_name, 'quantity', quantity, 'revenue', revenue) order by revenue desc, quantity desc, product_name)
      from (select * from current_product_sales order by revenue desc, quantity desc, product_name limit 8) ranked
    ),
    '[]'::jsonb
  ) as top_products_by_revenue,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object('name', product_name, 'quantity', quantity, 'revenue', revenue) order by quantity asc, revenue asc, product_name)
      from (select * from slow_product_sales order by quantity asc, revenue asc, product_name limit 8) ranked
    ),
    '[]'::jsonb
  ) as slow_products_30_days,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object('hour', hour_of_day, 'total_orders', total_orders, 'net_revenue', net_revenue) order by hour_of_day)
      from hourly
    ),
    '[]'::jsonb
  ) as hourly_revenue,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'branch_uuid', branch_uuid,
          'branch_name', branch_name,
          'total_orders', total_orders,
          'gross_revenue', gross_revenue,
          'net_revenue', net_revenue,
          'average_order_value', average_order_value
        )
        order by net_revenue desc, total_orders desc, branch_name
      )
      from branches
    ),
    '[]'::jsonb
  ) as branch_performance,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'group', channel_group,
          'total_orders', total_orders,
          'gross_revenue', gross_revenue,
          'promotion_amount', promotion_amount,
          'platform_fee', platform_fee,
          'net_revenue', net_revenue
        )
        order by channel_group
      )
      from channel_totals
    ),
    '[]'::jsonb
  ) as channel_finance
from current_orders;
$$;

grant execute on function public.admin_branch_filter_matches(text, text, text, text) to anon, authenticated;
grant execute on function public.get_admin_business_analytics(timestamptz, timestamptz, text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- Verification query: Vietnam-local current month.
select *
from public.get_admin_business_analytics(
  date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh',
  (date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') + interval '1 day') at time zone 'Asia/Ho_Chi_Minh',
  null,
  null
);
