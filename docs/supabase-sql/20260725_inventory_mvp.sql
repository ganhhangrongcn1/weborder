-- Ganh Hang Rong Inventory MVP
-- Review in a non-production environment before applying.
-- This script is designed to be safe to rerun.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.inventory_warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  warehouse_type text not null default 'branch'
    check (warehouse_type in ('central', 'branch', 'mobile', 'other')),
  address text,
  manager_name text,
  manager_phone text,
  supply_warehouse_id uuid references public.inventory_warehouses(id),
  allows_direct_receipt boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.inventory_user_access (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  warehouse_id uuid references public.inventory_warehouses(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'central_manager', 'branch_manager', 'staff', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (auth_user_id, warehouse_id, role)
);

create table if not exists public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit_type text not null default 'count'
    check (unit_type in ('count', 'weight', 'volume', 'length', 'other')),
  decimal_places smallint not null default 3 check (decimal_places between 0 and 6),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_item_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  item_type text not null default 'ingredient'
    check (item_type in ('ingredient', 'finished_good', 'packaging', 'other')),
  group_id uuid references public.inventory_item_groups(id),
  base_unit_id uuid not null references public.inventory_units(id),
  purchase_unit_id uuid references public.inventory_units(id),
  purchase_to_base_ratio numeric(18,6) not null default 1
    check (purchase_to_base_ratio > 0),
  minimum_stock numeric(18,6) not null default 0 check (minimum_stock >= 0),
  is_active boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.inventory_suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  payment_notes text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.inventory_supplier_items (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.inventory_suppliers(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  supplier_sku text,
  purchase_unit_id uuid references public.inventory_units(id),
  pack_size numeric(18,6) not null default 1 check (pack_size > 0),
  last_price numeric(18,2) check (last_price is null or last_price >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (supplier_id, item_id)
);

create table if not exists public.inventory_documents (
  id uuid primary key default gen_random_uuid(),
  document_no text not null unique,
  idempotency_key text not null unique,
  document_type text not null
    check (document_type in ('opening_balance', 'purchase_receipt', 'transfer', 'stock_count', 'stock_adjustment', 'waste', 'return')),
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'in_transit', 'received_with_variance', 'completed', 'cancelled')),
  source_warehouse_id uuid references public.inventory_warehouses(id),
  destination_warehouse_id uuid references public.inventory_warehouses(id),
  supplier_id uuid references public.inventory_suppliers(id),
  reference_no text,
  occurred_at timestamptz not null default now(),
  notes text,
  total_amount numeric(18,2) not null default 0 check (total_amount >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  submitted_at timestamptz,
  submitted_by uuid references auth.users(id),
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  constraint inventory_documents_transfer_warehouses_check check (
    document_type <> 'transfer'
    or (
      source_warehouse_id is not null
      and destination_warehouse_id is not null
      and source_warehouse_id <> destination_warehouse_id
    )
  )
);

create table if not exists public.inventory_document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.inventory_documents(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id),
  unit_id uuid not null references public.inventory_units(id),
  expected_quantity numeric(18,6) not null default 0 check (expected_quantity >= 0),
  actual_quantity numeric(18,6) check (actual_quantity is null or actual_quantity >= 0),
  base_quantity numeric(18,6) not null default 0 check (base_quantity >= 0),
  unit_price numeric(18,2) not null default 0 check (unit_price >= 0),
  variance_reason text,
  notes text,
  created_at timestamptz not null default now(),
  unique (document_id, item_id)
);

create table if not exists public.inventory_stock_balances (
  warehouse_id uuid not null references public.inventory_warehouses(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity numeric(18,6) not null default 0,
  average_cost numeric(18,2) not null default 0 check (average_cost >= 0),
  updated_at timestamptz not null default now(),
  primary key (warehouse_id, item_id)
);

create table if not exists public.inventory_stock_movements (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.inventory_warehouses(id),
  item_id uuid not null references public.inventory_items(id),
  document_id uuid not null references public.inventory_documents(id),
  document_line_id uuid not null references public.inventory_document_lines(id),
  direction text not null check (direction in ('in', 'out')),
  quantity numeric(18,6) not null check (quantity > 0),
  unit_cost numeric(18,2) not null default 0 check (unit_cost >= 0),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (document_line_id, warehouse_id, direction)
);

create index if not exists inventory_user_access_auth_user_idx
  on public.inventory_user_access (auth_user_id) where is_active;
create index if not exists inventory_user_access_warehouse_idx
  on public.inventory_user_access (warehouse_id) where is_active;
create index if not exists inventory_items_group_idx
  on public.inventory_items (group_id) where is_active;
create index if not exists inventory_documents_source_idx
  on public.inventory_documents (source_warehouse_id, created_at desc);
create index if not exists inventory_documents_destination_idx
  on public.inventory_documents (destination_warehouse_id, created_at desc);
create index if not exists inventory_documents_status_idx
  on public.inventory_documents (status, created_at desc);
create index if not exists inventory_document_lines_document_idx
  on public.inventory_document_lines (document_id);
create index if not exists inventory_stock_movements_warehouse_item_idx
  on public.inventory_stock_movements (warehouse_id, item_id, occurred_at desc);

create or replace function private.inventory_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = (select auth.uid())
      and access.is_active
      and access.role in ('owner', 'admin')
  );
$$;

create or replace function private.inventory_can_access_warehouse(target_warehouse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.inventory_is_admin())
    or exists (
      select 1
      from public.inventory_user_access access
      where access.auth_user_id = (select auth.uid())
        and access.is_active
        and access.warehouse_id = target_warehouse_id
    );
$$;

create or replace function private.inventory_can_manage_purchasing()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = (select auth.uid())
      and access.is_active
      and access.role in ('owner', 'admin', 'central_manager')
  );
