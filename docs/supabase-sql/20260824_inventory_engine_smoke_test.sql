-- GHR Inventory engine end-to-end smoke test.
-- LOCAL / DISPOSABLE DATABASE ONLY. NEVER RUN THIS FILE ON PRODUCTION.
--
-- Prerequisites:
--   1. Apply docs/supabase-sql/20260725_inventory_mvp.sql first.
--   2. The local Supabase project must contain at least one auth.users row.
--   3. Run as postgres (SQL Editor or a local postgres connection).
--
-- The whole test runs inside one transaction and ends with ROLLBACK.
-- It covers opening balance, stock issue, transfer with variance,
-- internal requisition -> transfer, stock count -> adjustment, and idempotent replay.

begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

create temp table inventory_smoke_context (
  actor_id uuid not null,
  source_warehouse_id uuid not null,
  destination_warehouse_id uuid not null,
  unit_id uuid not null,
  item_id uuid not null,
  opening_document_id uuid not null,
  opening_line_id uuid not null,
  issue_document_id uuid not null,
  issue_line_id uuid not null,
  transfer_document_id uuid not null,
  transfer_line_id uuid not null,
  requisition_document_id uuid not null,
  requisition_line_id uuid not null,
  rejected_requisition_document_id uuid not null,
  rejected_requisition_line_id uuid not null,
  requisition_transfer_document_id uuid,
  requisition_transfer_line_id uuid,
  count_document_id uuid not null,
  count_line_id uuid not null
) on commit drop;

do $$
declare
  v_actor uuid;
  v_source_warehouse_id uuid := gen_random_uuid();
  v_destination_warehouse_id uuid := gen_random_uuid();
  v_unit_id uuid := gen_random_uuid();
  v_item_id uuid := gen_random_uuid();
  v_opening_document_id uuid := gen_random_uuid();
  v_opening_line_id uuid := gen_random_uuid();
  v_issue_document_id uuid := gen_random_uuid();
  v_issue_line_id uuid := gen_random_uuid();
  v_transfer_document_id uuid := gen_random_uuid();
  v_transfer_line_id uuid := gen_random_uuid();
  v_requisition_document_id uuid := gen_random_uuid();
  v_requisition_line_id uuid := gen_random_uuid();
  v_rejected_requisition_document_id uuid := gen_random_uuid();
  v_rejected_requisition_line_id uuid := gen_random_uuid();
  v_count_document_id uuid := gen_random_uuid();
  v_count_line_id uuid := gen_random_uuid();
  v_run_suffix text := replace(gen_random_uuid()::text, '-', '');
