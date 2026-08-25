-- Ganh Hang Rong Inventory MVP
-- Packaged from the runtime-verified local schema on 2026-08-24.
-- Deployment remains approval-gated: audit the target schema and run a dry run first.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.inventory_warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  warehouse_type text not null default 'branch'
    check (warehouse_type in ('central', 'branch', 'mobile', 'other')),
  branch_id bigint references public.branches(id),
  branch_uuid uuid,
  address text,
  manager_name text,
  manager_phone text,
  supply_warehouse_id uuid references public.inventory_warehouses(id),
  allows_direct_receipt boolean not null default false,
  allow_negative_stock boolean not null default false,
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
    check (document_type in (
      'opening_balance',
      'purchase_receipt',
      'stock_issue',
      'transfer',
      'internal_requisition',
      'stock_count',
      'stock_adjustment',
      'waste',
      'return',
      'transfer_return',
      'reversal'
    )),
  status text not null default 'draft'
    check (status in (
      'draft',
      'counting',
      'submitted',
      'approved',
      'rejected',
      'in_transit',
      'received',
      'received_with_variance',
      'fulfilled',
      'completed',
      'cancelled'
    )),
  source_warehouse_id uuid references public.inventory_warehouses(id),
  destination_warehouse_id uuid references public.inventory_warehouses(id),
  supplier_id uuid references public.inventory_suppliers(id),
  source_document_id uuid references public.inventory_documents(id),
  reference_no text,
  occurred_at timestamptz not null default now(),
  notes text,
  total_amount numeric(18,2) not null default 0 check (total_amount >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  submitted_at timestamptz,
  submitted_by uuid references auth.users(id),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  rejected_at timestamptz,
  rejected_by uuid references auth.users(id),
  rejection_reason text,
  dispatched_at timestamptz,
  dispatched_by uuid references auth.users(id),
  received_at timestamptz,
  received_by uuid references auth.users(id),
  completed_at timestamptz,
  completed_by uuid references auth.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancellation_reason text,
  reversal_reason text,
  constraint inventory_documents_transfer_warehouses_check check (
    document_type not in ('transfer', 'transfer_return')
    or (
      source_warehouse_id is not null
      and destination_warehouse_id is not null
      and source_warehouse_id <> destination_warehouse_id
    )
  ),
  constraint inventory_documents_issue_source_check check (
    document_type not in ('stock_issue', 'waste')
    or source_warehouse_id is not null
  ),
  constraint inventory_documents_receipt_destination_check check (
    document_type not in ('opening_balance', 'purchase_receipt', 'return')
    or destination_warehouse_id is not null
  ),
  constraint inventory_documents_stock_count_source_check check (
    document_type <> 'stock_count'
    or source_warehouse_id is not null
  ),
  constraint inventory_documents_requisition_destination_check check (
    document_type <> 'internal_requisition'
    or destination_warehouse_id is not null
  ),
  constraint inventory_documents_requisition_source_after_review_check check (
    document_type <> 'internal_requisition'
    or status not in ('approved', 'rejected', 'fulfilled')
    or source_warehouse_id is not null
  ),
  constraint inventory_documents_reversal_source_check check (
    document_type <> 'reversal'
    or (source_document_id is not null and nullif(btrim(reversal_reason), '') is not null)
  )
);

create table if not exists public.inventory_document_lines (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.inventory_documents(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id),
  unit_id uuid not null references public.inventory_units(id),
  conversion_to_base numeric(18,6) not null default 1 check (conversion_to_base > 0),
  expected_quantity numeric(18,6) not null default 0 check (expected_quantity >= 0),
  approved_quantity numeric(18,6) check (approved_quantity is null or approved_quantity >= 0),
  shipped_quantity numeric(18,6) check (shipped_quantity is null or shipped_quantity >= 0),
  received_quantity numeric(18,6) check (received_quantity is null or received_quantity >= 0),
  counted_quantity numeric(18,6) check (counted_quantity is null or counted_quantity >= 0),
  actual_quantity numeric(18,6) check (actual_quantity is null or actual_quantity >= 0),
  base_quantity numeric(18,6) not null default 0 check (base_quantity >= 0),
  unit_price numeric(18,2) not null default 0 check (unit_price >= 0),
  variance_reason text,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  unique (document_id, item_id)
);

create table if not exists public.inventory_stock_count_snapshots (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.inventory_documents(id) on delete cascade,
  warehouse_id uuid not null references public.inventory_warehouses(id),
  item_id uuid not null references public.inventory_items(id),
  system_quantity numeric(18,6) not null,
  movement_sequence_at_capture bigint not null default 0,
  movement_sequence_at_count bigint,
  movement_sequence_until_submit bigint,
  movement_quantity_until_count numeric(18,6),
  movement_quantity_until_submit numeric(18,6) not null default 0,
  expected_quantity_at_count numeric(18,6),
  expected_quantity_at_submit numeric(18,6),
  captured_at timestamptz not null default now(),
  counted_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_id, warehouse_id, item_id)
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
  movement_sequence bigint generated always as identity unique,
  warehouse_id uuid not null references public.inventory_warehouses(id),
  item_id uuid not null references public.inventory_items(id),
  document_id uuid not null references public.inventory_documents(id),
  document_line_id uuid not null references public.inventory_document_lines(id),
  direction text not null check (direction in ('in', 'out')),
  movement_stage text not null default 'completion'
    check (movement_stage in ('completion', 'dispatch', 'receipt', 'adjustment', 'reversal', 'order_consumption')),
  quantity numeric(18,6) not null check (quantity > 0),
  unit_cost numeric(18,2) not null default 0 check (unit_cost >= 0),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (document_line_id, warehouse_id, direction)
);

create table if not exists public.inventory_document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.inventory_documents(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

create table if not exists public.inventory_document_operations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.inventory_documents(id) on delete cascade,
  operation text not null,
  idempotency_key text not null unique,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (document_id, operation)
);

create index if not exists inventory_user_access_auth_user_idx
  on public.inventory_user_access (auth_user_id) where is_active;
create index if not exists inventory_user_access_warehouse_idx
  on public.inventory_user_access (warehouse_id) where is_active;
create index if not exists inventory_warehouses_branch_id_idx
  on public.inventory_warehouses (branch_id) where branch_id is not null;
create index if not exists inventory_warehouses_branch_uuid_idx
  on public.inventory_warehouses (branch_uuid) where branch_uuid is not null;
create index if not exists inventory_warehouses_supply_warehouse_idx
  on public.inventory_warehouses (supply_warehouse_id) where supply_warehouse_id is not null;
create index if not exists inventory_warehouses_created_by_idx
  on public.inventory_warehouses (created_by) where created_by is not null;
create index if not exists inventory_warehouses_updated_by_idx
  on public.inventory_warehouses (updated_by) where updated_by is not null;
create index if not exists inventory_user_access_created_by_idx
  on public.inventory_user_access (created_by) where created_by is not null;
create index if not exists inventory_units_created_by_idx
  on public.inventory_units (created_by) where created_by is not null;
create index if not exists inventory_item_groups_created_by_idx
  on public.inventory_item_groups (created_by) where created_by is not null;
create index if not exists inventory_items_group_idx
  on public.inventory_items (group_id) where is_active;
create index if not exists inventory_items_base_unit_idx
  on public.inventory_items (base_unit_id);
create index if not exists inventory_items_purchase_unit_idx
  on public.inventory_items (purchase_unit_id) where purchase_unit_id is not null;
create index if not exists inventory_items_created_by_idx
  on public.inventory_items (created_by) where created_by is not null;
create index if not exists inventory_items_updated_by_idx
  on public.inventory_items (updated_by) where updated_by is not null;
create index if not exists inventory_suppliers_created_by_idx
  on public.inventory_suppliers (created_by) where created_by is not null;
create index if not exists inventory_suppliers_updated_by_idx
  on public.inventory_suppliers (updated_by) where updated_by is not null;
create index if not exists inventory_supplier_items_item_idx
  on public.inventory_supplier_items (item_id) where is_active;
create index if not exists inventory_supplier_items_purchase_unit_idx
  on public.inventory_supplier_items (purchase_unit_id) where purchase_unit_id is not null;
create index if not exists inventory_documents_source_idx
  on public.inventory_documents (source_warehouse_id, created_at desc);
create index if not exists inventory_documents_destination_idx
  on public.inventory_documents (destination_warehouse_id, created_at desc);
create index if not exists inventory_documents_status_idx
  on public.inventory_documents (status, created_at desc);
create index if not exists inventory_documents_type_status_created_idx
  on public.inventory_documents (document_type, status, created_at desc);
create index if not exists inventory_documents_supplier_idx
  on public.inventory_documents (supplier_id, created_at desc) where supplier_id is not null;
create index if not exists inventory_documents_source_document_idx
  on public.inventory_documents (source_document_id) where source_document_id is not null;
create unique index if not exists inventory_documents_one_transfer_per_requisition_idx
  on public.inventory_documents (source_document_id)
  where document_type = 'transfer' and source_document_id is not null;
create index if not exists inventory_documents_created_by_idx
  on public.inventory_documents (created_by);
create index if not exists inventory_documents_submitted_by_idx
  on public.inventory_documents (submitted_by) where submitted_by is not null;
create index if not exists inventory_documents_approved_by_idx
  on public.inventory_documents (approved_by) where approved_by is not null;
create index if not exists inventory_documents_rejected_by_idx
  on public.inventory_documents (rejected_by) where rejected_by is not null;
create index if not exists inventory_documents_dispatched_by_idx
  on public.inventory_documents (dispatched_by) where dispatched_by is not null;
create index if not exists inventory_documents_received_by_idx
  on public.inventory_documents (received_by) where received_by is not null;
create index if not exists inventory_documents_completed_by_idx
  on public.inventory_documents (completed_by) where completed_by is not null;
create index if not exists inventory_documents_cancelled_by_idx
  on public.inventory_documents (cancelled_by) where cancelled_by is not null;
create index if not exists inventory_document_lines_document_idx
  on public.inventory_document_lines (document_id);
create index if not exists inventory_document_lines_item_idx
  on public.inventory_document_lines (item_id);
create index if not exists inventory_document_lines_unit_idx
  on public.inventory_document_lines (unit_id);
create index if not exists inventory_stock_count_snapshots_document_idx
  on public.inventory_stock_count_snapshots (document_id);
create index if not exists inventory_stock_count_snapshots_warehouse_item_idx
  on public.inventory_stock_count_snapshots (warehouse_id, item_id);
create index if not exists inventory_stock_count_snapshots_item_idx
  on public.inventory_stock_count_snapshots (item_id);
create index if not exists inventory_stock_balances_item_idx
  on public.inventory_stock_balances (item_id);
create index if not exists inventory_stock_movements_warehouse_item_idx
  on public.inventory_stock_movements (warehouse_id, item_id, occurred_at desc);
create index if not exists inventory_stock_movements_document_idx
  on public.inventory_stock_movements (document_id);
create index if not exists inventory_stock_movements_item_idx
  on public.inventory_stock_movements (item_id, occurred_at desc);
create index if not exists inventory_stock_movements_created_by_idx
  on public.inventory_stock_movements (created_by);
create index if not exists inventory_document_events_document_idx
  on public.inventory_document_events (document_id, created_at);
create index if not exists inventory_document_events_created_by_idx
  on public.inventory_document_events (created_by);
create index if not exists inventory_document_operations_document_idx
  on public.inventory_document_operations (document_id, created_at);
create index if not exists inventory_document_operations_created_by_idx
  on public.inventory_document_operations (created_by);

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

