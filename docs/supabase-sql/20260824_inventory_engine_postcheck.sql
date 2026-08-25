-- GHR Inventory engine postcheck - read only.
-- Run only after the inventory schema draft has been applied to a disposable/local database.

-- 1. RPC signatures, security mode and fixed search_path.
select
  namespace.nspname as function_schema,
  procedure.proname as function_name,
  pg_get_function_identity_arguments(procedure.oid) as arguments,
  procedure.prosecdef as security_definer,
  procedure.proconfig as function_config
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where (namespace.nspname, procedure.proname) in (
  ('private', 'inventory_submit_document_impl'),
  ('private', 'inventory_complete_simple_document_impl'),
  ('private', 'inventory_dispatch_transfer_impl'),
  ('private', 'inventory_receive_transfer_impl'),
  ('private', 'inventory_complete_transfer_impl'),
  ('private', 'inventory_start_stock_count_impl'),
  ('private', 'inventory_record_stock_count_impl'),
  ('private', 'inventory_submit_stock_count_impl'),
  ('private', 'inventory_approve_stock_count_impl'),
  ('private', 'inventory_complete_stock_count_impl'),
  ('private', 'inventory_approve_requisition_impl'),
  ('private', 'inventory_reject_requisition_impl'),
  ('private', 'inventory_create_requisition_transfer_impl'),
  ('private', 'inventory_fulfill_requisition_impl'),
  ('public', 'inventory_submit_document'),
  ('public', 'inventory_complete_simple_document'),
  ('public', 'inventory_dispatch_transfer'),
  ('public', 'inventory_receive_transfer'),
  ('public', 'inventory_complete_transfer'),
  ('public', 'inventory_start_stock_count'),
  ('public', 'inventory_record_stock_count'),
  ('public', 'inventory_submit_stock_count'),
  ('public', 'inventory_approve_stock_count'),
  ('public', 'inventory_complete_stock_count'),
  ('public', 'inventory_approve_requisition'),
  ('public', 'inventory_reject_requisition'),
  ('public', 'inventory_create_requisition_transfer'),
  ('public', 'inventory_fulfill_requisition')
)
order by namespace.nspname, procedure.proname;

-- Expected:
-- private implementation functions: security_definer = true.
-- public wrapper functions: security_definer = false.
-- all functions: function_config contains search_path="".

-- 2. RPC execute privileges. Anon must not be able to execute inventory RPCs.
with rpc_signatures(routine_schema, routine_name, signature) as (
  values
    ('public', 'inventory_submit_document', 'public.inventory_submit_document(uuid,text)'),
    ('public', 'inventory_complete_simple_document', 'public.inventory_complete_simple_document(uuid,text)'),
    ('public', 'inventory_dispatch_transfer', 'public.inventory_dispatch_transfer(uuid,text,jsonb)'),
    ('public', 'inventory_receive_transfer', 'public.inventory_receive_transfer(uuid,text,jsonb)'),
    ('public', 'inventory_complete_transfer', 'public.inventory_complete_transfer(uuid,text)'),
    ('public', 'inventory_start_stock_count', 'public.inventory_start_stock_count(uuid,text)'),
    ('public', 'inventory_record_stock_count', 'public.inventory_record_stock_count(uuid,text,jsonb)'),
    ('public', 'inventory_submit_stock_count', 'public.inventory_submit_stock_count(uuid,text)'),
    ('public', 'inventory_approve_stock_count', 'public.inventory_approve_stock_count(uuid,text,jsonb)'),
    ('public', 'inventory_complete_stock_count', 'public.inventory_complete_stock_count(uuid,text)'),
    ('public', 'inventory_approve_requisition', 'public.inventory_approve_requisition(uuid,text,uuid,jsonb)'),
    ('public', 'inventory_reject_requisition', 'public.inventory_reject_requisition(uuid,text,uuid,text)'),
    ('public', 'inventory_create_requisition_transfer', 'public.inventory_create_requisition_transfer(uuid,text)'),
    ('public', 'inventory_fulfill_requisition', 'public.inventory_fulfill_requisition(uuid,text)')
)
select
  rpc.routine_schema,
  rpc.routine_name,
  has_function_privilege(
    'anon',
    rpc.signature,
    'EXECUTE'
  ) as anon_can_execute,
  has_function_privilege(
    'authenticated',
    rpc.signature,
    'EXECUTE'
  ) as authenticated_can_execute