begin
  select user_row.id
  into v_actor
  from auth.users user_row
  order by user_row.created_at, user_row.id
  limit 1;

  if v_actor is null then
    raise exception 'Smoke test cần ít nhất một tài khoản trong auth.users của Supabase local.';
  end if;

  insert into public.inventory_warehouses (
    id, code, name, warehouse_type, allow_negative_stock, is_active, created_by
  )
  values
    (
      v_source_warehouse_id,
      'SMOKE-SRC-' || v_run_suffix,
      'Kho nguồn smoke test',
      'central',
      false,
      true,
      v_actor
    ),
    (
      v_destination_warehouse_id,
      'SMOKE-DST-' || v_run_suffix,
      'Kho nhận smoke test',
      'branch',
      false,
      true,
      v_actor
    );

  insert into public.inventory_units (
    id, code, name, unit_type, decimal_places, is_active, created_by
  )
  values (
    v_unit_id,
    'SMOKE-UNIT-' || v_run_suffix,
    'Đơn vị smoke test',
    'count',
    0,
    true,
    v_actor
  );

  insert into public.inventory_items (
    id,
    code,
    name,
    item_type,
    base_unit_id,
    purchase_unit_id,
    purchase_to_base_ratio,
    is_active,
    created_by
  )
  values (
    v_item_id,
    'SMOKE-ITEM-' || v_run_suffix,
    'Nguyên liệu smoke test',
    'ingredient',
    v_unit_id,
    v_unit_id,
    1,
    true,
    v_actor
  );

  insert into public.inventory_user_access (
    auth_user_id, warehouse_id, role, is_active, created_by
  )
  values (v_actor, null, 'owner', true, v_actor)
  on conflict (auth_user_id, warehouse_id, role)
  do update set is_active = true;

  insert into public.inventory_documents (
    id,
    document_no,
    idempotency_key,
    document_type,
    status,
    source_warehouse_id,
    destination_warehouse_id,
    occurred_at,
    notes,
    created_by
  )
  values
    (
      v_opening_document_id,
      'SMOKE-OPEN-' || v_run_suffix,
      'smoke-open-document-' || v_run_suffix,
      'opening_balance',
      'draft',
      null,
      v_source_warehouse_id,
      clock_timestamp(),
      'Tồn đầu smoke test',
      v_actor
    ),
    (
      v_issue_document_id,
      'SMOKE-ISSUE-' || v_run_suffix,
      'smoke-issue-document-' || v_run_suffix,
      'stock_issue',
      'draft',
      v_source_warehouse_id,
      null,
      clock_timestamp(),
      'Xuất dùng nội bộ smoke test',
      v_actor
    ),
    (
      v_transfer_document_id,
      'SMOKE-TRANSFER-' || v_run_suffix,
      'smoke-transfer-document-' || v_run_suffix,
      'transfer',
      'draft',
      v_source_warehouse_id,
      v_destination_warehouse_id,
      clock_timestamp(),
      'Chuyển kho lệch smoke test',
      v_actor
    ),
    (
      v_requisition_document_id,
      'SMOKE-REQ-' || v_run_suffix,
      'smoke-requisition-document-' || v_run_suffix,
      'internal_requisition',
      'draft',
      null,
      v_destination_warehouse_id,
      clock_timestamp(),
      'Yêu cầu cấp hàng smoke test',
      v_actor
    ),
    (
      v_count_document_id,
      'SMOKE-COUNT-' || v_run_suffix,
      'smoke-count-document-' || v_run_suffix,
      'stock_count',
      'draft',
      v_source_warehouse_id,
      null,
      clock_timestamp(),
      'Kiểm kê smoke test',
      v_actor
    ),
    (
      v_rejected_requisition_document_id,
      'SMOKE-REQ-REJECT-' || v_run_suffix,
      'smoke-rejected-requisition-document-' || v_run_suffix,
      'internal_requisition',
      'draft',
      null,
      v_destination_warehouse_id,
      clock_timestamp(),
      'Yêu cầu bị từ chối smoke test',
      v_actor
    );

  insert into public.inventory_document_lines (
    id,
    document_id,
    item_id,
    unit_id,
    conversion_to_base,
    expected_quantity,
    actual_quantity,
    base_quantity,
    unit_price,
    notes
  )
  values
    (
      v_opening_line_id,
      v_opening_document_id,
      v_item_id,
      v_unit_id,
      1,
      100,
      100,
      0,
      10,
      'Tồn đầu 100'
    ),
    (
      v_issue_line_id,
      v_issue_document_id,
      v_item_id,
      v_unit_id,
      1,
      5,
      5,
      0,
      0,
      'Xuất 5'
    ),
    (
      v_transfer_line_id,
      v_transfer_document_id,
      v_item_id,
      v_unit_id,
      1,
      20,
      null,
      0,
      0,
      'Giao 20, nhận 18'
    ),
    (
      v_requisition_line_id,
      v_requisition_document_id,
      v_item_id,
      v_unit_id,
      1,
      10,
      null,
      0,
      0,
      'Yêu cầu 10, duyệt 8'
    ),
    (
      v_count_line_id,
      v_count_document_id,
      v_item_id,
      v_unit_id,
      1,
      0,
      null,
      0,
      0,
      'Đếm thực tế cao hơn sổ 2'
    ),
    (
      v_rejected_requisition_line_id,
      v_rejected_requisition_document_id,
      v_item_id,
      v_unit_id,
      1,
      3,
      null,
      0,
      0,
      'Yêu cầu 3 và bị từ chối'
    );

  insert into inventory_smoke_context (
    actor_id,
    source_warehouse_id,
    destination_warehouse_id,
    unit_id,
    item_id,
    opening_document_id,
    opening_line_id,
    issue_document_id,
    issue_line_id,
    transfer_document_id,
    transfer_line_id,
    requisition_document_id,
    requisition_line_id,
    rejected_requisition_document_id,
    rejected_requisition_line_id,
    count_document_id,
    count_line_id
  )
  values (
    v_actor,
    v_source_warehouse_id,
    v_destination_warehouse_id,
    v_unit_id,
    v_item_id,
    v_opening_document_id,
    v_opening_line_id,
    v_issue_document_id,
    v_issue_line_id,
    v_transfer_document_id,
    v_transfer_line_id,
    v_requisition_document_id,
    v_requisition_line_id,
    v_rejected_requisition_document_id,
    v_rejected_requisition_line_id,
    v_count_document_id,
    v_count_line_id
  );
