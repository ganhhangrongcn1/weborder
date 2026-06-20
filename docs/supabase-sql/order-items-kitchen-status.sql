-- Legacy migration: item_status for website order_items.
-- Current kitchen flow now uses docs/kitchen-work-status.sql instead.
-- Keep this file for history only; new kitchen work should use kitchen_item_status.
--
-- Kitchen item status for website order_items.
-- Goal:
-- 1. Add item_status to public.order_items so the kitchen can tick each website item.
-- 2. Keep checkout/customer reads working.
-- 3. Allow kitchen/admin/staff authenticated accounts to update item_status.
-- 4. Keep a temporary anon update policy so /kitchen can work before email login is added.
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

alter table public.order_items
add column if not exists item_status text not null default 'pending';

alter table public.order_items
add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_items_item_status_check'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
    add constraint order_items_item_status_check
    check (item_status in ('pending', 'confirmed', 'cooking', 'ready', 'done', 'cancelled'));
  end if;
end $$;

create index if not exists order_items_order_id_idx
on public.order_items (order_id);

create index if not exists order_items_item_status_idx
on public.order_items (item_status);

create index if not exists order_items_updated_at_idx
on public.order_items (updated_at desc);

drop trigger if exists order_items_set_updated_at on public.order_items;
create trigger order_items_set_updated_at
before update on public.order_items
for each row
execute function public.set_updated_at();

alter table public.order_items enable row level security;

grant select, insert on public.order_items to anon, authenticated;
grant update (item_status, updated_at) on public.order_items to anon, authenticated;

drop policy if exists order_items_public_select on public.order_items;
create policy order_items_public_select
on public.order_items
for select
to anon, authenticated
using (true);

drop policy if exists order_items_public_insert on public.order_items;
create policy order_items_public_insert
on public.order_items
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_items.order_id
  )
);

drop policy if exists order_items_staff_update_status on public.order_items;
create policy order_items_staff_update_status
on public.order_items
for update
to authenticated
using (public.is_ghr_staff())
with check (public.is_ghr_staff());

-- Temporary policy for the current /kitchen screen before email login is connected.
-- After kitchen auth is added, drop this policy:
-- drop policy if exists order_items_public_update_status_until_kitchen_auth on public.order_items;
drop policy if exists order_items_public_update_status_until_kitchen_auth on public.order_items;
create policy order_items_public_update_status_until_kitchen_auth
on public.order_items
for update
to anon, authenticated
using (true)
with check (true);

-- Backfill from metadata if the app previously stored kitchenStatus there.
update public.order_items
set item_status = coalesce(nullif(metadata ->> 'kitchenStatus', ''), item_status)
where metadata ? 'kitchenStatus'
  and coalesce(nullif(metadata ->> 'kitchenStatus', ''), item_status)
    in ('pending', 'confirmed', 'cooking', 'ready', 'done', 'cancelled');

-- Verification queries.
select
  'order_items_item_status_count' as check_name,
  item_status,
  count(*) as total
from public.order_items
group by item_status
order by item_status;

select
  'order_items_missing_order' as check_name,
  count(*) as value
from public.order_items oi
left join public.orders o on o.id = oi.order_id
where o.id is null;