from rpc_signatures rpc
order by rpc.routine_name;

-- Expected: anon_can_execute = false; authenticated_can_execute = true.

-- 3. Protected tables must have RLS and no direct authenticated writes.
select
  table_state.relname as table_name,
  table_state.relrowsecurity as rls_enabled,
  has_table_privilege('authenticated', table_state.oid, 'SELECT') as can_select,
  has_table_privilege('authenticated', table_state.oid, 'INSERT') as can_insert,
  has_table_privilege('authenticated', table_state.oid, 'UPDATE') as can_update,
  has_table_privilege('authenticated', table_state.oid, 'DELETE') as can_delete
from pg_class table_state
join pg_namespace namespace on namespace.oid = table_state.relnamespace
where namespace.nspname = 'public'
  and table_state.relname in (
    'inventory_stock_balances',
    'inventory_stock_movements',
    'inventory_stock_count_snapshots',
    'inventory_document_events',
    'inventory_document_operations'
  )
order by table_state.relname;

-- Expected: RLS and SELECT are true; INSERT/UPDATE/DELETE are false.

-- 4. Detect duplicate movements for one document line, warehouse and direction.
select
  movement.document_line_id,
  movement.warehouse_id,
  movement.direction,
  count(*) as duplicate_count
from public.inventory_stock_movements movement
group by movement.document_line_id, movement.warehouse_id, movement.direction
having count(*) > 1;

-- Expected: zero rows.

-- 14. Requisitions never write stock movements directly.
select
  document.id,
  document.document_no,
  count(movement.id) as movement_count
from public.inventory_documents document
join public.inventory_stock_movements movement on movement.document_id = document.id
where document.document_type = 'internal_requisition'
group by document.id, document.document_no;

-- Expected: zero rows.

-- 15. Reviewed requisitions need valid warehouses and reviewed quantities.
select
  document.id as document_id,
  document.document_no,
  document.status,
  line.id as document_line_id,
  line.expected_quantity,
  line.approved_quantity,
  line.rejection_reason
from public.inventory_documents document
left join public.inventory_document_lines line on line.document_id = document.id
where document.document_type = 'internal_requisition'
  and document.status in ('approved', 'fulfilled')
  and (
    document.source_warehouse_id is null
    or document.destination_warehouse_id is null
    or document.source_warehouse_id = document.destination_warehouse_id
    or line.id is null
    or line.approved_quantity is null
    or line.approved_quantity < 0
    or line.approved_quantity > line.expected_quantity
    or (
      line.approved_quantity < line.expected_quantity
      and nullif(btrim(line.rejection_reason), '') is null
    )
  );

-- Expected: zero rows.

-- 16. A requisition can create at most one transfer and quantities must match approval.
select
  requisition.id as requisition_document_id,
  requisition.document_no as requisition_no,
  transfer.id as transfer_document_id,
  request_line.item_id,
  request_line.approved_quantity,
  transfer_line.expected_quantity as transfer_quantity
from public.inventory_documents requisition
join public.inventory_document_operations operation
  on operation.document_id = requisition.id
 and operation.operation = 'create_requisition_transfer'
left join public.inventory_documents transfer
  on transfer.source_document_id = requisition.id
 and transfer.document_type = 'transfer'
left join public.inventory_document_lines request_line
  on request_line.document_id = requisition.id
 and coalesce(request_line.approved_quantity, 0) > 0
left join public.inventory_document_lines transfer_line
  on transfer_line.document_id = transfer.id
 and transfer_line.item_id = request_line.item_id