end;
$$;

grant select, update on inventory_smoke_context to authenticated;

select set_config('request.jwt.claim.sub', context.actor_id::text, true)
from inventory_smoke_context context;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', context.actor_id,
    'role', 'authenticated'
  )::text,
  true
)
from inventory_smoke_context context;

set local role authenticated;

-- 1. Opening balance: 100 units into the source warehouse.
select public.inventory_submit_document(
  context.opening_document_id,
  'smoke-submit-opening'
)
from inventory_smoke_context context;

select public.inventory_complete_simple_document(
  context.opening_document_id,
  'smoke-complete-opening'
)
from inventory_smoke_context context;

-- Same key must replay without creating another movement.
select public.inventory_complete_simple_document(
  context.opening_document_id,
  'smoke-complete-opening'
)
from inventory_smoke_context context;

-- 2. Internal stock issue: 5 units out.
select public.inventory_submit_document(
  context.issue_document_id,
  'smoke-submit-issue'
)
from inventory_smoke_context context;

select public.inventory_complete_simple_document(
  context.issue_document_id,
  'smoke-complete-issue'
)
from inventory_smoke_context context;

-- 3. Direct transfer: ship 20, receive 18 with an explicit variance reason.
select public.inventory_submit_document(
  context.transfer_document_id,
  'smoke-submit-transfer'
)
from inventory_smoke_context context;

select public.inventory_dispatch_transfer(
  context.transfer_document_id,
  'smoke-dispatch-transfer',
  jsonb_build_array(jsonb_build_object(
    'line_id', context.transfer_line_id,
    'shipped_quantity', 20
  ))
)
from inventory_smoke_context context;

select public.inventory_receive_transfer(
  context.transfer_document_id,
  'smoke-receive-transfer',
  jsonb_build_array(jsonb_build_object(
    'line_id', context.transfer_line_id,
    'received_quantity', 18,
    'variance_reason', 'Thiếu 2 đơn vị khi nhận smoke test'
  ))
)
from inventory_smoke_context context;

select public.inventory_complete_transfer(
  context.transfer_document_id,
  'smoke-complete-transfer'
)
from inventory_smoke_context context;

-- 4. Requisition: request 10, approve 8, create and complete one linked transfer.
select public.inventory_submit_document(
  context.requisition_document_id,
  'smoke-submit-requisition'
)
from inventory_smoke_context context;

select public.inventory_approve_requisition(
  context.requisition_document_id,
  'smoke-approve-requisition',
  context.source_warehouse_id,
  jsonb_build_array(jsonb_build_object(
    'line_id', context.requisition_line_id,
    'approved_quantity', 8,
    'rejection_reason', 'Kho nguồn chỉ cấp được 8 đơn vị'
  ))
)
from inventory_smoke_context context;

with transfer_result as materialized (
  select public.inventory_create_requisition_transfer(
    context.requisition_document_id,
    'smoke-create-requisition-transfer'
  ) as payload
  from inventory_smoke_context context
)
update inventory_smoke_context context
set requisition_transfer_document_id = (transfer_result.payload ->> 'transfer_document_id')::uuid
from transfer_result;

update inventory_smoke_context context
set requisition_transfer_line_id = line.id
from public.inventory_document_lines line
where line.document_id = context.requisition_transfer_document_id
  and line.item_id = context.item_id;