create or replace function private.inventory_submit_document_impl(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để gửi phiếu kho.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác gửi phiếu.';
  end if;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found then
    raise exception 'Không tìm thấy phiếu kho.';
  end if;

  if v_document.document_type = 'stock_count' then
    raise exception 'Phiếu kiểm kê phải bắt đầu bằng RPC inventory_start_stock_count.';
  end if;

  if not (
    (select private.inventory_is_admin())
    or (
      v_document.source_warehouse_id is not null
      and (select private.inventory_can_access_warehouse(v_document.source_warehouse_id))
    )
    or (
      v_document.destination_warehouse_id is not null
      and (select private.inventory_can_access_warehouse(v_document.destination_warehouse_id))
    )
  ) then
    raise exception 'Bạn không có quyền truy cập phiếu của kho này.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'submit';

  if found then
    if v_existing_key <> btrim(p_idempotency_key) then
      raise exception 'Phiếu đã được gửi bằng một idempotency key khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
      and (operation.document_id <> p_document_id or operation.operation <> 'submit')
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.status <> 'draft' then
    raise exception 'Chỉ phiếu nháp mới được gửi duyệt. Trạng thái hiện tại: %.', v_document.status;
  end if;

  if not exists (
    select 1
    from public.inventory_document_lines line
    where line.document_id = p_document_id
      and greatest(
        coalesce(line.expected_quantity, 0),
        coalesce(line.actual_quantity, 0),
        coalesce(line.approved_quantity, 0),
        coalesce(line.shipped_quantity, 0),
        coalesce(line.received_quantity, 0),
        coalesce(line.counted_quantity, 0)
      ) > 0
  ) then
    raise exception 'Phiếu phải có ít nhất một mặt hàng với số lượng lớn hơn 0.';
  end if;

  update public.inventory_documents
  set status = 'submitted',
      submitted_at = now(),
      submitted_by = v_actor
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id,
    event_type,
    from_status,
    to_status,
    event_data,
    created_by
  )
  values (
    p_document_id,
    'submitted',
    'draft',
    'submitted',
    jsonb_build_object('idempotency_key', btrim(p_idempotency_key)),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'submitted',
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id,
    operation,
    idempotency_key,
    result,
    created_by
  )
  values (
    p_document_id,
    'submit',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function private.inventory_complete_simple_document_impl(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_line record;
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
  v_warehouse_id uuid;
  v_direction text;
  v_allow_negative boolean;
  v_quantity numeric(18,6);
  v_old_quantity numeric(18,6);
  v_old_average_cost numeric(18,2);
  v_new_quantity numeric(18,6);
  v_new_average_cost numeric(18,2);
  v_movement_cost numeric(18,2);
  v_movement_count integer := 0;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để hoàn tất phiếu kho.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác hoàn tất.';
  end if;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found then
    raise exception 'Không tìm thấy phiếu kho.';
  end if;

  if not (
    (select private.inventory_is_admin())
    or (
      v_document.source_warehouse_id is not null
      and (select private.inventory_can_access_warehouse(v_document.source_warehouse_id))
    )
    or (
      v_document.destination_warehouse_id is not null
      and (select private.inventory_can_access_warehouse(v_document.destination_warehouse_id))
    )
  ) then
    raise exception 'Bạn không có quyền truy cập phiếu của kho này.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'complete';

  if found then
    if v_existing_key <> btrim(p_idempotency_key) then
      raise exception 'Phiếu đã được hoàn tất bằng một idempotency key khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
      and (operation.document_id <> p_document_id or operation.operation <> 'complete')
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.document_type not in (
    'opening_balance',
    'purchase_receipt',
    'stock_issue',
    'waste',
    'return'
  ) then
    raise exception 'Loại phiếu % phải dùng engine chuyên biệt.', v_document.document_type;
  end if;

  if v_document.document_type = 'purchase_receipt' and v_document.supplier_id is null then
    raise exception 'Phiếu nhập mua phải có nhà cung cấp.';
  end if;

  if v_document.document_type in ('stock_issue', 'waste')
     and nullif(btrim(v_document.notes), '') is null then
    raise exception 'Phiếu xuất hoặc hủy hàng phải có lý do.';
  end if;

  if v_document.status not in ('submitted', 'approved') then
    raise exception 'Phiếu phải ở trạng thái submitted hoặc approved trước khi hoàn tất. Trạng thái hiện tại: %.', v_document.status;
  end if;

  if v_document.document_type in ('opening_balance', 'purchase_receipt', 'return') then
    v_warehouse_id := v_document.destination_warehouse_id;
    v_direction := 'in';
  else
    v_warehouse_id := v_document.source_warehouse_id;
    v_direction := 'out';
  end if;

  if v_warehouse_id is null then
    raise exception 'Phiếu chưa có kho nguồn hoặc kho đích phù hợp.';
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id = v_warehouse_id
          and access.role in ('central_manager', 'branch_manager')
        )
      )
  ) then
    raise exception 'Bạn không có quyền hoàn tất phiếu của kho này.';
  end if;

  if v_document.document_type = 'opening_balance'
     and not (select private.inventory_is_admin()) then
    raise exception 'Chỉ owner hoặc admin được hoàn tất phiếu tồn đầu.';
  end if;

  select warehouse.allow_negative_stock
  into v_allow_negative
  from public.inventory_warehouses warehouse
  where warehouse.id = v_warehouse_id
    and warehouse.is_active;

  if not found then
    raise exception 'Kho không tồn tại hoặc đã ngừng hoạt động.';
  end if;

  if not exists (
    select 1
    from public.inventory_document_lines line
    where line.document_id = p_document_id
      and coalesce(
        case when v_direction = 'in'
          then coalesce(line.actual_quantity, line.received_quantity, line.expected_quantity)
          else coalesce(line.actual_quantity, line.shipped_quantity, line.expected_quantity)
        end,
        0
      ) > 0
  ) then
    raise exception 'Phiếu phải có ít nhất một mặt hàng với số lượng hoàn tất lớn hơn 0.';
  end if;

  insert into public.inventory_stock_balances (
    warehouse_id,
    item_id,
    quantity,
    average_cost,
    updated_at
  )
  select distinct
    v_warehouse_id,
    line.item_id,
    0,
    0,
    now()
  from public.inventory_document_lines line
  where line.document_id = p_document_id
  on conflict (warehouse_id, item_id) do nothing;

  perform balance.item_id
  from public.inventory_stock_balances balance
  join public.inventory_document_lines line
    on line.item_id = balance.item_id
   and line.document_id = p_document_id
  where balance.warehouse_id = v_warehouse_id
  order by balance.item_id
  for update of balance;

  for v_line in
    select line.*
    from public.inventory_document_lines line
    where line.document_id = p_document_id
    order by line.item_id
  loop
    v_quantity := (
      case when v_direction = 'in'
        then coalesce(v_line.actual_quantity, v_line.received_quantity, v_line.expected_quantity)
        else coalesce(v_line.actual_quantity, v_line.shipped_quantity, v_line.expected_quantity)
      end
    ) * v_line.conversion_to_base;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Mặt hàng % có số lượng hoàn tất không hợp lệ.', v_line.item_id;
    end if;

    select balance.quantity, balance.average_cost
    into v_old_quantity, v_old_average_cost
    from public.inventory_stock_balances balance
    where balance.warehouse_id = v_warehouse_id
      and balance.item_id = v_line.item_id
    for update;

    if v_direction = 'out' and not v_allow_negative and v_old_quantity < v_quantity then
      raise exception 'Tồn kho không đủ cho mặt hàng %. Hiện có %, cần xuất %.',
        v_line.item_id,
        v_old_quantity,
        v_quantity;
    end if;

    if v_direction = 'in' then
      v_movement_cost := case
        when v_line.unit_price > 0 then v_line.unit_price / v_line.conversion_to_base
        else v_old_average_cost
      end;
      v_new_quantity := v_old_quantity + v_quantity;
      v_new_average_cost := case
        when v_new_quantity <= 0 then v_old_average_cost
        when v_old_quantity > 0 then round(
          ((v_old_quantity * v_old_average_cost) + (v_quantity * v_movement_cost))
          / v_new_quantity,
          2
        )
        else round(v_movement_cost, 2)
      end;
    else
      v_movement_cost := v_old_average_cost;
      v_new_quantity := v_old_quantity - v_quantity;
      v_new_average_cost := v_old_average_cost;
    end if;

    insert into public.inventory_stock_movements (
      warehouse_id,
      item_id,
      document_id,
      document_line_id,
      direction,
      movement_stage,
      quantity,
      unit_cost,
      occurred_at,
      created_by
    )
    values (
      v_warehouse_id,
      v_line.item_id,
      p_document_id,
      v_line.id,
      v_direction,
      'completion',
      v_quantity,
      v_movement_cost,
      v_document.occurred_at,
      v_actor
    );

    update public.inventory_stock_balances
    set quantity = v_new_quantity,
        average_cost = v_new_average_cost,
        updated_at = now()
    where warehouse_id = v_warehouse_id
      and item_id = v_line.item_id;

    update public.inventory_document_lines
    set base_quantity = v_quantity
    where id = v_line.id;

    v_movement_count := v_movement_count + 1;
  end loop;

  update public.inventory_documents
  set status = 'completed',
      completed_at = now(),
      completed_by = v_actor
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id,
    event_type,
    from_status,
    to_status,
    event_data,
    created_by
  )
  values (
    p_document_id,
    'completed',
    v_document.status,
    'completed',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'warehouse_id', v_warehouse_id,
      'direction', v_direction,
      'movement_count', v_movement_count
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'completed',
    'warehouse_id', v_warehouse_id,
    'direction', v_direction,
    'movement_count', v_movement_count,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id,
    operation,
    idempotency_key,
    result,
    created_by
  )
  values (
    p_document_id,
    'complete',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function private.inventory_dispatch_transfer_impl(
  p_document_id uuid,
  p_idempotency_key text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_line record;
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
  v_allow_negative boolean;
  v_input_count integer;
  v_distinct_count integer;
  v_line_count integer;
  v_payload_hash text;
  v_quantity numeric(18,6);
  v_old_quantity numeric(18,6);
  v_average_cost numeric(18,2);
  v_movement_count integer := 0;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để giao phiếu chuyển kho.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác giao kho.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Danh sách số lượng giao không hợp lệ.';
  end if;

  select md5(coalesce(jsonb_agg(entry.value order by entry.value ->> 'line_id'), '[]'::jsonb)::text)
  into v_payload_hash
  from jsonb_array_elements(p_lines) entry;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found then
    raise exception 'Không tìm thấy phiếu chuyển kho.';
  end if;

  if v_document.document_type <> 'transfer' then
    raise exception 'Phiếu % không phải phiếu chuyển kho.', v_document.document_no;
  end if;

  if not (
    (select private.inventory_is_admin())
    or (
      v_document.source_warehouse_id is not null
      and (select private.inventory_can_access_warehouse(v_document.source_warehouse_id))
    )
  ) then
    raise exception 'Bạn không có quyền giao hàng từ kho nguồn.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'dispatch_transfer';

  if found then
    if v_existing_key <> btrim(p_idempotency_key) then
      raise exception 'Phiếu đã được giao bằng một idempotency key khác.';
    end if;
    if coalesce(v_existing_result ->> 'payload_hash', '') <> v_payload_hash then
      raise exception 'Idempotency key giao kho đang được dùng với danh sách số lượng khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
      and (operation.document_id <> p_document_id or operation.operation <> 'dispatch_transfer')
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.status not in ('submitted', 'approved') then
    raise exception 'Phiếu chuyển phải ở trạng thái submitted hoặc approved trước khi giao. Trạng thái hiện tại: %.', v_document.status;
  end if;

  if v_document.source_warehouse_id is null or v_document.destination_warehouse_id is null then
    raise exception 'Phiếu chuyển chưa có đủ kho nguồn và kho đích.';
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id = v_document.source_warehouse_id
          and access.role in ('central_manager', 'branch_manager', 'staff')
        )
      )
  ) then
    raise exception 'Tài khoản không được giao hàng từ kho nguồn.';
  end if;

  select warehouse.allow_negative_stock
  into v_allow_negative
  from public.inventory_warehouses warehouse
  where warehouse.id = v_document.source_warehouse_id
    and warehouse.is_active;

  if not found then
    raise exception 'Kho nguồn không tồn tại hoặc đã ngừng hoạt động.';
  end if;

  select count(*), count(distinct (entry.value ->> 'line_id')::uuid)
  into v_input_count, v_distinct_count
  from jsonb_array_elements(p_lines) entry;

  select count(*)
  into v_line_count
  from public.inventory_document_lines line
  where line.document_id = p_document_id;

  if v_input_count <> v_distinct_count or v_input_count <> v_line_count then
    raise exception 'Danh sách giao phải có đúng một dòng cho mỗi mặt hàng trong phiếu.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) entry
    left join public.inventory_document_lines line
      on line.id = (entry.value ->> 'line_id')::uuid
     and line.document_id = p_document_id
    where line.id is null
       or nullif(entry.value ->> 'shipped_quantity', '') is null
       or (entry.value ->> 'shipped_quantity')::numeric <= 0
       or (entry.value ->> 'shipped_quantity')::numeric > coalesce(line.approved_quantity, line.expected_quantity)
  ) then
    raise exception 'Dòng giao không thuộc phiếu, vượt số đã duyệt hoặc có số lượng không hợp lệ.';
  end if;

  insert into public.inventory_stock_balances (
    warehouse_id,
    item_id,
    quantity,
    average_cost,
    updated_at
  )
  select distinct
    v_document.source_warehouse_id,
    line.item_id,
    0,
    0,
    now()
  from public.inventory_document_lines line
  where line.document_id = p_document_id
  on conflict (warehouse_id, item_id) do nothing;

  perform balance.item_id
  from public.inventory_stock_balances balance
  join public.inventory_document_lines line
    on line.item_id = balance.item_id
   and line.document_id = p_document_id
  where balance.warehouse_id = v_document.source_warehouse_id
  order by balance.item_id
  for update of balance;

  for v_line in
    select
      line.*,
      (entry.value ->> 'shipped_quantity')::numeric as input_shipped_quantity
    from jsonb_array_elements(p_lines) entry
    join public.inventory_document_lines line
      on line.id = (entry.value ->> 'line_id')::uuid
     and line.document_id = p_document_id
    order by line.item_id
  loop
    v_quantity := v_line.input_shipped_quantity * v_line.conversion_to_base;

    select balance.quantity, balance.average_cost
    into v_old_quantity, v_average_cost
    from public.inventory_stock_balances balance
    where balance.warehouse_id = v_document.source_warehouse_id
      and balance.item_id = v_line.item_id
    for update;

    if not v_allow_negative and v_old_quantity < v_quantity then
      raise exception 'Tồn kho nguồn không đủ cho mặt hàng %. Hiện có %, cần giao %.',
        v_line.item_id,
        v_old_quantity,
        v_quantity;
    end if;

    insert into public.inventory_stock_movements (
      warehouse_id,
      item_id,
      document_id,
      document_line_id,
      direction,
      movement_stage,
      quantity,
      unit_cost,
      occurred_at,
      created_by
    )
    values (
      v_document.source_warehouse_id,
      v_line.item_id,
      p_document_id,
      v_line.id,
      'out',
      'dispatch',
      v_quantity,
      v_average_cost,
      now(),
      v_actor
    );

    update public.inventory_stock_balances
    set quantity = v_old_quantity - v_quantity,
        updated_at = now()
    where warehouse_id = v_document.source_warehouse_id
      and item_id = v_line.item_id;

    update public.inventory_document_lines
    set shipped_quantity = v_line.input_shipped_quantity,
        base_quantity = v_quantity
    where id = v_line.id;

    v_movement_count := v_movement_count + 1;
  end loop;

  update public.inventory_documents
  set status = 'in_transit',
      dispatched_at = now(),
      dispatched_by = v_actor
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id,
    event_type,
    from_status,
    to_status,
    event_data,
    created_by
  )
  values (
    p_document_id,
    'dispatched',
    v_document.status,
    'in_transit',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'source_warehouse_id', v_document.source_warehouse_id,
      'movement_count', v_movement_count
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'in_transit',
    'movement_count', v_movement_count,
    'payload_hash', v_payload_hash,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id,
    operation,
    idempotency_key,
    result,
    created_by
  )
  values (
    p_document_id,
    'dispatch_transfer',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function private.inventory_receive_transfer_impl(
  p_document_id uuid,
  p_idempotency_key text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_line record;
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
  v_input_count integer;
  v_distinct_count integer;
  v_line_count integer;
  v_payload_hash text;
  v_variance_count integer := 0;
  v_movement_count integer := 0;
  v_received_quantity numeric(18,6);
  v_base_quantity numeric(18,6);
  v_old_quantity numeric(18,6);
  v_old_average_cost numeric(18,2);
  v_new_quantity numeric(18,6);
  v_new_average_cost numeric(18,2);
  v_source_cost numeric(18,2);
  v_next_status text;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để nhận phiếu chuyển kho.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác nhận kho.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Danh sách số lượng nhận không hợp lệ.';
  end if;

  select md5(coalesce(jsonb_agg(entry.value order by entry.value ->> 'line_id'), '[]'::jsonb)::text)
  into v_payload_hash
  from jsonb_array_elements(p_lines) entry;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found then
    raise exception 'Không tìm thấy phiếu chuyển kho.';
  end if;

  if v_document.document_type <> 'transfer' then
    raise exception 'Phiếu % không phải phiếu chuyển kho.', v_document.document_no;
  end if;

  if not (
    (select private.inventory_is_admin())
    or (
      v_document.destination_warehouse_id is not null
      and (select private.inventory_can_access_warehouse(v_document.destination_warehouse_id))
    )
  ) then
    raise exception 'Bạn không có quyền nhận hàng tại kho đích.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'receive_transfer';

  if found then
    if v_existing_key <> btrim(p_idempotency_key) then
      raise exception 'Phiếu đã được nhận bằng một idempotency key khác.';
    end if;
    if coalesce(v_existing_result ->> 'payload_hash', '') <> v_payload_hash then
      raise exception 'Idempotency key nhận kho đang được dùng với danh sách số lượng khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
      and (operation.document_id <> p_document_id or operation.operation <> 'receive_transfer')
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.status <> 'in_transit' then
    raise exception 'Chỉ phiếu đang giao mới được nhận. Trạng thái hiện tại: %.', v_document.status;
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id = v_document.destination_warehouse_id
          and access.role in ('central_manager', 'branch_manager', 'staff')
        )
      )
  ) then
    raise exception 'Tài khoản không được nhận hàng tại kho đích.';
  end if;

  if not exists (
    select 1
    from public.inventory_warehouses warehouse
    where warehouse.id = v_document.destination_warehouse_id
      and warehouse.is_active
  ) then
    raise exception 'Kho đích không tồn tại hoặc đã ngừng hoạt động.';
  end if;

  select count(*), count(distinct (entry.value ->> 'line_id')::uuid)
  into v_input_count, v_distinct_count
  from jsonb_array_elements(p_lines) entry;

  select count(*)
  into v_line_count
  from public.inventory_document_lines line
  where line.document_id = p_document_id;

  if v_input_count <> v_distinct_count or v_input_count <> v_line_count then
    raise exception 'Danh sách nhận phải có đúng một dòng cho mỗi mặt hàng trong phiếu.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) entry
    left join public.inventory_document_lines line
      on line.id = (entry.value ->> 'line_id')::uuid
     and line.document_id = p_document_id
    where line.id is null
       or line.shipped_quantity is null
       or nullif(entry.value ->> 'received_quantity', '') is null
       or (entry.value ->> 'received_quantity')::numeric < 0
       or (entry.value ->> 'received_quantity')::numeric > line.shipped_quantity
       or (
         (entry.value ->> 'received_quantity')::numeric <> line.shipped_quantity
         and nullif(btrim(entry.value ->> 'variance_reason'), '') is null
       )
  ) then
    raise exception 'Dòng nhận không hợp lệ, vượt số đã giao hoặc thiếu lý do chênh lệch.';
  end if;

  insert into public.inventory_stock_balances (
    warehouse_id,
    item_id,
    quantity,
    average_cost,
    updated_at
  )
  select distinct
    v_document.destination_warehouse_id,
    line.item_id,
    0,
    0,
    now()
  from public.inventory_document_lines line
  where line.document_id = p_document_id
  on conflict (warehouse_id, item_id) do nothing;

  perform balance.item_id
  from public.inventory_stock_balances balance
  join public.inventory_document_lines line
    on line.item_id = balance.item_id
   and line.document_id = p_document_id
  where balance.warehouse_id = v_document.destination_warehouse_id
  order by balance.item_id
  for update of balance;

  for v_line in
    select
      line.*,
      (entry.value ->> 'received_quantity')::numeric as input_received_quantity,
      nullif(btrim(entry.value ->> 'variance_reason'), '') as input_variance_reason
    from jsonb_array_elements(p_lines) entry
    join public.inventory_document_lines line
      on line.id = (entry.value ->> 'line_id')::uuid
     and line.document_id = p_document_id
    order by line.item_id
  loop
    v_received_quantity := v_line.input_received_quantity;
    v_base_quantity := v_received_quantity * v_line.conversion_to_base;

    select movement.unit_cost
    into v_source_cost
    from public.inventory_stock_movements movement
    where movement.document_line_id = v_line.id
      and movement.warehouse_id = v_document.source_warehouse_id
      and movement.direction = 'out'
      and movement.movement_stage = 'dispatch';

    if not found then
      raise exception 'Không tìm thấy movement giao hàng của mặt hàng %.', v_line.item_id;
    end if;

    if v_received_quantity <> v_line.shipped_quantity then
      v_variance_count := v_variance_count + 1;
    end if;

    if v_received_quantity > 0 then
      select balance.quantity, balance.average_cost
      into v_old_quantity, v_old_average_cost
      from public.inventory_stock_balances balance
      where balance.warehouse_id = v_document.destination_warehouse_id
        and balance.item_id = v_line.item_id
      for update;

      v_new_quantity := v_old_quantity + v_base_quantity;
      v_new_average_cost := case
        when v_new_quantity <= 0 then v_old_average_cost
        when v_old_quantity > 0 then round(
          ((v_old_quantity * v_old_average_cost) + (v_base_quantity * v_source_cost))
          / v_new_quantity,
          2
        )
        else round(v_source_cost, 2)
      end;

      insert into public.inventory_stock_movements (
        warehouse_id,
        item_id,
        document_id,
        document_line_id,
        direction,
        movement_stage,
        quantity,
        unit_cost,
        occurred_at,
        created_by
      )
      values (
        v_document.destination_warehouse_id,
        v_line.item_id,
        p_document_id,
        v_line.id,
        'in',
        'receipt',
        v_base_quantity,
        v_source_cost,
        now(),
        v_actor
      );

      update public.inventory_stock_balances
      set quantity = v_new_quantity,
          average_cost = v_new_average_cost,
          updated_at = now()
      where warehouse_id = v_document.destination_warehouse_id
        and item_id = v_line.item_id;

      v_movement_count := v_movement_count + 1;
    end if;

    update public.inventory_document_lines
    set received_quantity = v_received_quantity,
        variance_reason = v_line.input_variance_reason
    where id = v_line.id;
  end loop;

  v_next_status := case
    when v_variance_count = 0 then 'received'
    else 'received_with_variance'
  end;

  update public.inventory_documents
  set status = v_next_status,
      received_at = now(),
      received_by = v_actor
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id,
    event_type,
    from_status,
    to_status,
    event_data,
    created_by
  )
  values (
    p_document_id,
    'received',
    'in_transit',
    v_next_status,
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'destination_warehouse_id', v_document.destination_warehouse_id,
      'movement_count', v_movement_count,
      'variance_count', v_variance_count
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', v_next_status,
    'movement_count', v_movement_count,
    'variance_count', v_variance_count,
    'payload_hash', v_payload_hash,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id,
    operation,
    idempotency_key,
    result,
    created_by
  )
  values (
    p_document_id,
    'receive_transfer',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function private.inventory_complete_transfer_impl(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
  v_variance_count integer;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để khóa phiếu chuyển kho.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác khóa phiếu chuyển.';
  end if;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found then
    raise exception 'Không tìm thấy phiếu chuyển kho.';
  end if;

  if v_document.document_type <> 'transfer' then
    raise exception 'Phiếu % không phải phiếu chuyển kho.', v_document.document_no;
  end if;

  if not (
    (select private.inventory_is_admin())
    or (
      v_document.destination_warehouse_id is not null
      and (select private.inventory_can_access_warehouse(v_document.destination_warehouse_id))
    )
  ) then
    raise exception 'Bạn không có quyền khóa phiếu của kho đích.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'complete_transfer';

  if found then
    if v_existing_key <> btrim(p_idempotency_key) then
      raise exception 'Phiếu đã được khóa bằng một idempotency key khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
      and (operation.document_id <> p_document_id or operation.operation <> 'complete_transfer')
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.status not in ('received', 'received_with_variance') then
    raise exception 'Phiếu phải được kho đích xác nhận nhận trước khi khóa. Trạng thái hiện tại: %.', v_document.status;
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id = v_document.destination_warehouse_id
          and access.role in ('central_manager', 'branch_manager')
        )
      )
  ) then
    raise exception 'Tài khoản không được khóa phiếu tại kho đích.';
  end if;

  select count(*)
  into v_variance_count
  from public.inventory_document_lines line
  where line.document_id = p_document_id
    and line.received_quantity <> line.shipped_quantity;

  if exists (
    select 1
    from public.inventory_document_lines line
    where line.document_id = p_document_id
      and (
        line.shipped_quantity is null
        or line.received_quantity is null
        or (
          line.received_quantity <> line.shipped_quantity
          and nullif(btrim(line.variance_reason), '') is null
        )
        or (
          line.received_quantity > 0
          and not exists (
            select 1
            from public.inventory_stock_movements movement
            where movement.document_line_id = line.id
              and movement.warehouse_id = v_document.destination_warehouse_id
              and movement.direction = 'in'
              and movement.movement_stage = 'receipt'
          )
        )
      )
  ) then
    raise exception 'Phiếu còn dòng chưa nhận đủ dữ liệu hoặc thiếu movement nhận kho.';
  end if;

  if v_variance_count > 0 and not (select private.inventory_is_admin()) then
    raise exception 'Phiếu nhận lệch chỉ owner hoặc admin được khóa sau khi đối chiếu.';
  end if;

  update public.inventory_documents
  set status = 'completed',
      completed_at = now(),
      completed_by = v_actor
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id,
    event_type,
    from_status,
    to_status,
    event_data,
    created_by
  )
  values (
    p_document_id,
    'completed',
    v_document.status,
    'completed',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'variance_count', v_variance_count
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'completed',
    'variance_count', v_variance_count,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id,
    operation,
    idempotency_key,
    result,
    created_by
  )
  values (
    p_document_id,
    'complete_transfer',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function private.inventory_start_stock_count_impl(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
  v_capture_sequence bigint;
  v_line_count integer;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để bắt đầu kiểm kê.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác bắt đầu kiểm kê.';
  end if;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found then
    raise exception 'Không tìm thấy phiếu kiểm kê.';
  end if;

  if v_document.document_type <> 'stock_count' then
    raise exception 'Phiếu % không phải phiếu kiểm kê.', v_document.document_no;
  end if;

  if not (select private.inventory_can_access_warehouse(v_document.source_warehouse_id)) then
    raise exception 'Bạn không có quyền truy cập kho kiểm kê.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'start_stock_count';

  if found then
    if v_existing_key <> btrim(p_idempotency_key) then
      raise exception 'Phiếu đã bắt đầu kiểm bằng một idempotency key khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.status <> 'draft' then
    raise exception 'Chỉ phiếu nháp mới được bắt đầu kiểm. Trạng thái hiện tại: %.', v_document.status;
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id = v_document.source_warehouse_id
          and access.role in ('central_manager', 'branch_manager')
        )
      )
  ) then
    raise exception 'Chỉ quản lý kho mới được bắt đầu kiểm kê.';
  end if;

  select count(*)
  into v_line_count
  from public.inventory_document_lines line
  where line.document_id = p_document_id;

  if v_line_count = 0 then
    raise exception 'Phiếu kiểm kê chưa có mặt hàng.';
  end if;

  insert into public.inventory_stock_balances (
    warehouse_id,
    item_id,
    quantity,
    average_cost,
    updated_at
  )
  select
    v_document.source_warehouse_id,
    line.item_id,
    0,
    0,
    clock_timestamp()
  from public.inventory_document_lines line
  where line.document_id = p_document_id
  on conflict (warehouse_id, item_id) do nothing;

  perform balance.item_id
  from public.inventory_stock_balances balance
  join public.inventory_document_lines line
    on line.item_id = balance.item_id
   and line.document_id = p_document_id
  where balance.warehouse_id = v_document.source_warehouse_id
  order by balance.item_id
  for update of balance;

  select coalesce(max(movement.movement_sequence), 0)
  into v_capture_sequence
  from public.inventory_stock_movements movement;

  insert into public.inventory_stock_count_snapshots (
    document_id,
    warehouse_id,
    item_id,
    system_quantity,
    movement_sequence_at_capture,
    captured_at,
    created_at
  )
  select
    p_document_id,
    v_document.source_warehouse_id,
    line.item_id,
    balance.quantity,
    v_capture_sequence,
    clock_timestamp(),
    clock_timestamp()
  from public.inventory_document_lines line
  join public.inventory_stock_balances balance
    on balance.warehouse_id = v_document.source_warehouse_id
   and balance.item_id = line.item_id
  where line.document_id = p_document_id;

  update public.inventory_documents
  set status = 'counting'
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id, event_type, from_status, to_status, event_data, created_by
  )
  values (
    p_document_id,
    'stock_count_started',
    'draft',
    'counting',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'line_count', v_line_count,
      'movement_sequence_at_capture', v_capture_sequence
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'counting',
    'line_count', v_line_count,
    'movement_sequence_at_capture', v_capture_sequence,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id, operation, idempotency_key, result, created_by
  )
  values (
    p_document_id,
    'start_stock_count',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function private.inventory_record_stock_count_impl(
  p_document_id uuid,
  p_idempotency_key text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_existing_result jsonb;
  v_existing_document_id uuid;
  v_existing_operation text;
  v_result jsonb;
  v_payload_hash text;
  v_input_count integer;
  v_distinct_count integer;
  v_line_count integer;
  v_operation text;
  v_count_sequence bigint;
  v_count_time timestamptz;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để ghi số kiểm kê.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho lần ghi số kiểm kê.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Danh sách số kiểm kê không hợp lệ.';
  end if;

  select md5(coalesce(jsonb_agg(entry.value order by entry.value ->> 'line_id'), '[]'::jsonb)::text)
  into v_payload_hash
  from jsonb_array_elements(p_lines) entry;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found or v_document.document_type <> 'stock_count' then
    raise exception 'Không tìm thấy phiếu kiểm kê hợp lệ.';
  end if;

  if not (select private.inventory_can_access_warehouse(v_document.source_warehouse_id)) then
    raise exception 'Bạn không có quyền ghi số tại kho này.';
  end if;

  select operation.result, operation.document_id, operation.operation
  into v_existing_result, v_existing_document_id, v_existing_operation
  from public.inventory_document_operations operation
  where operation.idempotency_key = btrim(p_idempotency_key);

  if found then
    if v_existing_document_id <> p_document_id
       or v_existing_operation not like 'record_stock_count:%'
       or coalesce(v_existing_result ->> 'payload_hash', '') <> v_payload_hash then
      raise exception 'Idempotency key ghi số đang được dùng cho thao tác hoặc dữ liệu khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if v_document.status <> 'counting' then
    raise exception 'Chỉ được ghi số khi phiếu đang kiểm. Trạng thái hiện tại: %.', v_document.status;
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id = v_document.source_warehouse_id
          and access.role in ('central_manager', 'branch_manager', 'staff')
        )
      )
  ) then
    raise exception 'Tài khoản không được ghi số kiểm kê tại kho này.';
  end if;

  select count(*), count(distinct (entry.value ->> 'line_id')::uuid)
  into v_input_count, v_distinct_count
  from jsonb_array_elements(p_lines) entry;

  select count(*)
  into v_line_count
  from public.inventory_document_lines line
  where line.document_id = p_document_id;

  if v_input_count <> v_distinct_count or v_input_count <> v_line_count then
    raise exception 'Mỗi lần lưu phải có đúng một số đếm cho từng dòng trong phiếu.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) entry
    left join public.inventory_document_lines line
      on line.id = (entry.value ->> 'line_id')::uuid
     and line.document_id = p_document_id
    where line.id is null
       or nullif(entry.value ->> 'counted_quantity', '') is null
       or (entry.value ->> 'counted_quantity')::numeric < 0
  ) then
    raise exception 'Dòng kiểm kê không thuộc phiếu hoặc có số lượng không hợp lệ.';
  end if;

  perform balance.item_id
  from public.inventory_stock_balances balance
  join public.inventory_document_lines line
    on line.item_id = balance.item_id
   and line.document_id = p_document_id
  where balance.warehouse_id = v_document.source_warehouse_id
  order by balance.item_id
  for update of balance;

  select coalesce(max(movement.movement_sequence), 0)
  into v_count_sequence
  from public.inventory_stock_movements movement;
  v_count_time := clock_timestamp();

  update public.inventory_document_lines line
  set counted_quantity = (entry.value ->> 'counted_quantity')::numeric
  from jsonb_array_elements(p_lines) entry
  where line.id = (entry.value ->> 'line_id')::uuid
    and line.document_id = p_document_id;

  update public.inventory_stock_count_snapshots snapshot
  set movement_sequence_at_count = v_count_sequence,
      movement_quantity_until_count = coalesce((
        select sum(case when movement.direction = 'in' then movement.quantity else -movement.quantity end)
        from public.inventory_stock_movements movement
        where movement.warehouse_id = snapshot.warehouse_id
          and movement.item_id = snapshot.item_id
          and movement.movement_sequence > snapshot.movement_sequence_at_capture
          and movement.movement_sequence <= v_count_sequence
      ), 0),
      expected_quantity_at_count = snapshot.system_quantity + coalesce((
        select sum(case when movement.direction = 'in' then movement.quantity else -movement.quantity end)
        from public.inventory_stock_movements movement
        where movement.warehouse_id = snapshot.warehouse_id
          and movement.item_id = snapshot.item_id
          and movement.movement_sequence > snapshot.movement_sequence_at_capture
          and movement.movement_sequence <= v_count_sequence
      ), 0),
      counted_at = v_count_time
  where snapshot.document_id = p_document_id
    and snapshot.warehouse_id = v_document.source_warehouse_id;

  insert into public.inventory_document_events (
    document_id, event_type, from_status, to_status, event_data, created_by
  )
  values (
    p_document_id,
    'stock_count_recorded',
    'counting',
    'counting',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'payload_hash', v_payload_hash,
      'line_count', v_line_count,
      'movement_sequence_at_count', v_count_sequence
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'counting',
    'line_count', v_line_count,
    'movement_sequence_at_count', v_count_sequence,
    'payload_hash', v_payload_hash,
    'idempotent_replay', false
  );
  v_operation := 'record_stock_count:' || btrim(p_idempotency_key);

  insert into public.inventory_document_operations (
    document_id, operation, idempotency_key, result, created_by
  )
  values (
    p_document_id,
    v_operation,
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function private.inventory_submit_stock_count_impl(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
  v_submit_sequence bigint;
  v_submit_time timestamptz;
  v_variance_count integer;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để gửi kết quả kiểm kê.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác gửi kết quả kiểm kê.';
  end if;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found or v_document.document_type <> 'stock_count' then
    raise exception 'Không tìm thấy phiếu kiểm kê hợp lệ.';
  end if;

  if not (select private.inventory_can_access_warehouse(v_document.source_warehouse_id)) then
    raise exception 'Bạn không có quyền gửi kết quả của kho này.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'submit_stock_count';

  if found then
    if v_existing_key <> btrim(p_idempotency_key) then
      raise exception 'Kết quả kiểm kê đã được gửi bằng một idempotency key khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.status <> 'counting' then
    raise exception 'Phiếu phải đang kiểm trước khi gửi. Trạng thái hiện tại: %.', v_document.status;
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id = v_document.source_warehouse_id
          and access.role in ('central_manager', 'branch_manager', 'staff')
        )
      )
  ) then
    raise exception 'Tài khoản không được gửi kết quả kiểm kê tại kho này.';
  end if;

  if exists (
    select 1
    from public.inventory_document_lines line
    left join public.inventory_stock_count_snapshots snapshot
      on snapshot.document_id = line.document_id
     and snapshot.warehouse_id = v_document.source_warehouse_id
     and snapshot.item_id = line.item_id
    where line.document_id = p_document_id
      and (
        line.counted_quantity is null
        or snapshot.id is null
        or snapshot.expected_quantity_at_count is null
      )
  ) then
    raise exception 'Phiếu còn dòng chưa đếm hoặc thiếu snapshot lúc bắt đầu kiểm.';
  end if;

  perform balance.item_id
  from public.inventory_stock_balances balance
  join public.inventory_document_lines line
    on line.item_id = balance.item_id
   and line.document_id = p_document_id
  where balance.warehouse_id = v_document.source_warehouse_id
  order by balance.item_id
  for update of balance;

  select coalesce(max(movement.movement_sequence), 0)
  into v_submit_sequence
  from public.inventory_stock_movements movement;
  v_submit_time := clock_timestamp();

  update public.inventory_stock_count_snapshots snapshot
  set movement_sequence_until_submit = v_submit_sequence,
      movement_quantity_until_submit = coalesce((
        select sum(case when movement.direction = 'in' then movement.quantity else -movement.quantity end)
        from public.inventory_stock_movements movement
        where movement.warehouse_id = snapshot.warehouse_id
          and movement.item_id = snapshot.item_id
          and movement.movement_sequence > snapshot.movement_sequence_at_capture
          and movement.movement_sequence <= v_submit_sequence
      ), 0),
      expected_quantity_at_submit = snapshot.system_quantity + coalesce((
        select sum(case when movement.direction = 'in' then movement.quantity else -movement.quantity end)
        from public.inventory_stock_movements movement
        where movement.warehouse_id = snapshot.warehouse_id
          and movement.item_id = snapshot.item_id
          and movement.movement_sequence > snapshot.movement_sequence_at_capture
          and movement.movement_sequence <= v_submit_sequence
      ), 0),
      submitted_at = v_submit_time
  where snapshot.document_id = p_document_id
    and snapshot.warehouse_id = v_document.source_warehouse_id;

  select count(*)
  into v_variance_count
  from public.inventory_document_lines line
  join public.inventory_stock_count_snapshots snapshot
    on snapshot.document_id = line.document_id
   and snapshot.warehouse_id = v_document.source_warehouse_id
   and snapshot.item_id = line.item_id
  where line.document_id = p_document_id
    and line.counted_quantity * line.conversion_to_base <> snapshot.expected_quantity_at_count;

  update public.inventory_documents
  set status = 'submitted',
      submitted_at = v_submit_time,
      submitted_by = v_actor
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id, event_type, from_status, to_status, event_data, created_by
  )
  values (
    p_document_id,
    'stock_count_submitted',
    'counting',
    'submitted',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'movement_sequence_until_submit', v_submit_sequence,
      'variance_count', v_variance_count
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'submitted',
    'movement_sequence_until_submit', v_submit_sequence,
    'variance_count', v_variance_count,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id, operation, idempotency_key, result, created_by
  )
  values (
    p_document_id,
    'submit_stock_count',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function private.inventory_approve_stock_count_impl(
  p_document_id uuid,
  p_idempotency_key text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
  v_payload_hash text;
  v_input_count integer;
  v_distinct_count integer;
  v_line_count integer;
  v_variance_count integer;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để duyệt kiểm kê.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác duyệt kiểm kê.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Danh sách lý do chênh lệch không hợp lệ.';
  end if;

  select md5(coalesce(jsonb_agg(entry.value order by entry.value ->> 'line_id'), '[]'::jsonb)::text)
  into v_payload_hash
  from jsonb_array_elements(p_lines) entry;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found or v_document.document_type <> 'stock_count' then
    raise exception 'Không tìm thấy phiếu kiểm kê hợp lệ.';
  end if;

  if not (select private.inventory_can_access_warehouse(v_document.source_warehouse_id)) then
    raise exception 'Bạn không có quyền duyệt kiểm kê của kho này.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'approve_stock_count';

  if found then
    if v_existing_key <> btrim(p_idempotency_key)
       or coalesce(v_existing_result ->> 'payload_hash', '') <> v_payload_hash then
      raise exception 'Phiếu đã được duyệt bằng idempotency key hoặc dữ liệu khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.status <> 'submitted' then
    raise exception 'Chỉ phiếu đã gửi mới được duyệt. Trạng thái hiện tại: %.', v_document.status;
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id = v_document.source_warehouse_id
          and access.role in ('central_manager', 'branch_manager')
        )
      )
  ) then
    raise exception 'Chỉ quản lý kho mới được duyệt chênh lệch kiểm kê.';
  end if;

  select count(*), count(distinct (entry.value ->> 'line_id')::uuid)
  into v_input_count, v_distinct_count
  from jsonb_array_elements(p_lines) entry;

  select count(*)
  into v_line_count
  from public.inventory_document_lines line
  where line.document_id = p_document_id;

  if v_input_count <> v_distinct_count or v_input_count <> v_line_count then
    raise exception 'Danh sách duyệt phải có đúng một dòng cho mỗi mặt hàng.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) entry
    left join public.inventory_document_lines line
      on line.id = (entry.value ->> 'line_id')::uuid
     and line.document_id = p_document_id
    left join public.inventory_stock_count_snapshots snapshot
      on snapshot.document_id = line.document_id
     and snapshot.warehouse_id = v_document.source_warehouse_id
     and snapshot.item_id = line.item_id
    where line.id is null
       or snapshot.expected_quantity_at_count is null
       or (
         line.counted_quantity * line.conversion_to_base <> snapshot.expected_quantity_at_count
         and nullif(btrim(entry.value ->> 'variance_reason'), '') is null
       )
  ) then
    raise exception 'Dòng duyệt không hợp lệ hoặc thiếu lý do cho mặt hàng có chênh lệch.';
  end if;

  update public.inventory_document_lines line
  set variance_reason = nullif(btrim(entry.value ->> 'variance_reason'), '')
  from jsonb_array_elements(p_lines) entry
  where line.id = (entry.value ->> 'line_id')::uuid
    and line.document_id = p_document_id;

  select count(*)
  into v_variance_count
  from public.inventory_document_lines line
  join public.inventory_stock_count_snapshots snapshot
    on snapshot.document_id = line.document_id
   and snapshot.warehouse_id = v_document.source_warehouse_id
   and snapshot.item_id = line.item_id
  where line.document_id = p_document_id
    and line.counted_quantity * line.conversion_to_base <> snapshot.expected_quantity_at_count;

  update public.inventory_documents
  set status = 'approved',
      approved_at = clock_timestamp(),
      approved_by = v_actor
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id, event_type, from_status, to_status, event_data, created_by
  )
  values (
    p_document_id,
    'stock_count_approved',
    'submitted',
    'approved',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'payload_hash', v_payload_hash,
      'variance_count', v_variance_count
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'approved',
    'variance_count', v_variance_count,
    'payload_hash', v_payload_hash,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id, operation, idempotency_key, result, created_by
  )
  values (
    p_document_id,
    'approve_stock_count',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function private.inventory_complete_stock_count_impl(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
  v_line record;
  v_adjustment_document_id uuid;
  v_adjustment_line_id uuid;
  v_variance numeric(18,6);
  v_new_quantity numeric(18,6);
  v_average_cost numeric(18,2);
  v_allow_negative boolean;
  v_variance_count integer;
  v_movement_count integer := 0;
  v_total_amount numeric(18,2) := 0;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để hoàn tất kiểm kê.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác hoàn tất kiểm kê.';
  end if;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found or v_document.document_type <> 'stock_count' then
    raise exception 'Không tìm thấy phiếu kiểm kê hợp lệ.';
  end if;

  if not (select private.inventory_can_access_warehouse(v_document.source_warehouse_id)) then
    raise exception 'Bạn không có quyền hoàn tất kiểm kê của kho này.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'complete_stock_count';

  if found then
    if v_existing_key <> btrim(p_idempotency_key) then
      raise exception 'Phiếu đã hoàn tất bằng một idempotency key khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.status <> 'approved' then
    raise exception 'Chỉ phiếu đã duyệt mới được hoàn tất. Trạng thái hiện tại: %.', v_document.status;
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id = v_document.source_warehouse_id
          and access.role in ('central_manager', 'branch_manager')
        )
      )
  ) then
    raise exception 'Chỉ quản lý kho mới được hoàn tất và điều chỉnh tồn.';
  end if;

  select warehouse.allow_negative_stock
  into v_allow_negative
  from public.inventory_warehouses warehouse
  where warehouse.id = v_document.source_warehouse_id
    and warehouse.is_active;

  if not found then
    raise exception 'Kho kiểm kê không tồn tại hoặc đã ngừng hoạt động.';
  end if;

  if exists (
    select 1
    from public.inventory_document_lines line
    left join public.inventory_stock_count_snapshots snapshot
      on snapshot.document_id = line.document_id
     and snapshot.warehouse_id = v_document.source_warehouse_id
     and snapshot.item_id = line.item_id
    where line.document_id = p_document_id
      and (
        line.counted_quantity is null
        or snapshot.expected_quantity_at_count is null
        or (
          line.counted_quantity * line.conversion_to_base <> snapshot.expected_quantity_at_count
          and nullif(btrim(line.variance_reason), '') is null
        )
      )
  ) then
    raise exception 'Phiếu kiểm kê còn thiếu dữ liệu chốt hoặc lý do chênh lệch.';
  end if;

  perform balance.item_id
  from public.inventory_stock_balances balance
  join public.inventory_document_lines line
    on line.item_id = balance.item_id
   and line.document_id = p_document_id
  where balance.warehouse_id = v_document.source_warehouse_id
  order by balance.item_id
  for update of balance;

  select count(*)
  into v_variance_count
  from public.inventory_document_lines line
  join public.inventory_stock_count_snapshots snapshot
    on snapshot.document_id = line.document_id
   and snapshot.warehouse_id = v_document.source_warehouse_id
   and snapshot.item_id = line.item_id
  where line.document_id = p_document_id
    and line.counted_quantity * line.conversion_to_base <> snapshot.expected_quantity_at_count;

  if v_variance_count > 0 then
    v_adjustment_document_id := gen_random_uuid();

    insert into public.inventory_documents (
      id,
      document_no,
      idempotency_key,
      document_type,
      status,
      source_warehouse_id,
      source_document_id,
      occurred_at,
      notes,
      metadata,
      created_at,
      created_by,
      approved_at,
      approved_by,
      completed_at,
      completed_by
    )
    values (
      v_adjustment_document_id,
      'ADJ-COUNT-' || replace(v_adjustment_document_id::text, '-', ''),
      'stock-count-adjustment:' || p_document_id::text,
      'stock_adjustment',
      'completed',
      v_document.source_warehouse_id,
      p_document_id,
      clock_timestamp(),
      'Điều chỉnh tự động từ phiếu kiểm kê ' || v_document.document_no,
      jsonb_build_object('stock_count_document_id', p_document_id),
      clock_timestamp(),
      v_actor,
      clock_timestamp(),
      v_actor,
      clock_timestamp(),
      v_actor
    );

    for v_line in
      select
        line.*,
        item.base_unit_id,
        snapshot.expected_quantity_at_count,
        balance.quantity as current_quantity,
        balance.average_cost as current_average_cost
      from public.inventory_document_lines line
      join public.inventory_items item on item.id = line.item_id
      join public.inventory_stock_count_snapshots snapshot
        on snapshot.document_id = line.document_id
       and snapshot.warehouse_id = v_document.source_warehouse_id
       and snapshot.item_id = line.item_id
      join public.inventory_stock_balances balance
        on balance.warehouse_id = v_document.source_warehouse_id
       and balance.item_id = line.item_id
      where line.document_id = p_document_id
        and line.counted_quantity * line.conversion_to_base <> snapshot.expected_quantity_at_count
      order by line.item_id
    loop
      v_variance := v_line.counted_quantity * v_line.conversion_to_base - v_line.expected_quantity_at_count;
      v_new_quantity := v_line.current_quantity + v_variance;
      v_average_cost := v_line.current_average_cost;

      if not v_allow_negative and v_new_quantity < 0 then
        raise exception 'Điều chỉnh kiểm kê làm âm tồn mặt hàng %. Hiện có %, chênh lệch %.',
          v_line.item_id,
          v_line.current_quantity,
          v_variance;
      end if;

      v_adjustment_line_id := gen_random_uuid();

      insert into public.inventory_document_lines (
        id,
        document_id,
        item_id,
        unit_id,
        conversion_to_base,
        expected_quantity,
        approved_quantity,
        actual_quantity,
        base_quantity,
        unit_price,
        variance_reason,
        notes
      )
      values (
        v_adjustment_line_id,
        v_adjustment_document_id,
        v_line.item_id,
        v_line.base_unit_id,
        1,
        abs(v_variance),
        abs(v_variance),
        abs(v_variance),
        abs(v_variance),
        v_average_cost,
        v_line.variance_reason,
        'Chênh lệch từ phiếu kiểm kê ' || v_document.document_no
      );

      insert into public.inventory_stock_movements (
        warehouse_id,
        item_id,
        document_id,
        document_line_id,
        direction,
        movement_stage,
        quantity,
        unit_cost,
        occurred_at,
        created_by
      )
      values (
        v_document.source_warehouse_id,
        v_line.item_id,
        v_adjustment_document_id,
        v_adjustment_line_id,
        case when v_variance > 0 then 'in' else 'out' end,
        'adjustment',
        abs(v_variance),
        v_average_cost,
        clock_timestamp(),
        v_actor
      );

      update public.inventory_stock_balances
      set quantity = v_new_quantity,
          updated_at = clock_timestamp()
      where warehouse_id = v_document.source_warehouse_id
        and item_id = v_line.item_id;

      v_total_amount := v_total_amount + abs(v_variance) * v_average_cost;
      v_movement_count := v_movement_count + 1;
    end loop;

    update public.inventory_documents
    set total_amount = v_total_amount
    where id = v_adjustment_document_id;

    insert into public.inventory_document_events (
      document_id, event_type, from_status, to_status, event_data, created_by
    )
    values (
      v_adjustment_document_id,
      'created_from_stock_count',
      null,
      'completed',
      jsonb_build_object(
        'stock_count_document_id', p_document_id,
        'movement_count', v_movement_count
      ),
      v_actor
    );
  end if;

  update public.inventory_documents
  set status = 'completed',
      completed_at = clock_timestamp(),
      completed_by = v_actor
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id, event_type, from_status, to_status, event_data, created_by
  )
  values (
    p_document_id,
    'stock_count_completed',
    'approved',
    'completed',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'variance_count', v_variance_count,
      'movement_count', v_movement_count,
      'adjustment_document_id', v_adjustment_document_id
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'completed',
    'variance_count', v_variance_count,
    'movement_count', v_movement_count,
    'adjustment_document_id', v_adjustment_document_id,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id, operation, idempotency_key, result, created_by
  )
  values (
    p_document_id,
    'complete_stock_count',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function private.inventory_approve_requisition_impl(
  p_document_id uuid,
  p_idempotency_key text,
  p_source_warehouse_id uuid,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
  v_payload_hash text;
  v_input_count integer;
  v_distinct_count integer;
  v_line_count integer;
  v_approved_line_count integer;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để duyệt yêu cầu cấp hàng.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác duyệt yêu cầu.';
  end if;

  if p_source_warehouse_id is null then
    raise exception 'Chưa chọn kho nguồn cấp hàng.';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Danh sách số lượng duyệt không hợp lệ.';
  end if;

  select md5(coalesce(jsonb_agg(entry.value order by entry.value ->> 'line_id'), '[]'::jsonb)::text)
  into v_payload_hash
  from jsonb_array_elements(p_lines) entry;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found or v_document.document_type <> 'internal_requisition' then
    raise exception 'Không tìm thấy yêu cầu cấp hàng hợp lệ.';
  end if;

  if p_source_warehouse_id = v_document.destination_warehouse_id then
    raise exception 'Kho nguồn và kho nhận không được trùng nhau.';
  end if;

  if not exists (
    select 1
    from public.inventory_warehouses warehouse
    where warehouse.id = p_source_warehouse_id
      and warehouse.is_active
  ) then
    raise exception 'Kho nguồn không tồn tại hoặc đã ngừng hoạt động.';
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id = p_source_warehouse_id
          and access.role in ('central_manager', 'branch_manager')
        )
      )
  ) then
    raise exception 'Chỉ quản lý kho nguồn mới được duyệt yêu cầu.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'approve_requisition';

  if found then
    if v_existing_key <> btrim(p_idempotency_key)
       or coalesce(v_existing_result ->> 'payload_hash', '') <> v_payload_hash
       or coalesce(v_existing_result ->> 'source_warehouse_id', '') <> p_source_warehouse_id::text then
      raise exception 'Yêu cầu đã được duyệt bằng idempotency key hoặc dữ liệu khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.status <> 'submitted' then
    raise exception 'Chỉ yêu cầu đã gửi mới được duyệt. Trạng thái hiện tại: %.', v_document.status;
  end if;

  select count(*), count(distinct (entry.value ->> 'line_id')::uuid)
  into v_input_count, v_distinct_count
  from jsonb_array_elements(p_lines) entry;

  select count(*)
  into v_line_count
  from public.inventory_document_lines line
  where line.document_id = p_document_id;

  if v_input_count <> v_distinct_count or v_input_count <> v_line_count then
    raise exception 'Danh sách duyệt phải có đúng một dòng cho mỗi mặt hàng.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_lines) entry
    left join public.inventory_document_lines line
      on line.id = (entry.value ->> 'line_id')::uuid
     and line.document_id = p_document_id
    where line.id is null
       or nullif(entry.value ->> 'approved_quantity', '') is null
       or (entry.value ->> 'approved_quantity')::numeric < 0
       or (entry.value ->> 'approved_quantity')::numeric > line.expected_quantity
       or (
         (entry.value ->> 'approved_quantity')::numeric < line.expected_quantity
         and nullif(btrim(entry.value ->> 'rejection_reason'), '') is null
       )
  ) then
    raise exception 'Số lượng duyệt không hợp lệ, vượt yêu cầu hoặc thiếu lý do cắt giảm.';
  end if;

  select count(*)
  into v_approved_line_count
  from jsonb_array_elements(p_lines) entry
  where (entry.value ->> 'approved_quantity')::numeric > 0;

  if v_approved_line_count = 0 then
    raise exception 'Không có mặt hàng nào được duyệt; hãy dùng thao tác từ chối yêu cầu.';
  end if;

  update public.inventory_document_lines line
  set approved_quantity = (entry.value ->> 'approved_quantity')::numeric,
      rejection_reason = nullif(btrim(entry.value ->> 'rejection_reason'), '')
  from jsonb_array_elements(p_lines) entry
  where line.id = (entry.value ->> 'line_id')::uuid
    and line.document_id = p_document_id;

  update public.inventory_documents
  set source_warehouse_id = p_source_warehouse_id,
      status = 'approved',
      approved_at = clock_timestamp(),
      approved_by = v_actor
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id, event_type, from_status, to_status, event_data, created_by
  )
  values (
    p_document_id,
    'requisition_approved',
    'submitted',
    'approved',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'payload_hash', v_payload_hash,
      'source_warehouse_id', p_source_warehouse_id,
      'approved_line_count', v_approved_line_count
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'approved',
    'source_warehouse_id', p_source_warehouse_id,
    'approved_line_count', v_approved_line_count,
    'payload_hash', v_payload_hash,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id, operation, idempotency_key, result, created_by
  )
  values (
    p_document_id,
    'approve_requisition',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function private.inventory_reject_requisition_impl(
  p_document_id uuid,
  p_idempotency_key text,
  p_source_warehouse_id uuid,
  p_rejection_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để từ chối yêu cầu cấp hàng.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác từ chối yêu cầu.';
  end if;

  if p_source_warehouse_id is null or nullif(btrim(p_rejection_reason), '') is null then
    raise exception 'Kho nguồn và lý do từ chối là bắt buộc.';
  end if;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found or v_document.document_type <> 'internal_requisition' then
    raise exception 'Không tìm thấy yêu cầu cấp hàng hợp lệ.';
  end if;

  if p_source_warehouse_id = v_document.destination_warehouse_id then
    raise exception 'Kho nguồn và kho nhận không được trùng nhau.';
  end if;

  if not exists (
    select 1
    from public.inventory_warehouses warehouse
    where warehouse.id = p_source_warehouse_id
      and warehouse.is_active
  ) then
    raise exception 'Kho nguồn không tồn tại hoặc đã ngừng hoạt động.';
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id = p_source_warehouse_id
          and access.role in ('central_manager', 'branch_manager')
        )
      )
  ) then
    raise exception 'Chỉ quản lý kho nguồn mới được từ chối yêu cầu.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'reject_requisition';

  if found then
    if v_existing_key <> btrim(p_idempotency_key)
       or coalesce(v_existing_result ->> 'source_warehouse_id', '') <> p_source_warehouse_id::text
       or coalesce(v_existing_result ->> 'rejection_reason', '') <> btrim(p_rejection_reason) then
      raise exception 'Yêu cầu đã bị từ chối bằng idempotency key hoặc dữ liệu khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.status <> 'submitted' then
    raise exception 'Chỉ yêu cầu đã gửi mới được từ chối. Trạng thái hiện tại: %.', v_document.status;
  end if;

  update public.inventory_documents
  set source_warehouse_id = p_source_warehouse_id,
      status = 'rejected',
      rejected_at = clock_timestamp(),
      rejected_by = v_actor,
      rejection_reason = btrim(p_rejection_reason)
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id, event_type, from_status, to_status, event_data, created_by
  )
  values (
    p_document_id,
    'requisition_rejected',
    'submitted',
    'rejected',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'source_warehouse_id', p_source_warehouse_id,
      'rejection_reason', btrim(p_rejection_reason)
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'rejected',
    'source_warehouse_id', p_source_warehouse_id,
    'rejection_reason', btrim(p_rejection_reason),
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id, operation, idempotency_key, result, created_by
  )
  values (
    p_document_id,
    'reject_requisition',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function private.inventory_create_requisition_transfer_impl(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
  v_transfer_id uuid;
  v_transfer_line_count integer;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để tạo phiếu chuyển từ yêu cầu.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác tạo phiếu chuyển.';
  end if;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found or v_document.document_type <> 'internal_requisition' then
    raise exception 'Không tìm thấy yêu cầu cấp hàng hợp lệ.';
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id = v_document.source_warehouse_id
          and access.role in ('central_manager', 'branch_manager', 'staff')
        )
      )
  ) then
    raise exception 'Tài khoản không được chuẩn bị hàng tại kho nguồn.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'create_requisition_transfer';

  if found then
    if v_existing_key <> btrim(p_idempotency_key) then
      raise exception 'Phiếu chuyển đã được tạo bằng một idempotency key khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.status <> 'approved' then
    raise exception 'Chỉ yêu cầu đã duyệt mới sinh được phiếu chuyển. Trạng thái hiện tại: %.', v_document.status;
  end if;

  if 2 <> (
    select count(distinct warehouse.id)
    from public.inventory_warehouses warehouse
    where warehouse.id in (v_document.source_warehouse_id, v_document.destination_warehouse_id)
      and warehouse.is_active
  ) then
    raise exception 'Kho nguồn hoặc kho nhận không tồn tại hay đã ngừng hoạt động.';
  end if;

  if exists (
    select 1
    from public.inventory_documents transfer
    where transfer.document_type = 'transfer'
      and transfer.source_document_id = p_document_id
  ) then
    raise exception 'Yêu cầu đã có phiếu chuyển liên kết nhưng thiếu operation audit.';
  end if;

  if not exists (
    select 1
    from public.inventory_document_lines line
    where line.document_id = p_document_id
      and coalesce(line.approved_quantity, 0) > 0
  ) then
    raise exception 'Yêu cầu không có mặt hàng được duyệt để tạo phiếu chuyển.';
  end if;

  v_transfer_id := gen_random_uuid();

  insert into public.inventory_documents (
    id,
    document_no,
    idempotency_key,
    document_type,
    status,
    source_warehouse_id,
    destination_warehouse_id,
    source_document_id,
    reference_no,
    occurred_at,
    notes,
    metadata,
    created_at,
    created_by
  )
  values (
    v_transfer_id,
    'TRF-REQ-' || replace(v_transfer_id::text, '-', ''),
    'requisition-transfer:' || p_document_id::text,
    'transfer',
    'draft',
    v_document.source_warehouse_id,
    v_document.destination_warehouse_id,
    p_document_id,
    v_document.document_no,
    clock_timestamp(),
    'Phiếu chuyển sinh từ yêu cầu cấp hàng ' || v_document.document_no,
    jsonb_build_object('requisition_document_id', p_document_id),
    clock_timestamp(),
    v_actor
  );

  insert into public.inventory_document_lines (
    document_id,
    item_id,
    unit_id,
    conversion_to_base,
    expected_quantity,
    approved_quantity,
    base_quantity,
    unit_price,
    notes
  )
  select
    v_transfer_id,
    line.item_id,
    line.unit_id,
    line.conversion_to_base,
    line.approved_quantity,
    line.approved_quantity,
    line.approved_quantity * line.conversion_to_base,
    line.unit_price,
    'Từ dòng yêu cầu ' || line.id::text
  from public.inventory_document_lines line
  where line.document_id = p_document_id
    and coalesce(line.approved_quantity, 0) > 0;

  get diagnostics v_transfer_line_count = row_count;

  insert into public.inventory_document_events (
    document_id, event_type, from_status, to_status, event_data, created_by
  )
  values
  (
    p_document_id,
    'requisition_transfer_created',
    'approved',
    'approved',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'transfer_document_id', v_transfer_id,
      'line_count', v_transfer_line_count
    ),
    v_actor
  ),
  (
    v_transfer_id,
    'created_from_requisition',
    null,
    'draft',
    jsonb_build_object('requisition_document_id', p_document_id),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'approved',
    'transfer_document_id', v_transfer_id,
    'transfer_status', 'draft',
    'line_count', v_transfer_line_count,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id, operation, idempotency_key, result, created_by
  )
  values (
    p_document_id,
    'create_requisition_transfer',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function private.inventory_fulfill_requisition_impl(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_document public.inventory_documents%rowtype;
  v_transfer_id uuid;
  v_existing_result jsonb;
  v_existing_key text;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'Bạn cần đăng nhập để hoàn tất yêu cầu cấp hàng.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Thiếu idempotency key cho thao tác hoàn tất yêu cầu.';
  end if;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = p_document_id
  for update;

  if not found or v_document.document_type <> 'internal_requisition' then
    raise exception 'Không tìm thấy yêu cầu cấp hàng hợp lệ.';
  end if;

  if not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = v_actor
      and access.is_active
      and (
        access.role in ('owner', 'admin')
        or (
          access.warehouse_id in (
            v_document.source_warehouse_id,
            v_document.destination_warehouse_id
          )
          and access.role in ('central_manager', 'branch_manager', 'staff')
        )
      )
  ) then
    raise exception 'Bạn không có quyền hoàn tất yêu cầu của hai kho này.';
  end if;

  select operation.result, operation.idempotency_key
  into v_existing_result, v_existing_key
  from public.inventory_document_operations operation
  where operation.document_id = p_document_id
    and operation.operation = 'fulfill_requisition';

  if found then
    if v_existing_key <> btrim(p_idempotency_key) then
      raise exception 'Yêu cầu đã hoàn tất bằng một idempotency key khác.';
    end if;
    return v_existing_result || jsonb_build_object('idempotent_replay', true);
  end if;

  if exists (
    select 1
    from public.inventory_document_operations operation
    where operation.idempotency_key = btrim(p_idempotency_key)
  ) then
    raise exception 'Idempotency key đã được dùng cho thao tác khác.';
  end if;

  if v_document.status <> 'approved' then
    raise exception 'Yêu cầu phải ở trạng thái approved trước khi hoàn tất. Trạng thái hiện tại: %.', v_document.status;
  end if;

  select transfer.id
  into v_transfer_id
  from public.inventory_documents transfer
  where transfer.document_type = 'transfer'
    and transfer.source_document_id = p_document_id
    and transfer.status = 'completed';

  if not found then
    raise exception 'Phiếu chuyển liên kết chưa hoàn tất nên yêu cầu chưa thể chuyển sang fulfilled.';
  end if;

  update public.inventory_documents
  set status = 'fulfilled',
      completed_at = clock_timestamp(),
      completed_by = v_actor
  where id = p_document_id;

  insert into public.inventory_document_events (
    document_id, event_type, from_status, to_status, event_data, created_by
  )
  values (
    p_document_id,
    'requisition_fulfilled',
    'approved',
    'fulfilled',
    jsonb_build_object(
      'idempotency_key', btrim(p_idempotency_key),
      'transfer_document_id', v_transfer_id
    ),
    v_actor
  );

  v_result := jsonb_build_object(
    'ok', true,
    'document_id', p_document_id,
    'status', 'fulfilled',
    'transfer_document_id', v_transfer_id,
    'idempotent_replay', false
  );

  insert into public.inventory_document_operations (
    document_id, operation, idempotency_key, result, created_by
  )
  values (
    p_document_id,
    'fulfill_requisition',
    btrim(p_idempotency_key),
    v_result,
    v_actor
  );

  return v_result;
end;
$$;

create or replace function public.inventory_submit_document(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_submit_document_impl(p_document_id, p_idempotency_key);
$$;

create or replace function public.inventory_complete_simple_document(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_complete_simple_document_impl(p_document_id, p_idempotency_key);
$$;

create or replace function public.inventory_dispatch_transfer(
  p_document_id uuid,
  p_idempotency_key text,
  p_lines jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_dispatch_transfer_impl(p_document_id, p_idempotency_key, p_lines);
$$;

create or replace function public.inventory_receive_transfer(
  p_document_id uuid,
  p_idempotency_key text,
  p_lines jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_receive_transfer_impl(p_document_id, p_idempotency_key, p_lines);
$$;

create or replace function public.inventory_complete_transfer(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_complete_transfer_impl(p_document_id, p_idempotency_key);
$$;

create or replace function public.inventory_start_stock_count(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_start_stock_count_impl(p_document_id, p_idempotency_key);
$$;

create or replace function public.inventory_record_stock_count(
  p_document_id uuid,
  p_idempotency_key text,
  p_lines jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_record_stock_count_impl(p_document_id, p_idempotency_key, p_lines);
$$;

create or replace function public.inventory_submit_stock_count(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_submit_stock_count_impl(p_document_id, p_idempotency_key);
$$;

create or replace function public.inventory_approve_stock_count(
  p_document_id uuid,
  p_idempotency_key text,
  p_lines jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_approve_stock_count_impl(p_document_id, p_idempotency_key, p_lines);
$$;

create or replace function public.inventory_complete_stock_count(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_complete_stock_count_impl(p_document_id, p_idempotency_key);
$$;

create or replace function public.inventory_approve_requisition(
  p_document_id uuid,
  p_idempotency_key text,
  p_source_warehouse_id uuid,
  p_lines jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_approve_requisition_impl(
    p_document_id,
    p_idempotency_key,
    p_source_warehouse_id,
    p_lines
  );
$$;

create or replace function public.inventory_reject_requisition(
  p_document_id uuid,
  p_idempotency_key text,
  p_source_warehouse_id uuid,
  p_rejection_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_reject_requisition_impl(
    p_document_id,
    p_idempotency_key,
    p_source_warehouse_id,
    p_rejection_reason
  );
$$;

create or replace function public.inventory_create_requisition_transfer(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_create_requisition_transfer_impl(p_document_id, p_idempotency_key);
$$;

create or replace function public.inventory_fulfill_requisition(
  p_document_id uuid,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.inventory_fulfill_requisition_impl(p_document_id, p_idempotency_key);
$$;

revoke all on function private.inventory_is_admin() from public;
revoke all on function private.inventory_can_access_warehouse(uuid) from public;
revoke all on function private.inventory_can_manage_purchasing() from public;
revoke all on function private.inventory_submit_document_impl(uuid, text) from public;
revoke all on function private.inventory_complete_simple_document_impl(uuid, text) from public;
revoke all on function private.inventory_dispatch_transfer_impl(uuid, text, jsonb) from public;
revoke all on function private.inventory_receive_transfer_impl(uuid, text, jsonb) from public;
revoke all on function private.inventory_complete_transfer_impl(uuid, text) from public;
revoke all on function private.inventory_start_stock_count_impl(uuid, text) from public;
revoke all on function private.inventory_record_stock_count_impl(uuid, text, jsonb) from public;
revoke all on function private.inventory_submit_stock_count_impl(uuid, text) from public;
revoke all on function private.inventory_approve_stock_count_impl(uuid, text, jsonb) from public;
revoke all on function private.inventory_complete_stock_count_impl(uuid, text) from public;
revoke all on function private.inventory_approve_requisition_impl(uuid, text, uuid, jsonb) from public;
revoke all on function private.inventory_reject_requisition_impl(uuid, text, uuid, text) from public;
revoke all on function private.inventory_create_requisition_transfer_impl(uuid, text) from public;
revoke all on function private.inventory_fulfill_requisition_impl(uuid, text) from public;
revoke all on function public.inventory_submit_document(uuid, text) from public;
revoke all on function public.inventory_complete_simple_document(uuid, text) from public;
revoke all on function public.inventory_dispatch_transfer(uuid, text, jsonb) from public;
revoke all on function public.inventory_receive_transfer(uuid, text, jsonb) from public;
revoke all on function public.inventory_complete_transfer(uuid, text) from public;
revoke all on function public.inventory_start_stock_count(uuid, text) from public;
revoke all on function public.inventory_record_stock_count(uuid, text, jsonb) from public;
revoke all on function public.inventory_submit_stock_count(uuid, text) from public;
revoke all on function public.inventory_approve_stock_count(uuid, text, jsonb) from public;
revoke all on function public.inventory_complete_stock_count(uuid, text) from public;
revoke all on function public.inventory_approve_requisition(uuid, text, uuid, jsonb) from public;
revoke all on function public.inventory_reject_requisition(uuid, text, uuid, text) from public;
revoke all on function public.inventory_create_requisition_transfer(uuid, text) from public;
revoke all on function public.inventory_fulfill_requisition(uuid, text) from public;

-- Supabase local/cloud may auto-grant newly created public functions to `anon`.
-- Revoke explicitly after every inventory function has been created so unauthenticated
-- callers cannot reach either the public RPC wrappers or their private implementations.
do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select procedure.oid::regprocedure
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname in ('public', 'private')
      and procedure.proname like 'inventory\_%' escape '\'
  loop
    execute format('revoke all on function %s from anon', v_function);
  end loop;
end;
$$;

grant usage on schema private to authenticated;
grant execute on function private.inventory_is_admin() to authenticated;
grant execute on function private.inventory_can_access_warehouse(uuid) to authenticated;
grant execute on function private.inventory_can_manage_purchasing() to authenticated;
grant execute on function private.inventory_submit_document_impl(uuid, text) to authenticated;
grant execute on function private.inventory_complete_simple_document_impl(uuid, text) to authenticated;
grant execute on function private.inventory_dispatch_transfer_impl(uuid, text, jsonb) to authenticated;
grant execute on function private.inventory_receive_transfer_impl(uuid, text, jsonb) to authenticated;
grant execute on function private.inventory_complete_transfer_impl(uuid, text) to authenticated;
grant execute on function private.inventory_start_stock_count_impl(uuid, text) to authenticated;
grant execute on function private.inventory_record_stock_count_impl(uuid, text, jsonb) to authenticated;
grant execute on function private.inventory_submit_stock_count_impl(uuid, text) to authenticated;
grant execute on function private.inventory_approve_stock_count_impl(uuid, text, jsonb) to authenticated;
grant execute on function private.inventory_complete_stock_count_impl(uuid, text) to authenticated;
grant execute on function private.inventory_approve_requisition_impl(uuid, text, uuid, jsonb) to authenticated;
grant execute on function private.inventory_reject_requisition_impl(uuid, text, uuid, text) to authenticated;
grant execute on function private.inventory_create_requisition_transfer_impl(uuid, text) to authenticated;
grant execute on function private.inventory_fulfill_requisition_impl(uuid, text) to authenticated;
grant execute on function public.inventory_submit_document(uuid, text) to authenticated;
grant execute on function public.inventory_complete_simple_document(uuid, text) to authenticated;
grant execute on function public.inventory_dispatch_transfer(uuid, text, jsonb) to authenticated;
grant execute on function public.inventory_receive_transfer(uuid, text, jsonb) to authenticated;
grant execute on function public.inventory_complete_transfer(uuid, text) to authenticated;
grant execute on function public.inventory_start_stock_count(uuid, text) to authenticated;
grant execute on function public.inventory_record_stock_count(uuid, text, jsonb) to authenticated;
grant execute on function public.inventory_submit_stock_count(uuid, text) to authenticated;
grant execute on function public.inventory_approve_stock_count(uuid, text, jsonb) to authenticated;
grant execute on function public.inventory_complete_stock_count(uuid, text) to authenticated;
grant execute on function public.inventory_approve_requisition(uuid, text, uuid, jsonb) to authenticated;
grant execute on function public.inventory_reject_requisition(uuid, text, uuid, text) to authenticated;
grant execute on function public.inventory_create_requisition_transfer(uuid, text) to authenticated;
grant execute on function public.inventory_fulfill_requisition(uuid, text) to authenticated;

alter table public.inventory_warehouses enable row level security;
alter table public.inventory_user_access enable row level security;
alter table public.inventory_units enable row level security;
alter table public.inventory_item_groups enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_suppliers enable row level security;
alter table public.inventory_supplier_items enable row level security;
alter table public.inventory_documents enable row level security;
alter table public.inventory_document_lines enable row level security;
alter table public.inventory_stock_count_snapshots enable row level security;
alter table public.inventory_stock_balances enable row level security;
alter table public.inventory_stock_movements enable row level security;
alter table public.inventory_document_events enable row level security;
alter table public.inventory_document_operations enable row level security;

drop policy if exists inventory_warehouses_select on public.inventory_warehouses;
create policy inventory_warehouses_select
on public.inventory_warehouses for select to authenticated
using ((select private.inventory_is_admin()) or (select private.inventory_can_access_warehouse(id)));

drop policy if exists inventory_warehouses_admin_write on public.inventory_warehouses;
drop policy if exists inventory_warehouses_admin_insert on public.inventory_warehouses;
create policy inventory_warehouses_admin_insert
on public.inventory_warehouses for insert to authenticated
with check ((select private.inventory_is_admin()));
drop policy if exists inventory_warehouses_admin_update on public.inventory_warehouses;
create policy inventory_warehouses_admin_update
on public.inventory_warehouses for update to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));
drop policy if exists inventory_warehouses_admin_delete on public.inventory_warehouses;
create policy inventory_warehouses_admin_delete
on public.inventory_warehouses for delete to authenticated
using ((select private.inventory_is_admin()));

drop policy if exists inventory_user_access_select on public.inventory_user_access;
create policy inventory_user_access_select
on public.inventory_user_access for select to authenticated
using (auth_user_id = (select auth.uid()) or (select private.inventory_is_admin()));

drop policy if exists inventory_user_access_admin_write on public.inventory_user_access;
drop policy if exists inventory_user_access_admin_insert on public.inventory_user_access;
create policy inventory_user_access_admin_insert
on public.inventory_user_access for insert to authenticated
with check ((select private.inventory_is_admin()));
drop policy if exists inventory_user_access_admin_update on public.inventory_user_access;
create policy inventory_user_access_admin_update
on public.inventory_user_access for update to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));
drop policy if exists inventory_user_access_admin_delete on public.inventory_user_access;
create policy inventory_user_access_admin_delete
on public.inventory_user_access for delete to authenticated
using ((select private.inventory_is_admin()));

drop policy if exists inventory_units_select on public.inventory_units;
create policy inventory_units_select
on public.inventory_units for select to authenticated using (true);
drop policy if exists inventory_units_admin_write on public.inventory_units;
drop policy if exists inventory_units_admin_insert on public.inventory_units;
create policy inventory_units_admin_insert
on public.inventory_units for insert to authenticated
with check ((select private.inventory_is_admin()));
drop policy if exists inventory_units_admin_update on public.inventory_units;
create policy inventory_units_admin_update
on public.inventory_units for update to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));
drop policy if exists inventory_units_admin_delete on public.inventory_units;
create policy inventory_units_admin_delete
on public.inventory_units for delete to authenticated
using ((select private.inventory_is_admin()));

drop policy if exists inventory_item_groups_select on public.inventory_item_groups;
create policy inventory_item_groups_select
on public.inventory_item_groups for select to authenticated using (true);
drop policy if exists inventory_item_groups_admin_write on public.inventory_item_groups;
drop policy if exists inventory_item_groups_admin_insert on public.inventory_item_groups;
create policy inventory_item_groups_admin_insert
on public.inventory_item_groups for insert to authenticated
with check ((select private.inventory_is_admin()));
drop policy if exists inventory_item_groups_admin_update on public.inventory_item_groups;
create policy inventory_item_groups_admin_update
on public.inventory_item_groups for update to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));
drop policy if exists inventory_item_groups_admin_delete on public.inventory_item_groups;
create policy inventory_item_groups_admin_delete
on public.inventory_item_groups for delete to authenticated
using ((select private.inventory_is_admin()));

drop policy if exists inventory_items_select on public.inventory_items;
create policy inventory_items_select
on public.inventory_items for select to authenticated using (true);
drop policy if exists inventory_items_admin_write on public.inventory_items;
drop policy if exists inventory_items_admin_insert on public.inventory_items;
create policy inventory_items_admin_insert
on public.inventory_items for insert to authenticated
with check ((select private.inventory_is_admin()));
drop policy if exists inventory_items_admin_update on public.inventory_items;
create policy inventory_items_admin_update
on public.inventory_items for update to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));
drop policy if exists inventory_items_admin_delete on public.inventory_items;
create policy inventory_items_admin_delete
on public.inventory_items for delete to authenticated
using ((select private.inventory_is_admin()));

drop policy if exists inventory_suppliers_select on public.inventory_suppliers;
create policy inventory_suppliers_select
on public.inventory_suppliers for select to authenticated
using ((select private.inventory_can_manage_purchasing()));
drop policy if exists inventory_suppliers_admin_write on public.inventory_suppliers;
drop policy if exists inventory_suppliers_admin_insert on public.inventory_suppliers;
create policy inventory_suppliers_admin_insert
on public.inventory_suppliers for insert to authenticated
with check ((select private.inventory_is_admin()));
drop policy if exists inventory_suppliers_admin_update on public.inventory_suppliers;
create policy inventory_suppliers_admin_update
on public.inventory_suppliers for update to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));
drop policy if exists inventory_suppliers_admin_delete on public.inventory_suppliers;
create policy inventory_suppliers_admin_delete
on public.inventory_suppliers for delete to authenticated
using ((select private.inventory_is_admin()));

drop policy if exists inventory_supplier_items_select on public.inventory_supplier_items;
create policy inventory_supplier_items_select
on public.inventory_supplier_items for select to authenticated
using ((select private.inventory_can_manage_purchasing()));
drop policy if exists inventory_supplier_items_admin_write on public.inventory_supplier_items;
drop policy if exists inventory_supplier_items_admin_insert on public.inventory_supplier_items;
create policy inventory_supplier_items_admin_insert
on public.inventory_supplier_items for insert to authenticated
with check ((select private.inventory_is_admin()));
drop policy if exists inventory_supplier_items_admin_update on public.inventory_supplier_items;
create policy inventory_supplier_items_admin_update
on public.inventory_supplier_items for update to authenticated
using ((select private.inventory_is_admin()))
with check ((select private.inventory_is_admin()));
drop policy if exists inventory_supplier_items_admin_delete on public.inventory_supplier_items;
create policy inventory_supplier_items_admin_delete
on public.inventory_supplier_items for delete to authenticated
using ((select private.inventory_is_admin()));

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
  and status = 'draft'
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
  status = 'draft'
  and (
    (select private.inventory_is_admin())
    or (source_warehouse_id is not null and (select private.inventory_can_access_warehouse(source_warehouse_id)))
    or (destination_warehouse_id is not null and (select private.inventory_can_access_warehouse(destination_warehouse_id)))
  )
)
with check (
  status = 'draft'
  and (
    (select private.inventory_is_admin())
    or (source_warehouse_id is not null and (select private.inventory_can_access_warehouse(source_warehouse_id)))
    or (destination_warehouse_id is not null and (select private.inventory_can_access_warehouse(destination_warehouse_id)))
  )
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
drop policy if exists inventory_document_lines_insert_draft on public.inventory_document_lines;
create policy inventory_document_lines_insert_draft
on public.inventory_document_lines for insert to authenticated
with check (
  exists (
    select 1 from public.inventory_documents document
    where document.id = document_id
      and document.status = 'draft'
  )
);

drop policy if exists inventory_document_lines_update_draft on public.inventory_document_lines;
create policy inventory_document_lines_update_draft
on public.inventory_document_lines for update to authenticated
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

drop policy if exists inventory_document_lines_delete_draft on public.inventory_document_lines;
create policy inventory_document_lines_delete_draft
on public.inventory_document_lines for delete to authenticated
using (
  exists (
    select 1 from public.inventory_documents document
    where document.id = document_id
      and document.status = 'draft'
  )
);

drop policy if exists inventory_stock_count_snapshots_select on public.inventory_stock_count_snapshots;
create policy inventory_stock_count_snapshots_select
on public.inventory_stock_count_snapshots for select to authenticated
using (
  exists (
    select 1
    from public.inventory_documents document
    where document.id = document_id
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

drop policy if exists inventory_document_events_select on public.inventory_document_events;
create policy inventory_document_events_select
on public.inventory_document_events for select to authenticated
using (
  exists (
    select 1
    from public.inventory_documents document
    where document.id = document_id
  )
);

drop policy if exists inventory_document_operations_select on public.inventory_document_operations;
create policy inventory_document_operations_select
on public.inventory_document_operations for select to authenticated
using (
  exists (
    select 1
    from public.inventory_documents document
    where document.id = document_id
  )
);

revoke all on table
  public.inventory_warehouses,
  public.inventory_user_access,
  public.inventory_units,
  public.inventory_item_groups,
  public.inventory_items,
  public.inventory_suppliers,
  public.inventory_supplier_items,
  public.inventory_documents,
  public.inventory_document_lines,
  public.inventory_stock_count_snapshots,
  public.inventory_stock_balances,
  public.inventory_stock_movements,
  public.inventory_document_events,
  public.inventory_document_operations
from anon, authenticated;

grant select on table
  public.inventory_warehouses,
  public.inventory_user_access,
  public.inventory_units,
  public.inventory_item_groups,
  public.inventory_items,
  public.inventory_suppliers,
  public.inventory_supplier_items,
  public.inventory_documents,
  public.inventory_document_lines,
  public.inventory_stock_count_snapshots,
  public.inventory_stock_balances,
  public.inventory_stock_movements,
  public.inventory_document_events,
  public.inventory_document_operations
to authenticated;

grant insert, update on table
  public.inventory_warehouses,
  public.inventory_user_access,
  public.inventory_units,
  public.inventory_item_groups,
  public.inventory_items,
  public.inventory_suppliers,
  public.inventory_supplier_items
to authenticated;

grant insert (
  document_no,
  idempotency_key,
  document_type,
  status,
  source_warehouse_id,
  destination_warehouse_id,
  supplier_id,
  reference_no,
  occurred_at,
  notes,
  total_amount,
  metadata,
  created_by
) on public.inventory_documents to authenticated;

grant update (
  document_type,
  source_warehouse_id,
  destination_warehouse_id,
  supplier_id,
  reference_no,
  occurred_at,
  notes,
  total_amount,
  metadata
) on public.inventory_documents to authenticated;

grant insert (
  document_id,
  item_id,
  unit_id,
  conversion_to_base,
  expected_quantity,
  actual_quantity,
  unit_price,
  variance_reason,
  notes
) on public.inventory_document_lines to authenticated;

grant update (
  item_id,
  unit_id,
  conversion_to_base,
  expected_quantity,
  actual_quantity,
  unit_price,
  variance_reason,
  notes
) on public.inventory_document_lines to authenticated;

grant delete on table public.inventory_document_lines to authenticated;

notify pgrst, 'reload schema';
