-- Supabase production resource optimization.
-- Safe to run multiple times.
-- Supports hot RPC, kitchen, and branch-scoped read paths.

create index if not exists loyalty_ledger_customer_phone_idx
on public.loyalty_ledger (customer_phone);

drop index if exists public.orders_created_at_branch_uuid_idx;
drop index if exists public.orders_created_at_pickup_branch_uuid_idx;
drop index if exists public.orders_created_at_delivery_branch_uuid_idx;
drop index if exists public.partner_orders_order_time_branch_uuid_idx;

create index if not exists orders_branch_uuid_created_at_idx
on public.orders (branch_uuid, created_at desc)
where branch_uuid is not null;

create index if not exists orders_pickup_branch_uuid_created_at_idx
on public.orders (pickup_branch_uuid, created_at desc)
where pickup_branch_uuid is not null;

create index if not exists orders_delivery_branch_uuid_created_at_idx
on public.orders (delivery_branch_uuid, created_at desc)
where delivery_branch_uuid is not null;

create index if not exists partner_orders_branch_uuid_order_time_idx
on public.partner_orders (branch_uuid, order_time desc)
where branch_uuid is not null;

analyze public.loyalty_ledger;
analyze public.orders;
analyze public.order_items;
analyze public.partner_orders;
analyze public.partner_order_items;

-- Verification
select
  schemaname,
  tablename,
  indexname
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'loyalty_ledger_customer_phone_idx',
    'orders_branch_uuid_created_at_idx',
    'orders_pickup_branch_uuid_created_at_idx',
    'orders_delivery_branch_uuid_created_at_idx',
    'partner_orders_branch_uuid_order_time_idx'
  )
order by indexname;