select public.inventory_submit_document(
  context.requisition_transfer_document_id,
  'smoke-submit-requisition-transfer'
)
from inventory_smoke_context context;

select public.inventory_dispatch_transfer(
  context.requisition_transfer_document_id,
  'smoke-dispatch-requisition-transfer',
  jsonb_build_array(jsonb_build_object(
    'line_id', context.requisition_transfer_line_id,
    'shipped_quantity', 8
  ))
)
from inventory_smoke_context context;

select public.inventory_receive_transfer(
  context.requisition_transfer_document_id,
  'smoke-receive-requisition-transfer',
  jsonb_build_array(jsonb_build_object(
    'line_id', context.requisition_transfer_line_id,
    'received_quantity', 8,
    'variance_reason', null
  ))
)
from inventory_smoke_context context;

select public.inventory_complete_transfer(
  context.requisition_transfer_document_id,
  'smoke-complete-requisition-transfer'
)
from inventory_smoke_context context;

select public.inventory_fulfill_requisition(
  context.requisition_document_id,
  'smoke-fulfill-requisition'
)
from inventory_smoke_context context;

-- Rejection branch: a rejected request must not create a transfer or movement.
select public.inventory_submit_document(
  context.rejected_requisition_document_id,
  'smoke-submit-rejected-requisition'
)
from inventory_smoke_context context;

select public.inventory_reject_requisition(
  context.rejected_requisition_document_id,
  'smoke-reject-requisition',
  context.source_warehouse_id,
  'Kho nguồn không thể cấp mặt hàng trong lần này'
)
from inventory_smoke_context context;

-- 5. Stock count: book quantity is 67, actual count is 69, adjustment is +2.
select public.inventory_start_stock_count(
  context.count_document_id,
  'smoke-start-stock-count'
)
from inventory_smoke_context context;

select public.inventory_record_stock_count(
  context.count_document_id,
  'smoke-record-stock-count',
  jsonb_build_array(jsonb_build_object(
    'line_id', context.count_line_id,
    'counted_quantity', 69
  ))
)
from inventory_smoke_context context;

select public.inventory_submit_stock_count(
  context.count_document_id,
  'smoke-submit-stock-count'
)
from inventory_smoke_context context;

select public.inventory_approve_stock_count(
  context.count_document_id,
  'smoke-approve-stock-count',
  jsonb_build_array(jsonb_build_object(
    'line_id', context.count_line_id,
    'variance_reason', 'Đếm thực tế dư 2 đơn vị'
  ))
)
from inventory_smoke_context context;

select public.inventory_complete_stock_count(
  context.count_document_id,
  'smoke-complete-stock-count'
)
from inventory_smoke_context context;

-- Same key must replay without creating another adjustment document or movement.
select public.inventory_complete_stock_count(
  context.count_document_id,
  'smoke-complete-stock-count'
)
from inventory_smoke_context context;

reset role;

-- Assertions. Any failed assertion aborts the transaction.
do $$
declare
  v_context inventory_smoke_context%rowtype;
  v_source_quantity numeric(18,6);
  v_destination_quantity numeric(18,6);
  v_ledger_source numeric(18,6);
  v_ledger_destination numeric(18,6);
  v_count integer;
