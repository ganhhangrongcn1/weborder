alter table public.inventory_document_lines
  add column if not exists lot_number text,
  add column if not exists manufactured_on date,
  add column if not exists expires_on date;

alter table public.inventory_document_lines
  drop constraint if exists inventory_document_lines_expiry_dates_check;

alter table public.inventory_document_lines
  add constraint inventory_document_lines_expiry_dates_check check (
    manufactured_on is null
    or expires_on is null
    or expires_on >= manufactured_on
  );

create table if not exists public.inventory_stock_lots (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.inventory_warehouses(id),
  item_id uuid not null references public.inventory_items(id),
  source_document_id uuid not null references public.inventory_documents(id),
  source_document_line_id uuid not null references public.inventory_document_lines(id),
  lot_number text not null check (nullif(btrim(lot_number), '') is not null),
  manufactured_on date,
  expires_on date,
  received_quantity numeric(18,6) not null check (received_quantity > 0),
  remaining_quantity numeric(18,6) not null check (
    remaining_quantity >= 0
    and remaining_quantity <= received_quantity
  ),
  unit_cost numeric(18,2) not null default 0 check (unit_cost >= 0),
  status text not null default 'active' check (status in ('active', 'depleted', 'blocked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (source_document_line_id),
  constraint inventory_stock_lots_expiry_dates_check check (
    manufactured_on is null
    or expires_on is null
    or expires_on >= manufactured_on
  )
);

create index if not exists inventory_stock_lots_warehouse_item_expiry_idx
  on public.inventory_stock_lots (warehouse_id, item_id, expires_on, created_at)
  where remaining_quantity > 0 and status = 'active';

create index if not exists inventory_stock_lots_expiry_warning_idx
  on public.inventory_stock_lots (expires_on, warehouse_id)
  where expires_on is not null and remaining_quantity > 0 and status = 'active';

create index if not exists inventory_stock_lots_lot_number_idx
  on public.inventory_stock_lots (lot_number);

create or replace function private.inventory_record_purchase_lot_from_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.inventory_documents%rowtype;
  v_line public.inventory_document_lines%rowtype;
  v_item public.inventory_items%rowtype;
  v_track_expiry boolean;
  v_received_date date;
begin
  if new.direction <> 'in' or new.movement_stage <> 'completion' then
    return new;
  end if;

  select document.*
  into v_document
  from public.inventory_documents document
  where document.id = new.document_id;

  if not found or v_document.document_type <> 'purchase_receipt' then
    return new;
  end if;

  select line.*
  into v_line
  from public.inventory_document_lines line
  where line.id = new.document_line_id
    and line.document_id = new.document_id;

  if not found then
    raise exception 'Không tìm thấy dòng phiếu nhập để ghi nhận lô hàng.';
  end if;

  select item.*
  into v_item
  from public.inventory_items item
  where item.id = new.item_id;

  if not found then
    raise exception 'Không tìm thấy nguyên vật liệu của lô hàng.';
  end if;

  v_track_expiry := coalesce(v_item.metadata ->> 'track_expiry', 'false') = 'true';
  v_received_date := (v_document.occurred_at at time zone 'Asia/Bangkok')::date;

  if nullif(btrim(v_line.lot_number), '') is null then
    raise exception 'Phiếu nhập mua phải có mã lô cho từng nguyên vật liệu.';
  end if;

  if v_track_expiry and v_line.expires_on is null then
    raise exception 'Nguyên vật liệu % đang theo dõi hạn sử dụng nên phải nhập ngày hết hạn.', v_item.name;
  end if;

  if v_line.manufactured_on is not null and v_line.manufactured_on > v_received_date then
    raise exception 'Ngày sản xuất của % không được sau ngày nhập kho.', v_item.name;
  end if;

  if v_line.expires_on is not null and v_line.expires_on < v_received_date then
    raise exception 'Không thể nhập % vì lô hàng đã hết hạn.', v_item.name;
  end if;

  insert into public.inventory_stock_lots (
    warehouse_id,
    item_id,
    source_document_id,
    source_document_line_id,
    lot_number,
    manufactured_on,
    expires_on,
    received_quantity,
    remaining_quantity,
    unit_cost,
    metadata,
    created_by
  )
  values (
    new.warehouse_id,
    new.item_id,
    new.document_id,
    new.document_line_id,
    btrim(v_line.lot_number),
    v_line.manufactured_on,
    v_line.expires_on,
    new.quantity,
    new.quantity,
    new.unit_cost,
    jsonb_build_object(
      'supplier_id', v_document.supplier_id,
      'document_no', v_document.document_no,
      'received_at', v_document.occurred_at
    ),
    new.created_by
  )
  on conflict (source_document_line_id) do nothing;

  return new;
end;
$$;

drop trigger if exists inventory_record_purchase_lot_after_movement
  on public.inventory_stock_movements;

create trigger inventory_record_purchase_lot_after_movement
after insert on public.inventory_stock_movements
for each row
execute function private.inventory_record_purchase_lot_from_movement();

alter table public.inventory_stock_lots enable row level security;

drop policy if exists inventory_stock_lots_select on public.inventory_stock_lots;
create policy inventory_stock_lots_select
on public.inventory_stock_lots for select to authenticated
using ((select private.inventory_can_access_warehouse(warehouse_id)));

revoke all on table public.inventory_stock_lots from anon, authenticated;
grant select on table public.inventory_stock_lots to authenticated;

grant insert (
  lot_number,
  manufactured_on,
  expires_on
) on public.inventory_document_lines to authenticated;

grant update (
  lot_number,
  manufactured_on,
  expires_on
) on public.inventory_document_lines to authenticated;

revoke all on function private.inventory_record_purchase_lot_from_movement() from public;

comment on table public.inventory_stock_lots is
  'Lô tồn kho sinh từ phiếu nhập mua đã hoàn tất; dùng cho cảnh báo HSD và xuất FEFO.';
comment on column public.inventory_document_lines.lot_number is
  'Mã lô nhập mua, bắt buộc khi hoàn tất phiếu purchase_receipt.';
comment on column public.inventory_document_lines.expires_on is
  'Ngày hết hạn thực tế của lô nhập, bắt buộc khi nguyên vật liệu bật theo dõi HSD.';

notify pgrst, 'reload schema';