where requisition.document_type = 'internal_requisition'
  and (
    transfer.id is null
    or transfer.source_warehouse_id <> requisition.source_warehouse_id
    or transfer.destination_warehouse_id <> requisition.destination_warehouse_id
    or transfer_line.id is null
    or transfer_line.expected_quantity <> request_line.approved_quantity
  );

-- Expected: zero rows.

-- 17. Fulfilled requisitions require exactly one completed linked transfer and operation audit.
select
  requisition.id,
  requisition.document_no,
  count(distinct transfer.id) filter (where transfer.status = 'completed') as completed_transfer_count,
  count(distinct operation.id) filter (where operation.operation = 'fulfill_requisition') as fulfill_operation_count
from public.inventory_documents requisition
left join public.inventory_documents transfer
  on transfer.source_document_id = requisition.id
 and transfer.document_type = 'transfer'
left join public.inventory_document_operations operation on operation.document_id = requisition.id
where requisition.document_type = 'internal_requisition'
  and requisition.status = 'fulfilled'
group by requisition.id, requisition.document_no
having count(distinct transfer.id) filter (where transfer.status = 'completed') <> 1
    or count(distinct operation.id) filter (where operation.operation = 'fulfill_requisition') <> 1;

-- Expected: zero rows.

-- 10. Submitted stock-count snapshots must reproduce movement activity exactly.
with snapshot_activity as (
  select
    snapshot.id,
    coalesce(sum(
      case
        when movement.movement_sequence <= snapshot.movement_sequence_at_count
          then case movement.direction when 'in' then movement.quantity else -movement.quantity end
        else 0
      end
    ), 0) as recalculated_movement_quantity_at_count,
    coalesce(sum(
      case movement.direction
        when 'in' then movement.quantity
        when 'out' then -movement.quantity
      end
    ), 0) as recalculated_movement_quantity
  from public.inventory_stock_count_snapshots snapshot
  left join public.inventory_stock_movements movement
    on movement.warehouse_id = snapshot.warehouse_id
   and movement.item_id = snapshot.item_id
   and movement.movement_sequence > snapshot.movement_sequence_at_capture
   and movement.movement_sequence <= snapshot.movement_sequence_until_submit
  where snapshot.submitted_at is not null
  group by snapshot.id
)
select
  snapshot.document_id,
  snapshot.item_id,
  snapshot.movement_quantity_until_count,
  activity.recalculated_movement_quantity_at_count,
  snapshot.expected_quantity_at_count,
  snapshot.movement_quantity_until_submit,
  activity.recalculated_movement_quantity,
  snapshot.expected_quantity_at_submit
from public.inventory_stock_count_snapshots snapshot
join snapshot_activity activity on activity.id = snapshot.id
where snapshot.movement_sequence_at_count is null
   or snapshot.movement_sequence_until_submit is null
   or snapshot.movement_quantity_until_count <> activity.recalculated_movement_quantity_at_count
   or snapshot.expected_quantity_at_count
      <> snapshot.system_quantity + activity.recalculated_movement_quantity_at_count
   or snapshot.movement_quantity_until_submit <> activity.recalculated_movement_quantity
   or snapshot.expected_quantity_at_submit
      <> snapshot.system_quantity + activity.recalculated_movement_quantity;

-- Expected: zero rows.

-- 11. Submitted or later stock counts need one snapshot per line and explicit variance reasons.
select
  document.id as document_id,
  document.document_no,
  line.id as document_line_id,
  line.counted_quantity,
  snapshot.expected_quantity_at_count,
  line.variance_reason
from public.inventory_documents document
join public.inventory_document_lines line on line.document_id = document.id
left join public.inventory_stock_count_snapshots snapshot
  on snapshot.document_id = document.id
 and snapshot.warehouse_id = document.source_warehouse_id
 and snapshot.item_id = line.item_id
where document.document_type = 'stock_count'
  and document.status in ('submitted', 'approved', 'completed')
  and (
    line.counted_quantity is null
    or snapshot.id is null
    or snapshot.expected_quantity_at_count is null
    or (
      document.status in ('approved', 'completed')
      and line.counted_quantity * line.conversion_to_base <> snapshot.expected_quantity_at_count
      and nullif(btrim(line.variance_reason), '') is null
    )
  );