begin
  select * into v_context from inventory_smoke_context;

  select balance.quantity
  into v_source_quantity
  from public.inventory_stock_balances balance
  where balance.warehouse_id = v_context.source_warehouse_id
    and balance.item_id = v_context.item_id;

  select balance.quantity
  into v_destination_quantity
  from public.inventory_stock_balances balance
  where balance.warehouse_id = v_context.destination_warehouse_id
    and balance.item_id = v_context.item_id;

  if v_source_quantity <> 69 then
    raise exception 'Smoke test sai tồn kho nguồn: mong đợi 69, thực tế %.', v_source_quantity;
  end if;

  if v_destination_quantity <> 26 then
    raise exception 'Smoke test sai tồn kho nhận: mong đợi 26, thực tế %.', v_destination_quantity;
  end if;

  select coalesce(sum(case when movement.direction = 'in' then movement.quantity else -movement.quantity end), 0)
  into v_ledger_source
  from public.inventory_stock_movements movement
  where movement.warehouse_id = v_context.source_warehouse_id
    and movement.item_id = v_context.item_id;

  select coalesce(sum(case when movement.direction = 'in' then movement.quantity else -movement.quantity end), 0)
  into v_ledger_destination
  from public.inventory_stock_movements movement
  where movement.warehouse_id = v_context.destination_warehouse_id
    and movement.item_id = v_context.item_id;

  if v_ledger_source <> v_source_quantity or v_ledger_destination <> v_destination_quantity then
    raise exception 'Movement ledger không khớp balance trong smoke test.';
  end if;

  select count(*)
  into v_count
  from public.inventory_stock_movements movement
  where movement.document_id = v_context.requisition_document_id;

  if v_count <> 0 then
    raise exception 'Yêu cầu cấp hàng không được tạo movement trực tiếp.';
  end if;

  select count(*)
  into v_count
  from public.inventory_documents transfer
  where transfer.document_type = 'transfer'
    and transfer.source_document_id = v_context.requisition_document_id;

  if v_count <> 1 then
    raise exception 'Yêu cầu cấp hàng phải sinh đúng một phiếu chuyển, thực tế %.', v_count;
  end if;

  if not exists (
    select 1
    from public.inventory_documents requisition
    where requisition.id = v_context.requisition_document_id
      and requisition.status = 'fulfilled'
  ) then
    raise exception 'Yêu cầu cấp hàng chưa chuyển sang fulfilled.';
  end if;

  if not exists (
    select 1
    from public.inventory_documents requisition
    where requisition.id = v_context.rejected_requisition_document_id
      and requisition.status = 'rejected'
      and nullif(btrim(requisition.rejection_reason), '') is not null
  ) then
    raise exception 'Nhánh từ chối yêu cầu chưa lưu đúng trạng thái hoặc lý do.';
  end if;

  select count(*)
  into v_count
  from public.inventory_documents transfer
  where transfer.document_type = 'transfer'
    and transfer.source_document_id = v_context.rejected_requisition_document_id;

  if v_count <> 0 then
    raise exception 'Yêu cầu đã từ chối không được sinh phiếu chuyển.';
  end if;

  if not exists (
    select 1
    from public.inventory_documents count_document
    where count_document.id = v_context.count_document_id
      and count_document.status = 'completed'
  ) then
    raise exception 'Phiếu kiểm kê chưa completed.';
  end if;

  select count(*)
  into v_count
  from public.inventory_documents adjustment
  where adjustment.document_type = 'stock_adjustment'
    and adjustment.source_document_id = v_context.count_document_id;

  if v_count <> 1 then
    raise exception 'Kiểm kê chênh lệch phải sinh đúng một phiếu điều chỉnh, thực tế %.', v_count;
  end if;

  select count(*)
  into v_count
  from public.inventory_stock_movements movement
  where movement.document_line_id = v_context.opening_line_id;

  if v_count <> 1 then
    raise exception 'Idempotent replay đã tạo trùng movement tồn đầu.';
  end if;
end;
$$;

-- Compact success report shown before rollback.
select
  document.document_type,
  document.status,
  count(*) as document_count
from public.inventory_documents document
where document.id in (
  select context.opening_document_id from inventory_smoke_context context
  union all
  select context.issue_document_id from inventory_smoke_context context
  union all
  select context.transfer_document_id from inventory_smoke_context context
  union all
  select context.requisition_document_id from inventory_smoke_context context
  union all
  select context.rejected_requisition_document_id from inventory_smoke_context context
  union all
  select context.requisition_transfer_document_id from inventory_smoke_context context
  union all
  select context.count_document_id from inventory_smoke_context context
)
group by document.document_type, document.status
order by document.document_type, document.status;

select
  balance.warehouse_id,
  balance.item_id,
  balance.quantity,
  balance.average_cost
from public.inventory_stock_balances balance
join inventory_smoke_context context
  on context.item_id = balance.item_id
where balance.warehouse_id in (
  context.source_warehouse_id,
  context.destination_warehouse_id
)
order by balance.warehouse_id;

rollback;
