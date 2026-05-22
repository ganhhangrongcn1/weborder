-- Dedicated kitchen work status for website and partner orders.
-- Goal:
-- 1. Keep kitchen progress separate from order_status, nexpos_status, item_status.
-- 2. Let the kitchen tick items and hide finished orders without touching partner constraints.
-- 3. Keep a temporary anon update policy until /kitchen uses email login.
--
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_ghr_staff()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.status = 'active'
      and p.role in ('admin', 'staff', 'kitchen')
      and (
        p.auth_user_id = auth.uid()
        or lower(coalesce(p.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

alter table public.orders
add column if not exists kitchen_status text not null default 'pending';

alter table public.orders
add column if not exists kitchen_done_at timestamptz;

alter table public.order_items
add column if not exists kitchen_item_status text not null default 'pending';

alter table public.order_items
add column if not exists kitchen_done_at timestamptz;

alter table public.partner_orders
add column if not exists kitchen_work_status text not null default 'pending';

alter table public.partner_orders
add column if not exists kitchen_done_at timestamptz;

alter table public.partner_order_items
add column if not exists kitchen_item_status text not null default 'pending';

alter table public.partner_order_items
add column if not exists kitchen_done_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_kitchen_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
    add constraint orders_kitchen_status_check
    check (kitchen_status in ('pending', 'done'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_kitchen_item_status_check'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
    add constraint order_items_kitchen_item_status_check
    check (kitchen_item_status in ('pending', 'done'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'partner_orders_kitchen_work_status_check'
      and conrelid = 'public.partner_orders'::regclass
  ) then
    alter table public.partner_orders
    add constraint partner_orders_kitchen_work_status_check
    check (kitchen_work_status in ('pending', 'done'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'partner_order_items_kitchen_item_status_check'
      and conrelid = 'public.partner_order_items'::regclass
  ) then
    alter table public.partner_order_items
    add constraint partner_order_items_kitchen_item_status_check
    check (kitchen_item_status in ('pending', 'done'));
  end if;
end $$;

create index if not exists orders_kitchen_status_idx
on public.orders (kitchen_status);

create index if not exists orders_kitchen_done_at_idx
on public.orders (kitchen_done_at desc);

create index if not exists order_items_kitchen_item_status_idx
on public.order_items (kitchen_item_status);

create index if not exists order_items_kitchen_done_at_idx
on public.order_items (kitchen_done_at desc);

create index if not exists partner_orders_kitchen_work_status_idx
on public.partner_orders (kitchen_work_status);

create index if not exists partner_orders_kitchen_done_at_idx
on public.partner_orders (kitchen_done_at desc);

create index if not exists partner_order_items_kitchen_item_status_idx
on public.partner_order_items (kitchen_item_status);

create index if not exists partner_order_items_kitchen_done_at_idx
on public.partner_order_items (kitchen_done_at desc);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

drop trigger if exists order_items_set_updated_at on public.order_items;
create trigger order_items_set_updated_at
before update on public.order_items
for each row
execute function public.set_updated_at();

drop trigger if exists partner_orders_set_updated_at on public.partner_orders;
create trigger partner_orders_set_updated_at
before update on public.partner_orders
for each row
execute function public.set_updated_at();

drop trigger if exists partner_order_items_set_updated_at on public.partner_order_items;
create trigger partner_order_items_set_updated_at
before update on public.partner_order_items
for each row
execute function public.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.partner_orders enable row level security;
alter table public.partner_order_items enable row level security;

grant select on public.orders to anon, authenticated;
grant select on public.order_items to anon, authenticated;
grant select on public.partner_orders to anon, authenticated;
grant select on public.partner_order_items to anon, authenticated;

grant update (kitchen_status, kitchen_done_at, updated_at) on public.orders to anon, authenticated;
grant update (kitchen_item_status, kitchen_done_at, updated_at) on public.order_items to anon, authenticated;
grant update (kitchen_work_status, kitchen_done_at, updated_at) on public.partner_orders to anon, authenticated;
grant update (kitchen_item_status, kitchen_done_at, updated_at) on public.partner_order_items to anon, authenticated;

drop policy if exists orders_public_select_for_kitchen on public.orders;
create policy orders_public_select_for_kitchen
on public.orders
for select
to anon, authenticated
using (true);

drop policy if exists order_items_public_select_for_kitchen on public.order_items;
create policy order_items_public_select_for_kitchen
on public.order_items
for select
to anon, authenticated
using (true);

drop policy if exists partner_orders_public_select_for_kitchen on public.partner_orders;
create policy partner_orders_public_select_for_kitchen
on public.partner_orders
for select
to anon, authenticated
using (true);

drop policy if exists partner_order_items_public_select_for_kitchen on public.partner_order_items;
create policy partner_order_items_public_select_for_kitchen
on public.partner_order_items
for select
to anon, authenticated
using (true);

drop policy if exists orders_staff_update_kitchen_status on public.orders;
create policy orders_staff_update_kitchen_status
on public.orders
for update
to authenticated
using (public.is_ghr_staff())
with check (public.is_ghr_staff());

drop policy if exists order_items_staff_update_kitchen_status on public.order_items;
create policy order_items_staff_update_kitchen_status
on public.order_items
for update
to authenticated
using (public.is_ghr_staff())
with check (public.is_ghr_staff());

drop policy if exists partner_orders_staff_update_kitchen_status on public.partner_orders;
create policy partner_orders_staff_update_kitchen_status
on public.partner_orders
for update
to authenticated
using (public.is_ghr_staff())
with check (public.is_ghr_staff());

drop policy if exists partner_order_items_staff_update_kitchen_status on public.partner_order_items;
create policy partner_order_items_staff_update_kitchen_status
on public.partner_order_items
for update
to authenticated
using (public.is_ghr_staff())
with check (public.is_ghr_staff());

-- Temporary policies for the current /kitchen screen before email login is connected.
-- Drop these after kitchen auth is added.
drop policy if exists orders_public_update_kitchen_status_until_auth on public.orders;
create policy orders_public_update_kitchen_status_until_auth
on public.orders
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists order_items_public_update_kitchen_status_until_auth on public.order_items;
create policy order_items_public_update_kitchen_status_until_auth
on public.order_items
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists partner_orders_public_update_kitchen_status_until_auth on public.partner_orders;
create policy partner_orders_public_update_kitchen_status_until_auth
on public.partner_orders
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists partner_order_items_public_update_kitchen_status_until_auth on public.partner_order_items;
create policy partner_order_items_public_update_kitchen_status_until_auth
on public.partner_order_items
for update
to anon, authenticated
using (true)
with check (true);

-- Backfill from older temporary fields if they were used.
update public.order_items
set
  kitchen_item_status = 'done',
  kitchen_done_at = coalesce(kitchen_done_at, updated_at, now())
where item_status = 'done'
  and kitchen_item_status <> 'done';

update public.partner_order_items
set
  kitchen_item_status = 'done',
  kitchen_done_at = coalesce(kitchen_done_at, updated_at, now())
where item_status in ('done', 'ready')
  and kitchen_item_status <> 'done';

-- Verification queries.
select
  'orders_kitchen_status_count' as check_name,
  kitchen_status,
  count(*) as total
from public.orders
group by kitchen_status
order by kitchen_status;

select
  'order_items_kitchen_item_status_count' as check_name,
  kitchen_item_status,
  count(*) as total
from public.order_items
group by kitchen_item_status
order by kitchen_item_status;

select
  'partner_orders_kitchen_work_status_count' as check_name,
  kitchen_work_status,
  count(*) as total
from public.partner_orders
group by kitchen_work_status
order by kitchen_work_status;

select
  'partner_order_items_kitchen_item_status_count' as check_name,
  kitchen_item_status,
  count(*) as total
from public.partner_order_items
group by kitchen_item_status
order by kitchen_item_status;