-- Expected: zero rows.

-- 12. Completed stock counts need the lifecycle operations and a linked adjustment only when variance exists.
with count_summary as (
  select
    document.id,
    document.document_no,
    count(distinct operation.id) filter (where operation.operation = 'start_stock_count') as start_count,
    count(distinct operation.id) filter (where operation.operation = 'submit_stock_count') as submit_count,
    count(distinct operation.id) filter (where operation.operation = 'approve_stock_count') as approve_count,
    count(distinct operation.id) filter (where operation.operation = 'complete_stock_count') as complete_count,
    count(distinct adjustment.id) as adjustment_count,
    count(distinct line.id) filter (
      where line.counted_quantity * line.conversion_to_base <> snapshot.expected_quantity_at_count
    ) as variance_count
  from public.inventory_documents document
  left join public.inventory_document_operations operation on operation.document_id = document.id
  left join public.inventory_document_lines line on line.document_id = document.id
  left join public.inventory_stock_count_snapshots snapshot
    on snapshot.document_id = document.id
   and snapshot.warehouse_id = document.source_warehouse_id
   and snapshot.item_id = line.item_id
  left join public.inventory_documents adjustment
    on adjustment.source_document_id = document.id
   and adjustment.document_type = 'stock_adjustment'
  where document.document_type = 'stock_count'
    and document.status = 'completed'
  group by document.id, document.document_no
)
select *
from count_summary
where start_count <> 1
   or submit_count <> 1
   or approve_count <> 1
   or complete_count <> 1
   or (variance_count = 0 and adjustment_count <> 0)
   or (variance_count > 0 and adjustment_count <> 1);

-- Expected: zero rows.

-- 13. Stock-count adjustment lines must each have one matching adjustment movement.
select
  adjustment.id as adjustment_document_id,
  adjustment.source_document_id as stock_count_document_id,
  line.id as adjustment_line_id,
  line.base_quantity,
  count(movement.id) as movement_count,
  coalesce(sum(movement.quantity), 0) as movement_quantity
from public.inventory_documents adjustment
join public.inventory_document_lines line on line.document_id = adjustment.id
left join public.inventory_stock_movements movement
  on movement.document_line_id = line.id
 and movement.document_id = adjustment.id
 and movement.warehouse_id = adjustment.source_warehouse_id
 and movement.movement_stage = 'adjustment'
where adjustment.document_type = 'stock_adjustment'
  and adjustment.source_document_id is not null
group by adjustment.id, adjustment.source_document_id, line.id, line.base_quantity
having count(movement.id) <> 1
    or coalesce(sum(movement.quantity), 0) <> line.base_quantity;

-- Expected: zero rows.

-- 7. Transfer movement quantities must match dispatched and received base quantities.
with transfer_lines as (
  select
    document.id as document_id,
    line.id as document_line_id,
    document.source_warehouse_id,
    document.destination_warehouse_id,
    line.shipped_quantity * line.conversion_to_base as shipped_base_quantity,
    line.received_quantity * line.conversion_to_base as received_base_quantity
  from public.inventory_documents document
  join public.inventory_document_lines line on line.document_id = document.id
  where document.document_type = 'transfer'
    and document.status in ('in_transit', 'received', 'received_with_variance', 'completed')
), movement_totals as (
  select
    movement.document_line_id,
    movement.warehouse_id,
    movement.direction,
    sum(movement.quantity) as movement_quantity
  from public.inventory_stock_movements movement
  where movement.movement_stage in ('dispatch', 'receipt')
  group by movement.document_line_id, movement.warehouse_id, movement.direction
)
select
  transfer.document_id,
  transfer.document_line_id,
  transfer.shipped_base_quantity,
  source_movement.movement_quantity as source_out_quantity,
  transfer.received_base_quantity,
  destination_movement.movement_quantity as destination_in_quantity
