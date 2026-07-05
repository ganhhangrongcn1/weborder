-- Customer Home - popular products RPC
-- Goal:
-- 1. Rank catalog products by quantity sold in the latest 30 days.
-- 2. Combine website orders with partner items already mapped by web_product_id.
-- 3. Expose only product IDs and ranking; never expose order, customer or revenue data.
-- 4. Keep Home to one RPC request and allow the frontend to cache the result.
--
-- Safe to run multiple times.
-- Prerequisite: docs/supabase-sql/customer-order-counting-rpc.sql

create index if not exists partner_orders_customer_popular_order_time_idx
on public.partner_orders ((coalesce(order_time, created_at)) desc);

create index if not exists order_items_order_id_product_id_idx
on public.order_items (order_id, product_id)
where product_id is not null;

create index if not exists partner_order_items_order_id_web_product_id_idx
on public.partner_order_items (partner_order_id, web_product_id)
where web_product_id is not null;

create or replace function public.get_customer_popular_products(
  p_days integer default 30,
  p_limit integer default 12
)
returns table(
  product_id text,
  sales_rank integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with settings as (
    select
      now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 90))) as date_from,
      greatest(1, least(coalesce(p_limit, 12), 50)) as result_limit
  ),
  web_sales as (
    select
      trim(oi.product_id::text) as product_id,
      sum(greatest(coalesce(oi.quantity, 0), 0))::bigint as units_sold
    from public.orders o
    join public.order_items oi
      on oi.order_id = o.id
    cross join settings s
    where o.created_at >= s.date_from
      and coalesce(trim(oi.product_id::text), '') <> ''
      and public.normalize_order_counting_status(o.status) not in (
        'cancel',
        'canceled',
        'cancelled',
        'huy',
        'dahuy',
        'refunded',
        'preorder',
        'preordered',
        'scheduled',
        'dattruoc'
      )
    group by trim(oi.product_id::text)
  ),
  partner_sales as (
    select
      trim(poi.web_product_id::text) as product_id,
      sum(greatest(coalesce(poi.quantity, 0), 0))::bigint as units_sold
    from public.partner_orders po
    join public.partner_order_items poi
      on poi.partner_order_id = po.id
    cross join settings s
    where coalesce(po.order_time, po.created_at) >= s.date_from
      and coalesce(trim(poi.web_product_id::text), '') <> ''
      and public.normalize_order_counting_status(po.order_status) not in (
        'cancel',
        'canceled',
        'cancelled',
        'huy',
        'dahuy',
        'refunded',
        'preorder',
        'preordered',
        'scheduled',
        'dattruoc'
      )
      and public.normalize_order_counting_status(po.nexpos_status) not in (
        'cancel',
        'canceled',
        'cancelled',
        'huy',
        'dahuy',
        'refunded',
        'preorder',
        'preordered',
        'scheduled',
        'dattruoc'
      )
      and public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) not in (
        'cancel',
        'canceled',
        'cancelled',
        'huy',
        'dahuy',
        'refunded',
        'preorder',
        'preordered',
        'scheduled',
        'dattruoc'
      )
    group by trim(poi.web_product_id::text)
  ),
  combined_sales as (
    select product_id, units_sold from web_sales
    union all
    select product_id, units_sold from partner_sales
  ),
  ranked_sales as (
    select
      sales.product_id,
      sum(sales.units_sold)::bigint as units_sold
    from combined_sales sales
    where exists (
      select 1
      from public.products p
      where p.id::text = sales.product_id
    )
    group by sales.product_id
  )
  select
    ranked.product_id,
    row_number() over (
      order by ranked.units_sold desc, ranked.product_id
    )::integer as sales_rank
  from ranked_sales ranked
  order by ranked.units_sold desc, ranked.product_id
  limit (select result_limit from settings);
$$;

comment on function public.get_customer_popular_products(integer, integer)
is 'Returns catalog product IDs ranked by sales across valid website and mapped partner orders.';

revoke all on function public.get_customer_popular_products(integer, integer) from public;
grant execute on function public.get_customer_popular_products(integer, integer) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- Verification:
select *
from public.get_customer_popular_products(30, 12);

select
  has_function_privilege(
    'anon',
    'public.get_customer_popular_products(integer, integer)',
    'execute'
  ) as anon_can_execute,
  has_function_privilege(
    'authenticated',
    'public.get_customer_popular_products(integer, integer)',
    'execute'
  ) as authenticated_can_execute;
