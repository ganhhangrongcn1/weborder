-- Mở rộng danh mục hàng hóa: theo dõi tồn kho và phạm vi kho áp dụng.
-- An toàn khi chạy lại nhiều lần.

alter table public.inventory_items
  add column if not exists tracks_inventory boolean not null default true;

alter table public.inventory_units
  add column if not exists description text;

alter table public.inventory_items
  drop constraint if exists inventory_items_item_type_check;

update public.inventory_items
set item_type = 'other'
where item_type = 'packaging';

alter table public.inventory_items
  add constraint inventory_items_item_type_check
  check (item_type in ('ingredient', 'finished_good', 'semi_finished', 'direct_sale', 'other', 'note'));

create table if not exists public.inventory_item_warehouses (
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  warehouse_id uuid not null references public.inventory_warehouses(id) on delete cascade,
  minimum_stock numeric(18,6) not null default 0 check (minimum_stock >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  primary key (item_id, warehouse_id)
);

create index if not exists inventory_item_warehouses_warehouse_idx
  on public.inventory_item_warehouses (warehouse_id, item_id);

alter table public.inventory_item_warehouses enable row level security;

drop policy if exists inventory_item_warehouses_select on public.inventory_item_warehouses;
create policy inventory_item_warehouses_select
on public.inventory_item_warehouses for select to authenticated
using (
  (select private.inventory_is_admin())
  or (select private.inventory_can_access_warehouse(warehouse_id))
);

drop policy if exists inventory_item_warehouses_admin_write on public.inventory_item_warehouses;
create policy inventory_item_warehouses_admin_write
on public.inventory_item_warehouses for all to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));

grant select, insert, update, delete
  on table public.inventory_item_warehouses
  to authenticated;

notify pgrst, 'reload schema';