from transfer_lines transfer
left join movement_totals source_movement
  on source_movement.document_line_id = transfer.document_line_id
 and source_movement.warehouse_id = transfer.source_warehouse_id
 and source_movement.direction = 'out'
left join movement_totals destination_movement
  on destination_movement.document_line_id = transfer.document_line_id
 and destination_movement.warehouse_id = transfer.destination_warehouse_id
 and destination_movement.direction = 'in'
where coalesce(source_movement.movement_quantity, -1) <> transfer.shipped_base_quantity
   or (
     transfer.received_base_quantity is not null
     and coalesce(destination_movement.movement_quantity, 0) <> transfer.received_base_quantity
   );

-- Expected: zero rows.

-- 8. Transfer variance must be explicit and over-receipt is forbidden.
select
  document.id as document_id,
  document.document_no,
  line.id as document_line_id,
  line.shipped_quantity,
  line.received_quantity,
  line.variance_reason
from public.inventory_documents document
join public.inventory_document_lines line on line.document_id = document.id
where document.document_type = 'transfer'
  and line.received_quantity is not null
  and (
    line.received_quantity > line.shipped_quantity
    or (
      line.received_quantity <> line.shipped_quantity
      and nullif(btrim(line.variance_reason), '') is null
    )
  );

-- Expected: zero rows.

-- 9. Completed transfers need all three operation records.
select
  document.id,
  document.document_no,
  count(*) filter (where operation.operation = 'dispatch_transfer') as dispatch_count,
  count(*) filter (where operation.operation = 'receive_transfer') as receive_count,
  count(*) filter (where operation.operation = 'complete_transfer') as complete_count
from public.inventory_documents document
left join public.inventory_document_operations operation on operation.document_id = document.id
where document.document_type = 'transfer'
  and document.status = 'completed'
group by document.id, document.document_no
having count(*) filter (where operation.operation = 'dispatch_transfer') <> 1
    or count(*) filter (where operation.operation = 'receive_transfer') <> 1
    or count(*) filter (where operation.operation = 'complete_transfer') <> 1;

-- Expected: zero rows.

-- 5. Recalculate quantity from the immutable movement ledger and compare to balance.
with movement_totals as (
  select
    movement.warehouse_id,
    movement.item_id,
    sum(
      case movement.direction
        when 'in' then movement.quantity
        when 'out' then -movement.quantity
      end
    ) as movement_quantity
  from public.inventory_stock_movements movement
  group by movement.warehouse_id, movement.item_id
)
select
  coalesce(balance.warehouse_id, movement_totals.warehouse_id) as warehouse_id,
  coalesce(balance.item_id, movement_totals.item_id) as item_id,
  coalesce(balance.quantity, 0) as balance_quantity,
  coalesce(movement_totals.movement_quantity, 0) as movement_quantity,
  coalesce(balance.quantity, 0) - coalesce(movement_totals.movement_quantity, 0) as difference
from public.inventory_stock_balances balance
full join movement_totals
  on movement_totals.warehouse_id = balance.warehouse_id
 and movement_totals.item_id = balance.item_id
where coalesce(balance.quantity, 0) <> coalesce(movement_totals.movement_quantity, 0)
order by warehouse_id, item_id;

-- Expected after a clean opening balance: zero rows.

-- 6. Completed simple documents must have exactly one completed operation and movements.
select
  document.id,
  document.document_no,
  document.document_type,
  count(distinct operation.id) as complete_operation_count,
  count(distinct movement.id) as movement_count
from public.inventory_documents document
left join public.inventory_document_operations operation
  on operation.document_id = document.id
 and operation.operation = 'complete'
left join public.inventory_stock_movements movement
  on movement.document_id = document.id
where document.status = 'completed'
  and document.document_type in (
    'opening_balance',
    'purchase_receipt',
    'stock_issue',
    'waste',
    'return'
  )
group by document.id, document.document_no, document.document_type
having count(distinct operation.id) <> 1
    or count(distinct movement.id) = 0;

-- Expected: zero rows.
