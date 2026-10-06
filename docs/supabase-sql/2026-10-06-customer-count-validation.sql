begin read only; set local statement_timeout='5s'; with fixture_orders as materialized (
select 'test-'||i id, 'CODE-'||i order_code,
(case when i%5=0 then '+84900000000' when i%3=0 then '0900000000' else '0910000000' end)::text customer_phone,
(i*113)::numeric total_amount, (array['done','cancelled','Đã hủy','preorder','served',null,'pending'])[1+i%7] status,
case when i%4=0 then 20 else 0 end points_earned
from generate_series(1,500) i),
fixture_partner_orders as materialized (
select md5(i::text)::uuid id, 'P-'||i order_code,
(case when i%3=0 then '0900000000' when i%4=0 then null else '0910000000' end)::text customer_phone_key,
(case when i%5=0 then '+84900000000' when i%7=0 then '0900000000' else null end)::text customer_phone,
(i*197)::numeric total_amount,case when i%6=0 then null else (i*139)::numeric end net_received_amount,
(array['claimed','pending','rejected','expired',null])[1+i%5] point_status,
(array['done','cancelled','Đã hủy','preorder','served',null,'pending'])[1+i%7] order_status,
(array['done','cancelled',null])[1+i%3] nexpos_status,
jsonb_build_object('status',(array['done','scheduled',null])[1+i%3]) raw_data,
now()-make_interval(days=>i%12) order_time,now()-make_interval(days=>i%13) created_at
from generate_series(1,500) i),
fixture_ledger as materialized (
select '0900000000'::text customer_phone, (array['ORDER_EARN','PARTNER_ORDER_EARN','CHECKIN'])[1+i%3] entry_type,
case when i%4=0 then -5 else 7 end points,
case when i%2=0 then 'test-'||i else 'CODE-'||i end order_id,
md5(i::text)::uuid partner_order_id, 'P-'||i partner_order_code from generate_series(1,60) i) select 1 test_case, (select to_jsonb(x) from (with rule as (
  select
    coalesce(currency_per_point, 100)::numeric as currency_per_point,
    coalesce(point_per_unit, 1)::numeric as point_per_unit
  from (select 100::numeric currency_per_point, 1::numeric point_per_unit) fixture_rule
),
identity as (
  select
    public.normalize_vietnam_phone('0900000000') as customer_phone,
    public.get_customer_phone_variants('0900000000') as phone_variants
),
ledger as (
  select
    coalesce(sum(case when entry_type in ('ORDER_EARN', 'PARTNER_ORDER_EARN') then points else 0 end), 0)::integer as ledger_claimed_points,
    array_remove(array_agg(distinct nullif(trim(order_id), '')), null) as claimed_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_id::text), '')), null) as claimed_partner_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_code), '')), null) as claimed_partner_order_codes
  from fixture_ledger ll
  cross join identity i
  where ll.customer_phone = any(i.phone_variants)
),
web_orders as (
  select
    o.id::text as order_identity,
    trim(coalesce(o.order_code, '')) as order_code,
    coalesce(o.total_amount, 0)::numeric as total_amount,
    public.normalize_order_counting_status(o.status) as status_key,
    greatest(
      0,
      coalesce(
        nullif(o.points_earned, 0),
        floor((coalesce(o.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)
      )
    )::integer as earned_points
  from fixture_orders o
  cross join identity i
  cross join rule r
  where o.customer_phone = any(i.phone_variants)
),
valid_web_orders as (
  select *
  from web_orders
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(po.net_received_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) as raw_status_key,
    coalesce(po.order_time, po.created_at) as order_created_at,
    floor((coalesce(po.net_received_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from fixture_partner_orders po
  cross join identity i
  cross join rule r
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
web_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when status_key in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
          and order_identity <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
          and order_code <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
        then earned_points
        else 0
      end
    ), 0)::integer as pending_points
  from valid_web_orders
),
partner_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when point_status_key = 'claimed'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as claimed_points,
    coalesce(sum(
      case
        when point_status_key not in ('claimed', 'rejected', 'expired')
          and order_created_at is not null
          and now() < order_created_at + interval '7 days'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as pending_points
  from valid_partner_orders
)
select
  i.customer_phone,
  coalesce(ws.total_orders, 0) + coalesce(ps.total_orders, 0) as total_orders,
  coalesce(ws.total_spent, 0) + coalesce(ps.total_spent, 0) as total_spent,
  coalesce(l.ledger_claimed_points, 0) + coalesce(ps.claimed_points, 0) as claimed_points,
  coalesce(ws.pending_points, 0) + coalesce(ps.pending_points, 0) as pending_points
from identity i
left join ledger l on true
left join web_summary ws on true
left join partner_summary ps on true) x) is not distinct from (select to_jsonb(x) from (with rule as (
  select
    coalesce(currency_per_point, 100)::numeric as currency_per_point,
    coalesce(point_per_unit, 1)::numeric as point_per_unit
  from (select 100::numeric currency_per_point, 1::numeric point_per_unit) fixture_rule
),
identity as (
  select
    public.normalize_vietnam_phone('0900000000') as customer_phone,
    public.get_customer_phone_variants('0900000000') as phone_variants
),
ledger as (
  select
    coalesce(sum(case when entry_type in ('ORDER_EARN', 'PARTNER_ORDER_EARN') then points else 0 end), 0)::integer as ledger_claimed_points,
    array_remove(array_agg(distinct nullif(trim(order_id), '')), null) as claimed_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_id::text), '')), null) as claimed_partner_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_code), '')), null) as claimed_partner_order_codes
  from fixture_ledger ll
  cross join identity i
  where ll.customer_phone = any(i.phone_variants)
),
web_orders as (
  select
    o.id::text as order_identity,
    trim(coalesce(o.order_code, '')) as order_code,
    coalesce(o.total_amount, 0)::numeric as total_amount,
    public.normalize_order_counting_status(o.status) as status_key,
    greatest(
      0,
      coalesce(
        nullif(o.points_earned, 0),
        floor((coalesce(o.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)
      )
    )::integer as earned_points
  from fixture_orders o
  cross join identity i
  cross join rule r
  where o.customer_phone = any(i.phone_variants)
),
valid_web_orders as (
  select *
  from web_orders
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
matched_partner_orders as materialized (
  select po.id, po.order_code, po.total_amount, po.net_received_amount,
    po.point_status, po.order_status, po.nexpos_status,
    po.raw_data ->> 'status' as raw_status,
    po.order_time, po.created_at
  from fixture_partner_orders po
  cross join identity i
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(po.net_received_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_status, '')) as raw_status_key,
    coalesce(po.order_time, po.created_at) as order_created_at,
    floor((coalesce(po.net_received_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from matched_partner_orders po
  cross join rule r
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
web_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when status_key in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
          and order_identity <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
          and order_code <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
        then earned_points
        else 0
      end
    ), 0)::integer as pending_points
  from valid_web_orders
),
partner_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when point_status_key = 'claimed'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as claimed_points,
    coalesce(sum(
      case
        when point_status_key not in ('claimed', 'rejected', 'expired')
          and order_created_at is not null
          and now() < order_created_at + interval '7 days'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as pending_points
  from valid_partner_orders
)
select
  i.customer_phone,
  coalesce(ws.total_orders, 0) + coalesce(ps.total_orders, 0) as total_orders,
  coalesce(ws.total_spent, 0) + coalesce(ps.total_spent, 0) as total_spent,
  coalesce(l.ledger_claimed_points, 0) + coalesce(ps.claimed_points, 0) as claimed_points,
  coalesce(ws.pending_points, 0) + coalesce(ps.pending_points, 0) as pending_points
from identity i
left join ledger l on true
left join web_summary ws on true
left join partner_summary ps on true) x) outputs_equal union all select 2 test_case, (select to_jsonb(x) from (with rule as (
  select
    coalesce(currency_per_point, 100)::numeric as currency_per_point,
    coalesce(point_per_unit, 1)::numeric as point_per_unit
  from (select 100::numeric currency_per_point, 1::numeric point_per_unit) fixture_rule
),
identity as (
  select
    public.normalize_vietnam_phone('+84900000000') as customer_phone,
    public.get_customer_phone_variants('+84900000000') as phone_variants
),
ledger as (
  select
    coalesce(sum(case when entry_type in ('ORDER_EARN', 'PARTNER_ORDER_EARN') then points else 0 end), 0)::integer as ledger_claimed_points,
    array_remove(array_agg(distinct nullif(trim(order_id), '')), null) as claimed_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_id::text), '')), null) as claimed_partner_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_code), '')), null) as claimed_partner_order_codes
  from fixture_ledger ll
  cross join identity i
  where ll.customer_phone = any(i.phone_variants)
),
web_orders as (
  select
    o.id::text as order_identity,
    trim(coalesce(o.order_code, '')) as order_code,
    coalesce(o.total_amount, 0)::numeric as total_amount,
    public.normalize_order_counting_status(o.status) as status_key,
    greatest(
      0,
      coalesce(
        nullif(o.points_earned, 0),
        floor((coalesce(o.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)
      )
    )::integer as earned_points
  from fixture_orders o
  cross join identity i
  cross join rule r
  where o.customer_phone = any(i.phone_variants)
),
valid_web_orders as (
  select *
  from web_orders
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(po.net_received_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) as raw_status_key,
    coalesce(po.order_time, po.created_at) as order_created_at,
    floor((coalesce(po.net_received_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from fixture_partner_orders po
  cross join identity i
  cross join rule r
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
web_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when status_key in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
          and order_identity <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
          and order_code <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
        then earned_points
        else 0
      end
    ), 0)::integer as pending_points
  from valid_web_orders
),
partner_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when point_status_key = 'claimed'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as claimed_points,
    coalesce(sum(
      case
        when point_status_key not in ('claimed', 'rejected', 'expired')
          and order_created_at is not null
          and now() < order_created_at + interval '7 days'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as pending_points
  from valid_partner_orders
)
select
  i.customer_phone,
  coalesce(ws.total_orders, 0) + coalesce(ps.total_orders, 0) as total_orders,
  coalesce(ws.total_spent, 0) + coalesce(ps.total_spent, 0) as total_spent,
  coalesce(l.ledger_claimed_points, 0) + coalesce(ps.claimed_points, 0) as claimed_points,
  coalesce(ws.pending_points, 0) + coalesce(ps.pending_points, 0) as pending_points
from identity i
left join ledger l on true
left join web_summary ws on true
left join partner_summary ps on true) x) is not distinct from (select to_jsonb(x) from (with rule as (
  select
    coalesce(currency_per_point, 100)::numeric as currency_per_point,
    coalesce(point_per_unit, 1)::numeric as point_per_unit
  from (select 100::numeric currency_per_point, 1::numeric point_per_unit) fixture_rule
),
identity as (
  select
    public.normalize_vietnam_phone('+84900000000') as customer_phone,
    public.get_customer_phone_variants('+84900000000') as phone_variants
),
ledger as (
  select
    coalesce(sum(case when entry_type in ('ORDER_EARN', 'PARTNER_ORDER_EARN') then points else 0 end), 0)::integer as ledger_claimed_points,
    array_remove(array_agg(distinct nullif(trim(order_id), '')), null) as claimed_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_id::text), '')), null) as claimed_partner_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_code), '')), null) as claimed_partner_order_codes
  from fixture_ledger ll
  cross join identity i
  where ll.customer_phone = any(i.phone_variants)
),
web_orders as (
  select
    o.id::text as order_identity,
    trim(coalesce(o.order_code, '')) as order_code,
    coalesce(o.total_amount, 0)::numeric as total_amount,
    public.normalize_order_counting_status(o.status) as status_key,
    greatest(
      0,
      coalesce(
        nullif(o.points_earned, 0),
        floor((coalesce(o.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)
      )
    )::integer as earned_points
  from fixture_orders o
  cross join identity i
  cross join rule r
  where o.customer_phone = any(i.phone_variants)
),
valid_web_orders as (
  select *
  from web_orders
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
matched_partner_orders as materialized (
  select po.id, po.order_code, po.total_amount, po.net_received_amount,
    po.point_status, po.order_status, po.nexpos_status,
    po.raw_data ->> 'status' as raw_status,
    po.order_time, po.created_at
  from fixture_partner_orders po
  cross join identity i
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(po.net_received_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_status, '')) as raw_status_key,
    coalesce(po.order_time, po.created_at) as order_created_at,
    floor((coalesce(po.net_received_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from matched_partner_orders po
  cross join rule r
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
web_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when status_key in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
          and order_identity <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
          and order_code <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
        then earned_points
        else 0
      end
    ), 0)::integer as pending_points
  from valid_web_orders
),
partner_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when point_status_key = 'claimed'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as claimed_points,
    coalesce(sum(
      case
        when point_status_key not in ('claimed', 'rejected', 'expired')
          and order_created_at is not null
          and now() < order_created_at + interval '7 days'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as pending_points
  from valid_partner_orders
)
select
  i.customer_phone,
  coalesce(ws.total_orders, 0) + coalesce(ps.total_orders, 0) as total_orders,
  coalesce(ws.total_spent, 0) + coalesce(ps.total_spent, 0) as total_spent,
  coalesce(l.ledger_claimed_points, 0) + coalesce(ps.claimed_points, 0) as claimed_points,
  coalesce(ws.pending_points, 0) + coalesce(ps.pending_points, 0) as pending_points
from identity i
left join ledger l on true
left join web_summary ws on true
left join partner_summary ps on true) x) outputs_equal union all select 3 test_case, (select to_jsonb(x) from (with rule as (
  select
    coalesce(currency_per_point, 100)::numeric as currency_per_point,
    coalesce(point_per_unit, 1)::numeric as point_per_unit
  from (select 100::numeric currency_per_point, 1::numeric point_per_unit) fixture_rule
),
identity as (
  select
    public.normalize_vietnam_phone('84900000000') as customer_phone,
    public.get_customer_phone_variants('84900000000') as phone_variants
),
ledger as (
  select
    coalesce(sum(case when entry_type in ('ORDER_EARN', 'PARTNER_ORDER_EARN') then points else 0 end), 0)::integer as ledger_claimed_points,
    array_remove(array_agg(distinct nullif(trim(order_id), '')), null) as claimed_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_id::text), '')), null) as claimed_partner_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_code), '')), null) as claimed_partner_order_codes
  from fixture_ledger ll
  cross join identity i
  where ll.customer_phone = any(i.phone_variants)
),
web_orders as (
  select
    o.id::text as order_identity,
    trim(coalesce(o.order_code, '')) as order_code,
    coalesce(o.total_amount, 0)::numeric as total_amount,
    public.normalize_order_counting_status(o.status) as status_key,
    greatest(
      0,
      coalesce(
        nullif(o.points_earned, 0),
        floor((coalesce(o.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)
      )
    )::integer as earned_points
  from fixture_orders o
  cross join identity i
  cross join rule r
  where o.customer_phone = any(i.phone_variants)
),
valid_web_orders as (
  select *
  from web_orders
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(po.net_received_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) as raw_status_key,
    coalesce(po.order_time, po.created_at) as order_created_at,
    floor((coalesce(po.net_received_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from fixture_partner_orders po
  cross join identity i
  cross join rule r
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
web_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when status_key in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
          and order_identity <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
          and order_code <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
        then earned_points
        else 0
      end
    ), 0)::integer as pending_points
  from valid_web_orders
),
partner_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when point_status_key = 'claimed'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as claimed_points,
    coalesce(sum(
      case
        when point_status_key not in ('claimed', 'rejected', 'expired')
          and order_created_at is not null
          and now() < order_created_at + interval '7 days'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as pending_points
  from valid_partner_orders
)
select
  i.customer_phone,
  coalesce(ws.total_orders, 0) + coalesce(ps.total_orders, 0) as total_orders,
  coalesce(ws.total_spent, 0) + coalesce(ps.total_spent, 0) as total_spent,
  coalesce(l.ledger_claimed_points, 0) + coalesce(ps.claimed_points, 0) as claimed_points,
  coalesce(ws.pending_points, 0) + coalesce(ps.pending_points, 0) as pending_points
from identity i
left join ledger l on true
left join web_summary ws on true
left join partner_summary ps on true) x) is not distinct from (select to_jsonb(x) from (with rule as (
  select
    coalesce(currency_per_point, 100)::numeric as currency_per_point,
    coalesce(point_per_unit, 1)::numeric as point_per_unit
  from (select 100::numeric currency_per_point, 1::numeric point_per_unit) fixture_rule
),
identity as (
  select
    public.normalize_vietnam_phone('84900000000') as customer_phone,
    public.get_customer_phone_variants('84900000000') as phone_variants
),
ledger as (
  select
    coalesce(sum(case when entry_type in ('ORDER_EARN', 'PARTNER_ORDER_EARN') then points else 0 end), 0)::integer as ledger_claimed_points,
    array_remove(array_agg(distinct nullif(trim(order_id), '')), null) as claimed_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_id::text), '')), null) as claimed_partner_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_code), '')), null) as claimed_partner_order_codes
  from fixture_ledger ll
  cross join identity i
  where ll.customer_phone = any(i.phone_variants)
),
web_orders as (
  select
    o.id::text as order_identity,
    trim(coalesce(o.order_code, '')) as order_code,
    coalesce(o.total_amount, 0)::numeric as total_amount,
    public.normalize_order_counting_status(o.status) as status_key,
    greatest(
      0,
      coalesce(
        nullif(o.points_earned, 0),
        floor((coalesce(o.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)
      )
    )::integer as earned_points
  from fixture_orders o
  cross join identity i
  cross join rule r
  where o.customer_phone = any(i.phone_variants)
),
valid_web_orders as (
  select *
  from web_orders
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
matched_partner_orders as materialized (
  select po.id, po.order_code, po.total_amount, po.net_received_amount,
    po.point_status, po.order_status, po.nexpos_status,
    po.raw_data ->> 'status' as raw_status,
    po.order_time, po.created_at
  from fixture_partner_orders po
  cross join identity i
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(po.net_received_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_status, '')) as raw_status_key,
    coalesce(po.order_time, po.created_at) as order_created_at,
    floor((coalesce(po.net_received_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from matched_partner_orders po
  cross join rule r
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
web_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when status_key in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
          and order_identity <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
          and order_code <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
        then earned_points
        else 0
      end
    ), 0)::integer as pending_points
  from valid_web_orders
),
partner_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when point_status_key = 'claimed'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as claimed_points,
    coalesce(sum(
      case
        when point_status_key not in ('claimed', 'rejected', 'expired')
          and order_created_at is not null
          and now() < order_created_at + interval '7 days'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as pending_points
  from valid_partner_orders
)
select
  i.customer_phone,
  coalesce(ws.total_orders, 0) + coalesce(ps.total_orders, 0) as total_orders,
  coalesce(ws.total_spent, 0) + coalesce(ps.total_spent, 0) as total_spent,
  coalesce(l.ledger_claimed_points, 0) + coalesce(ps.claimed_points, 0) as claimed_points,
  coalesce(ws.pending_points, 0) + coalesce(ps.pending_points, 0) as pending_points
from identity i
left join ledger l on true
left join web_summary ws on true
left join partner_summary ps on true) x) outputs_equal union all select 4 test_case, (select to_jsonb(x) from (with rule as (
  select
    coalesce(currency_per_point, 100)::numeric as currency_per_point,
    coalesce(point_per_unit, 1)::numeric as point_per_unit
  from (select 100::numeric currency_per_point, 1::numeric point_per_unit) fixture_rule
),
identity as (
  select
    public.normalize_vietnam_phone('0910000000') as customer_phone,
    public.get_customer_phone_variants('0910000000') as phone_variants
),
ledger as (
  select
    coalesce(sum(case when entry_type in ('ORDER_EARN', 'PARTNER_ORDER_EARN') then points else 0 end), 0)::integer as ledger_claimed_points,
    array_remove(array_agg(distinct nullif(trim(order_id), '')), null) as claimed_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_id::text), '')), null) as claimed_partner_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_code), '')), null) as claimed_partner_order_codes
  from fixture_ledger ll
  cross join identity i
  where ll.customer_phone = any(i.phone_variants)
),
web_orders as (
  select
    o.id::text as order_identity,
    trim(coalesce(o.order_code, '')) as order_code,
    coalesce(o.total_amount, 0)::numeric as total_amount,
    public.normalize_order_counting_status(o.status) as status_key,
    greatest(
      0,
      coalesce(
        nullif(o.points_earned, 0),
        floor((coalesce(o.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)
      )
    )::integer as earned_points
  from fixture_orders o
  cross join identity i
  cross join rule r
  where o.customer_phone = any(i.phone_variants)
),
valid_web_orders as (
  select *
  from web_orders
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(po.net_received_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) as raw_status_key,
    coalesce(po.order_time, po.created_at) as order_created_at,
    floor((coalesce(po.net_received_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from fixture_partner_orders po
  cross join identity i
  cross join rule r
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
web_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when status_key in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
          and order_identity <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
          and order_code <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
        then earned_points
        else 0
      end
    ), 0)::integer as pending_points
  from valid_web_orders
),
partner_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when point_status_key = 'claimed'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as claimed_points,
    coalesce(sum(
      case
        when point_status_key not in ('claimed', 'rejected', 'expired')
          and order_created_at is not null
          and now() < order_created_at + interval '7 days'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as pending_points
  from valid_partner_orders
)
select
  i.customer_phone,
  coalesce(ws.total_orders, 0) + coalesce(ps.total_orders, 0) as total_orders,
  coalesce(ws.total_spent, 0) + coalesce(ps.total_spent, 0) as total_spent,
  coalesce(l.ledger_claimed_points, 0) + coalesce(ps.claimed_points, 0) as claimed_points,
  coalesce(ws.pending_points, 0) + coalesce(ps.pending_points, 0) as pending_points
from identity i
left join ledger l on true
left join web_summary ws on true
left join partner_summary ps on true) x) is not distinct from (select to_jsonb(x) from (with rule as (
  select
    coalesce(currency_per_point, 100)::numeric as currency_per_point,
    coalesce(point_per_unit, 1)::numeric as point_per_unit
  from (select 100::numeric currency_per_point, 1::numeric point_per_unit) fixture_rule
),
identity as (
  select
    public.normalize_vietnam_phone('0910000000') as customer_phone,
    public.get_customer_phone_variants('0910000000') as phone_variants
),
ledger as (
  select
    coalesce(sum(case when entry_type in ('ORDER_EARN', 'PARTNER_ORDER_EARN') then points else 0 end), 0)::integer as ledger_claimed_points,
    array_remove(array_agg(distinct nullif(trim(order_id), '')), null) as claimed_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_id::text), '')), null) as claimed_partner_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_code), '')), null) as claimed_partner_order_codes
  from fixture_ledger ll
  cross join identity i
  where ll.customer_phone = any(i.phone_variants)
),
web_orders as (
  select
    o.id::text as order_identity,
    trim(coalesce(o.order_code, '')) as order_code,
    coalesce(o.total_amount, 0)::numeric as total_amount,
    public.normalize_order_counting_status(o.status) as status_key,
    greatest(
      0,
      coalesce(
        nullif(o.points_earned, 0),
        floor((coalesce(o.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)
      )
    )::integer as earned_points
  from fixture_orders o
  cross join identity i
  cross join rule r
  where o.customer_phone = any(i.phone_variants)
),
valid_web_orders as (
  select *
  from web_orders
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
matched_partner_orders as materialized (
  select po.id, po.order_code, po.total_amount, po.net_received_amount,
    po.point_status, po.order_status, po.nexpos_status,
    po.raw_data ->> 'status' as raw_status,
    po.order_time, po.created_at
  from fixture_partner_orders po
  cross join identity i
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(po.net_received_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_status, '')) as raw_status_key,
    coalesce(po.order_time, po.created_at) as order_created_at,
    floor((coalesce(po.net_received_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from matched_partner_orders po
  cross join rule r
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
web_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when status_key in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
          and order_identity <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
          and order_code <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
        then earned_points
        else 0
      end
    ), 0)::integer as pending_points
  from valid_web_orders
),
partner_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when point_status_key = 'claimed'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as claimed_points,
    coalesce(sum(
      case
        when point_status_key not in ('claimed', 'rejected', 'expired')
          and order_created_at is not null
          and now() < order_created_at + interval '7 days'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as pending_points
  from valid_partner_orders
)
select
  i.customer_phone,
  coalesce(ws.total_orders, 0) + coalesce(ps.total_orders, 0) as total_orders,
  coalesce(ws.total_spent, 0) + coalesce(ps.total_spent, 0) as total_spent,
  coalesce(l.ledger_claimed_points, 0) + coalesce(ps.claimed_points, 0) as claimed_points,
  coalesce(ws.pending_points, 0) + coalesce(ps.pending_points, 0) as pending_points
from identity i
left join ledger l on true
left join web_summary ws on true
left join partner_summary ps on true) x) outputs_equal union all select 5 test_case, (select to_jsonb(x) from (with rule as (
  select
    coalesce(currency_per_point, 100)::numeric as currency_per_point,
    coalesce(point_per_unit, 1)::numeric as point_per_unit
  from (select 100::numeric currency_per_point, 1::numeric point_per_unit) fixture_rule
),
identity as (
  select
    public.normalize_vietnam_phone('') as customer_phone,
    public.get_customer_phone_variants('') as phone_variants
),
ledger as (
  select
    coalesce(sum(case when entry_type in ('ORDER_EARN', 'PARTNER_ORDER_EARN') then points else 0 end), 0)::integer as ledger_claimed_points,
    array_remove(array_agg(distinct nullif(trim(order_id), '')), null) as claimed_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_id::text), '')), null) as claimed_partner_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_code), '')), null) as claimed_partner_order_codes
  from fixture_ledger ll
  cross join identity i
  where ll.customer_phone = any(i.phone_variants)
),
web_orders as (
  select
    o.id::text as order_identity,
    trim(coalesce(o.order_code, '')) as order_code,
    coalesce(o.total_amount, 0)::numeric as total_amount,
    public.normalize_order_counting_status(o.status) as status_key,
    greatest(
      0,
      coalesce(
        nullif(o.points_earned, 0),
        floor((coalesce(o.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)
      )
    )::integer as earned_points
  from fixture_orders o
  cross join identity i
  cross join rule r
  where o.customer_phone = any(i.phone_variants)
),
valid_web_orders as (
  select *
  from web_orders
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(po.net_received_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) as raw_status_key,
    coalesce(po.order_time, po.created_at) as order_created_at,
    floor((coalesce(po.net_received_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from fixture_partner_orders po
  cross join identity i
  cross join rule r
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
web_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when status_key in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
          and order_identity <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
          and order_code <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
        then earned_points
        else 0
      end
    ), 0)::integer as pending_points
  from valid_web_orders
),
partner_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when point_status_key = 'claimed'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as claimed_points,
    coalesce(sum(
      case
        when point_status_key not in ('claimed', 'rejected', 'expired')
          and order_created_at is not null
          and now() < order_created_at + interval '7 days'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as pending_points
  from valid_partner_orders
)
select
  i.customer_phone,
  coalesce(ws.total_orders, 0) + coalesce(ps.total_orders, 0) as total_orders,
  coalesce(ws.total_spent, 0) + coalesce(ps.total_spent, 0) as total_spent,
  coalesce(l.ledger_claimed_points, 0) + coalesce(ps.claimed_points, 0) as claimed_points,
  coalesce(ws.pending_points, 0) + coalesce(ps.pending_points, 0) as pending_points
from identity i
left join ledger l on true
left join web_summary ws on true
left join partner_summary ps on true) x) is not distinct from (select to_jsonb(x) from (with rule as (
  select
    coalesce(currency_per_point, 100)::numeric as currency_per_point,
    coalesce(point_per_unit, 1)::numeric as point_per_unit
  from (select 100::numeric currency_per_point, 1::numeric point_per_unit) fixture_rule
),
identity as (
  select
    public.normalize_vietnam_phone('') as customer_phone,
    public.get_customer_phone_variants('') as phone_variants
),
ledger as (
  select
    coalesce(sum(case when entry_type in ('ORDER_EARN', 'PARTNER_ORDER_EARN') then points else 0 end), 0)::integer as ledger_claimed_points,
    array_remove(array_agg(distinct nullif(trim(order_id), '')), null) as claimed_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_id::text), '')), null) as claimed_partner_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_code), '')), null) as claimed_partner_order_codes
  from fixture_ledger ll
  cross join identity i
  where ll.customer_phone = any(i.phone_variants)
),
web_orders as (
  select
    o.id::text as order_identity,
    trim(coalesce(o.order_code, '')) as order_code,
    coalesce(o.total_amount, 0)::numeric as total_amount,
    public.normalize_order_counting_status(o.status) as status_key,
    greatest(
      0,
      coalesce(
        nullif(o.points_earned, 0),
        floor((coalesce(o.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)
      )
    )::integer as earned_points
  from fixture_orders o
  cross join identity i
  cross join rule r
  where o.customer_phone = any(i.phone_variants)
),
valid_web_orders as (
  select *
  from web_orders
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
matched_partner_orders as materialized (
  select po.id, po.order_code, po.total_amount, po.net_received_amount,
    po.point_status, po.order_status, po.nexpos_status,
    po.raw_data ->> 'status' as raw_status,
    po.order_time, po.created_at
  from fixture_partner_orders po
  cross join identity i
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(po.net_received_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_status, '')) as raw_status_key,
    coalesce(po.order_time, po.created_at) as order_created_at,
    floor((coalesce(po.net_received_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from matched_partner_orders po
  cross join rule r
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
web_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when status_key in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
          and order_identity <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
          and order_code <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
        then earned_points
        else 0
      end
    ), 0)::integer as pending_points
  from valid_web_orders
),
partner_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when point_status_key = 'claimed'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as claimed_points,
    coalesce(sum(
      case
        when point_status_key not in ('claimed', 'rejected', 'expired')
          and order_created_at is not null
          and now() < order_created_at + interval '7 days'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as pending_points
  from valid_partner_orders
)
select
  i.customer_phone,
  coalesce(ws.total_orders, 0) + coalesce(ps.total_orders, 0) as total_orders,
  coalesce(ws.total_spent, 0) + coalesce(ps.total_spent, 0) as total_spent,
  coalesce(l.ledger_claimed_points, 0) + coalesce(ps.claimed_points, 0) as claimed_points,
  coalesce(ws.pending_points, 0) + coalesce(ps.pending_points, 0) as pending_points
from identity i
left join ledger l on true
left join web_summary ws on true
left join partner_summary ps on true) x) outputs_equal union all select 6 test_case, (select to_jsonb(x) from (with rule as (
  select
    coalesce(currency_per_point, 100)::numeric as currency_per_point,
    coalesce(point_per_unit, 1)::numeric as point_per_unit
  from (select 100::numeric currency_per_point, 1::numeric point_per_unit) fixture_rule
),
identity as (
  select
    public.normalize_vietnam_phone(null) as customer_phone,
    public.get_customer_phone_variants(null) as phone_variants
),
ledger as (
  select
    coalesce(sum(case when entry_type in ('ORDER_EARN', 'PARTNER_ORDER_EARN') then points else 0 end), 0)::integer as ledger_claimed_points,
    array_remove(array_agg(distinct nullif(trim(order_id), '')), null) as claimed_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_id::text), '')), null) as claimed_partner_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_code), '')), null) as claimed_partner_order_codes
  from fixture_ledger ll
  cross join identity i
  where ll.customer_phone = any(i.phone_variants)
),
web_orders as (
  select
    o.id::text as order_identity,
    trim(coalesce(o.order_code, '')) as order_code,
    coalesce(o.total_amount, 0)::numeric as total_amount,
    public.normalize_order_counting_status(o.status) as status_key,
    greatest(
      0,
      coalesce(
        nullif(o.points_earned, 0),
        floor((coalesce(o.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)
      )
    )::integer as earned_points
  from fixture_orders o
  cross join identity i
  cross join rule r
  where o.customer_phone = any(i.phone_variants)
),
valid_web_orders as (
  select *
  from web_orders
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(po.net_received_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) as raw_status_key,
    coalesce(po.order_time, po.created_at) as order_created_at,
    floor((coalesce(po.net_received_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from fixture_partner_orders po
  cross join identity i
  cross join rule r
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
web_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when status_key in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
          and order_identity <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
          and order_code <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
        then earned_points
        else 0
      end
    ), 0)::integer as pending_points
  from valid_web_orders
),
partner_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when point_status_key = 'claimed'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as claimed_points,
    coalesce(sum(
      case
        when point_status_key not in ('claimed', 'rejected', 'expired')
          and order_created_at is not null
          and now() < order_created_at + interval '7 days'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as pending_points
  from valid_partner_orders
)
select
  i.customer_phone,
  coalesce(ws.total_orders, 0) + coalesce(ps.total_orders, 0) as total_orders,
  coalesce(ws.total_spent, 0) + coalesce(ps.total_spent, 0) as total_spent,
  coalesce(l.ledger_claimed_points, 0) + coalesce(ps.claimed_points, 0) as claimed_points,
  coalesce(ws.pending_points, 0) + coalesce(ps.pending_points, 0) as pending_points
from identity i
left join ledger l on true
left join web_summary ws on true
left join partner_summary ps on true) x) is not distinct from (select to_jsonb(x) from (with rule as (
  select
    coalesce(currency_per_point, 100)::numeric as currency_per_point,
    coalesce(point_per_unit, 1)::numeric as point_per_unit
  from (select 100::numeric currency_per_point, 1::numeric point_per_unit) fixture_rule
),
identity as (
  select
    public.normalize_vietnam_phone(null) as customer_phone,
    public.get_customer_phone_variants(null) as phone_variants
),
ledger as (
  select
    coalesce(sum(case when entry_type in ('ORDER_EARN', 'PARTNER_ORDER_EARN') then points else 0 end), 0)::integer as ledger_claimed_points,
    array_remove(array_agg(distinct nullif(trim(order_id), '')), null) as claimed_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_id::text), '')), null) as claimed_partner_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_code), '')), null) as claimed_partner_order_codes
  from fixture_ledger ll
  cross join identity i
  where ll.customer_phone = any(i.phone_variants)
),
web_orders as (
  select
    o.id::text as order_identity,
    trim(coalesce(o.order_code, '')) as order_code,
    coalesce(o.total_amount, 0)::numeric as total_amount,
    public.normalize_order_counting_status(o.status) as status_key,
    greatest(
      0,
      coalesce(
        nullif(o.points_earned, 0),
        floor((coalesce(o.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)
      )
    )::integer as earned_points
  from fixture_orders o
  cross join identity i
  cross join rule r
  where o.customer_phone = any(i.phone_variants)
),
valid_web_orders as (
  select *
  from web_orders
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
matched_partner_orders as materialized (
  select po.id, po.order_code, po.total_amount, po.net_received_amount,
    po.point_status, po.order_status, po.nexpos_status,
    po.raw_data ->> 'status' as raw_status,
    po.order_time, po.created_at
  from fixture_partner_orders po
  cross join identity i
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(po.net_received_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_status, '')) as raw_status_key,
    coalesce(po.order_time, po.created_at) as order_created_at,
    floor((coalesce(po.net_received_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from matched_partner_orders po
  cross join rule r
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
web_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when status_key in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
          and order_identity <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
          and order_code <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
        then earned_points
        else 0
      end
    ), 0)::integer as pending_points
  from valid_web_orders
),
partner_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when point_status_key = 'claimed'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as claimed_points,
    coalesce(sum(
      case
        when point_status_key not in ('claimed', 'rejected', 'expired')
          and order_created_at is not null
          and now() < order_created_at + interval '7 days'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as pending_points
  from valid_partner_orders
)
select
  i.customer_phone,
  coalesce(ws.total_orders, 0) + coalesce(ps.total_orders, 0) as total_orders,
  coalesce(ws.total_spent, 0) + coalesce(ps.total_spent, 0) as total_spent,
  coalesce(l.ledger_claimed_points, 0) + coalesce(ps.claimed_points, 0) as claimed_points,
  coalesce(ws.pending_points, 0) + coalesce(ps.pending_points, 0) as pending_points
from identity i
left join ledger l on true
left join web_summary ws on true
left join partner_summary ps on true) x) outputs_equal; rollback;