$$;
revoke all on function private.inventory_is_admin() from public;
revoke all on function private.inventory_can_access_warehouse(uuid) from public;
revoke all on function private.inventory_can_manage_purchasing() from public;
grant execute on function private.inventory_is_admin() to authenticated;
grant execute on function private.inventory_can_access_warehouse(uuid) to authenticated;
grant execute on function private.inventory_can_manage_purchasing() to authenticated;

alter table public.inventory_warehouses enable row level security;
alter table public.inventory_user_access enable row level security;
alter table public.inventory_units enable row level security;
alter table public.inventory_item_groups enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_suppliers enable row level security;
alter table public.inventory_supplier_items enable row level security;
alter table public.inventory_documents enable row level security;
alter table public.inventory_document_lines enable row level security;
alter table public.inventory_stock_balances enable row level security;
alter table public.inventory_stock_movements enable row level security;

drop policy if exists inventory_warehouses_select on public.inventory_warehouses;
create policy inventory_warehouses_select
on public.inventory_warehouses for select to authenticated
using ((select private.inventory_is_admin()) or (select private.inventory_can_access_warehouse(id)));

drop policy if exists inventory_warehouses_admin_write on public.inventory_warehouses;
create policy inventory_warehouses_admin_write
on public.inventory_warehouses for all to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));

drop policy if exists inventory_user_access_select on public.inventory_user_access;
create policy inventory_user_access_select
on public.inventory_user_access for select to authenticated
using (auth_user_id = (select auth.uid()) or (select private.inventory_is_admin()));

drop policy if exists inventory_user_access_admin_write on public.inventory_user_access;
create policy inventory_user_access_admin_write
on public.inventory_user_access for all to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));

drop policy if exists inventory_units_select on public.inventory_units;
create policy inventory_units_select
on public.inventory_units for select to authenticated using (true);
drop policy if exists inventory_units_admin_write on public.inventory_units;
create policy inventory_units_admin_write
on public.inventory_units for all to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));

drop policy if exists inventory_item_groups_select on public.inventory_item_groups;
create policy inventory_item_groups_select
on public.inventory_item_groups for select to authenticated using (true);
drop policy if exists inventory_item_groups_admin_write on public.inventory_item_groups;
create policy inventory_item_groups_admin_write
on public.inventory_item_groups for all to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));

drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select
on public.inventory_items for select to authenticated using (true);
drop policy if exists inventory_items_admin_write on public.inventory_items;
create policy inventory_items_admin_write
on public.inventory_items for all to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));

drop policy if exists inventory_suppliers_select on public.inventory_suppliers;
create policy inventory_suppliers_select
on public.inventory_suppliers for select to authenticated
using ((select private.inventory_can_manage_purchasing()));
drop policy if exists inventory_suppliers_admin_write on public.inventory_suppliers;
create policy inventory_suppliers_admin_write
on public.inventory_suppliers for all to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));

drop policy if exists inventory_supplier_items_select on public.inventory_supplier_items;
create policy inventory_supplier_items_select
on public.inventory_supplier_items for select to authenticated
using ((select private.inventory_can_manage_purchasing()));
drop policy if exists inventory_supplier_items_admin_write on public.inventory_supplier_items;
create policy inventory_supplier_items_admin_write
on public.inventory_supplier_items for all to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));

drop policy if exists inventory_documents_select on public.inventory_documents;
create policy inventory_documents_select
on public.inventory_documents for select to authenticated
using (
  (select private.inventory_is_admin())
  or (source_warehouse_id is not null and (select private.inventory_can_access_warehouse(source_warehouse_id)))
  or (destination_warehouse_id is not null and (select private.inventory_can_access_warehouse(destination_warehouse_id)))
);

drop policy if exists inventory_documents_insert on public.inventory_documents;
create policy inventory_documents_insert
on public.inventory_documents for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    (select private.inventory_is_admin())
    or (source_warehouse_id is not null and (select private.inventory_can_access_warehouse(source_warehouse_id)))
    or (destination_warehouse_id is not null and (select private.inventory_can_access_warehouse(destination_warehouse_id)))
  )
);

drop policy if exists inventory_documents_update_draft on public.inventory_documents;
create policy inventory_documents_update_draft
on public.inventory_documents for update to authenticated
using (
  status in ('draft', 'submitted', 'in_transit')
  and (
    (select private.inventory_is_admin())
    or (source_warehouse_id is not null and (select private.inventory_can_access_warehouse(source_warehouse_id)))
    or (destination_warehouse_id is not null and (select private.inventory_can_access_warehouse(destination_warehouse_id)))
  )
)
with check (
  (select private.inventory_is_admin())
  or (source_warehouse_id is not null and (select private.inventory_can_access_warehouse(source_warehouse_id)))
  or (destination_warehouse_id is not null and (select private.inventory_can_access_warehouse(destination_warehouse_id)))
);

drop policy if exists inventory_document_lines_select on public.inventory_document_lines;
create policy inventory_document_lines_select
on public.inventory_document_lines for select to authenticated
using (
  exists (
    select 1 from public.inventory_documents document
    where document.id = document_id
  )
);

drop policy if exists inventory_document_lines_write on public.inventory_document_lines;
create policy inventory_document_lines_write
on public.inventory_document_lines for all to authenticated
using (
  exists (
    select 1 from public.inventory_documents document
    where document.id = document_id
      and document.status = 'draft'
  )
)
with check (
  exists (
    select 1 from public.inventory_documents document
    where document.id = document_id
      and document.status = 'draft'
  )
);

drop policy if exists inventory_stock_balances_select on public.inventory_stock_balances;
create policy inventory_stock_balances_select
on public.inventory_stock_balances for select to authenticated
using ((select private.inventory_can_access_warehouse(warehouse_id)));

drop policy if exists inventory_stock_movements_select on public.inventory_stock_movements;
create policy inventory_stock_movements_select
on public.inventory_stock_movements for select to authenticated
using ((select private.inventory_can_access_warehouse(warehouse_id)));

grant select, insert, update, delete on table
  public.inventory_warehouses,
  public.inventory_user_access,
  public.inventory_units,
  public.inventory_item_groups,
  public.inventory_items,
  public.inventory_suppliers,
  public.inventory_supplier_items,
  public.inventory_documents,
  public.inventory_document_lines
to authenticated;

grant select on table
  public.inventory_stock_balances,
  public.inventory_stock_movements
to authenticated;

notify pgrst, 'reload schema';

