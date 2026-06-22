-- Read-only audit for Loyalty Phase 2 partner settlement amounts.

begin transaction read only;

select
  count(*)::bigint as total_partner_orders,
  count(*) filter (where net_received_amount > 0)::bigint as has_net_received,
  count(*) filter (where net_received_amount is null)::bigint as missing_net_received,
  count(*) filter (
    where loyalty_hold_reason = 'missing_partner_net_received'
  )::bigint as held_for_reconciliation,
  count(*) filter (
    where net_received_amount is null
      and coalesce(expected_earn_points, 0) > 0
  )::bigint as invalid_missing_amount_with_points
from public.partner_orders;

select
  partner_source,
  count(*)::bigint as total_orders,
  count(*) filter (where net_received_amount > 0)::bigint as has_net_received,
  count(*) filter (where net_received_amount is null)::bigint as missing_net_received
from public.partner_orders
group by partner_source
order by total_orders desc, partner_source;

select
  id,
  partner_source,
  order_code,
  order_time,
  total_amount,
  net_received_amount,
  points_base_amount,
  expected_earn_points,
  point_status,
  loyalty_hold_reason
from public.partner_orders
where net_received_amount is null
order by order_time desc nulls last
limit 100;

select
  po.id,
  po.partner_source,
  po.order_code,
  po.net_received_amount,
  po.points_base_amount,
  po.expected_earn_points,
  ll.points as ledger_points,
  ll.created_at as ledger_created_at
from public.partner_orders po
join public.loyalty_ledger ll
  on ll.source_type = 'PARTNER_ORDER'
 and ll.source_order_id = po.id::text
 and ll.action = 'CLAIM_PARTNER_EARN'
where po.net_received_amount is null
order by ll.created_at desc
limit 100;

rollback;
