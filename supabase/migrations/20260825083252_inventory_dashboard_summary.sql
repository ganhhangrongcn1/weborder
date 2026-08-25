create or replace function public.get_inventory_dashboard_summary()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with visible_warehouses as (
  select warehouse.id, warehouse.code, warehouse.name, warehouse.warehouse_type
  from public.inventory_warehouses warehouse
  where warehouse.is_active
    and warehouse.deleted_at is null
),
visible_items as (
  select
    item.id,
    item.code,
    item.name,
    item.minimum_stock,
    item.reorder_point,
    item.metadata
  from public.inventory_items item
  where item.is_active
    and item.deleted_at is null
),
visible_balances as (
  select
    balance.warehouse_id,
    balance.item_id,
    balance.quantity,
    balance.average_cost,
    balance.updated_at,
    warehouse.code as warehouse_code,
    warehouse.name as warehouse_name,
    warehouse.warehouse_type,
    item.code as item_code,
    item.name as item_name,
    item.minimum_stock,
    item.reorder_point
  from public.inventory_stock_balances balance
  join visible_warehouses warehouse on warehouse.id = balance.warehouse_id
  join visible_items item on item.id = balance.item_id
),
visible_lots as (
  select
    lot.id,
    lot.warehouse_id,
    lot.item_id,
    lot.source_document_id,
    lot.lot_number,
    lot.expires_on,
    lot.remaining_quantity,
    warehouse.code as warehouse_code,
    warehouse.name as warehouse_name,
    item.code as item_code,
    item.name as item_name,
    greatest(0, coalesce((item.metadata ->> 'expiry_warning_days')::integer, 0)) as warning_days
  from public.inventory_stock_lots lot
  join visible_warehouses warehouse on warehouse.id = lot.warehouse_id
  join visible_items item on item.id = lot.item_id
  where lot.status = 'active'
    and lot.remaining_quantity > 0
    and lot.expires_on is not null
    and coalesce(item.metadata ->> 'track_expiry', 'false') = 'true'
),
actionable_documents as (
  select
    document.id,
    document.document_no,
    document.document_type,
    document.status,
    document.source_warehouse_id,
    document.destination_warehouse_id,
    document.occurred_at,
    coalesce(source_warehouse.name, destination_warehouse.name, 'Kho được phân quyền') as warehouse_name,
    case document.document_type
      when 'purchase_receipt' then 'receipts'
      when 'stock_issue' then 'issues'
      when 'transfer' then 'transfers'
      when 'waste' then 'disposals'
      when 'internal_requisition' then 'requisitions'
      when 'stock_adjustment' then 'adjustments'
      when 'stock_count' then 'counts'
      else 'ledger'
    end as route_page
  from public.inventory_documents document
  left join visible_warehouses source_warehouse on source_warehouse.id = document.source_warehouse_id
  left join visible_warehouses destination_warehouse on destination_warehouse.id = document.destination_warehouse_id
  where (
      document.status = 'submitted'
      and document.document_type in (
        'purchase_receipt', 'stock_issue', 'transfer', 'waste',
        'internal_requisition', 'stock_adjustment', 'stock_count'
      )
    )
    or (
      document.document_type = 'transfer'
      and document.status in ('approved', 'in_transit', 'received', 'received_with_variance')
    )
    or (
      document.document_type = 'internal_requisition'
      and document.status = 'approved'
      and not exists (
        select 1
        from public.inventory_documents linked_transfer
        where linked_transfer.document_type = 'transfer'
          and linked_transfer.source_document_id = document.id
      )
    )
),
stock_actions as (
  select
    case when balance.quantity <= 0 then 2 else 4 end as priority,
    case when balance.quantity <= 0 then 'out_of_stock' else 'reorder' end as kind,
    case when balance.quantity <= 0 then 'Đã hết hàng' else 'Cần đặt hàng' end as title,
    concat(balance.item_name, ' · ', balance.warehouse_name) as description,
    balance.warehouse_id,
    balance.warehouse_name,
    balance.item_id,
    balance.item_code,
    balance.item_name,
    null::uuid as document_id,
    null::text as document_no,
    null::text as document_type,
    null::text as status,
    'reports'::text as route_page,
    case when balance.quantity <= 0 then 'out' else 'low' end as stock_state,
    balance.quantity as quantity,
    null::date as expires_on,
    null::text as lot_number,
    balance.updated_at as occurred_at
  from visible_balances balance
  where balance.quantity <= 0
    or (balance.reorder_point > 0 and balance.quantity <= balance.reorder_point)
),
expiry_actions as (
  select
    case when lot.expires_on < current_date then 1 else 3 end as priority,
    case when lot.expires_on < current_date then 'expired' else 'expiring' end as kind,
    case when lot.expires_on < current_date then 'Lô đã hết hạn' else 'Lô sắp hết hạn' end as title,
    concat(lot.item_name, ' · lô ', lot.lot_number, ' · ', lot.warehouse_name) as description,
    lot.warehouse_id,
    lot.warehouse_name,
    lot.item_id,
    lot.item_code,
    lot.item_name,
    lot.source_document_id as document_id,
    source_document.document_no,
    source_document.document_type,
    source_document.status,
    'reports'::text as route_page,
    'all'::text as stock_state,
    lot.remaining_quantity as quantity,
    lot.expires_on,
    lot.lot_number,
    source_document.occurred_at
  from visible_lots lot
  left join public.inventory_documents source_document on source_document.id = lot.source_document_id
  where lot.expires_on < current_date
    or (
      lot.warning_days > 0
      and lot.expires_on <= current_date + lot.warning_days
    )
),
document_actions as (
  select
    case
      when document.status = 'received_with_variance' then 2
      when document.document_type in ('waste', 'internal_requisition', 'stock_adjustment', 'stock_count') then 3
      else 4
    end as priority,
    'pending_document'::text as kind,
    case
      when document.status = 'in_transit' then 'Chờ nhận hàng'
      when document.status = 'received_with_variance' then 'Chờ đối chiếu nhận lệch'
      when document.status = 'received' then 'Chờ khép phiếu'
      when document.status = 'approved' then 'Chờ bước xử lý tiếp theo'
      else 'Phiếu đang chờ xử lý'
    end as title,
    concat(document.document_no, ' · ', document.warehouse_name) as description,
    coalesce(document.source_warehouse_id, document.destination_warehouse_id) as warehouse_id,
    document.warehouse_name,
    null::uuid as item_id,
    null::text as item_code,
    null::text as item_name,
    document.id as document_id,
    document.document_no,
    document.document_type,
    document.status,
    document.route_page,
    'all'::text as stock_state,
    null::numeric as quantity,
    null::date as expires_on,
    null::text as lot_number,
    document.occurred_at
  from actionable_documents document
),
all_actions as (
  select * from expiry_actions
  union all
  select * from stock_actions
  union all
  select * from document_actions
),
top_actions as (
  select *
  from all_actions
  order by priority, expires_on nulls last, occurred_at desc nulls last
  limit 20
),
activity_7d as (
  select
    coalesce(sum(document.total_amount) filter (
      where document.document_type = 'purchase_receipt'
        and document.status = 'completed'
    ), 0) as receipt_value,
    coalesce(sum(document.total_amount) filter (
      where document.document_type in ('stock_issue', 'waste')
        and document.status = 'completed'
    ), 0) as issue_value,
    coalesce(sum(document.total_amount) filter (
      where document.document_type = 'stock_adjustment'
        and document.status = 'completed'
        and document.source_document_id is not null
    ), 0) as count_variance_value,
    count(*) filter (
      where document.document_type = 'transfer'
        and document.status in ('submitted', 'approved', 'in_transit', 'received', 'received_with_variance')
    ) as incomplete_transfers
  from public.inventory_documents document
  where document.occurred_at >= current_date - interval '6 days'
),
warehouse_stock as (
  select
    warehouse.id as warehouse_id,
    coalesce(sum(balance.quantity * balance.average_cost), 0) as inventory_value,
    count(balance.item_id) filter (where balance.quantity <= 0) as out_of_stock_count,
    count(balance.item_id) filter (
      where balance.reorder_point > 0 and balance.quantity <= balance.reorder_point
    ) as reorder_count
  from visible_warehouses warehouse
  left join visible_balances balance on balance.warehouse_id = warehouse.id
  group by warehouse.id
),
warehouse_expiry as (
  select
    lot.warehouse_id,
    count(*) filter (
      where lot.expires_on < current_date
        or (lot.warning_days > 0 and lot.expires_on <= current_date + lot.warning_days)
    ) as expiry_count
  from visible_lots lot
  group by lot.warehouse_id
),
warehouse_pending as (
  select warehouse_id, count(distinct document_id) as pending_count
  from (
    select document.id as document_id, document.source_warehouse_id as warehouse_id
    from actionable_documents document
    where document.source_warehouse_id is not null
    union all
    select document.id as document_id, document.destination_warehouse_id as warehouse_id
    from actionable_documents document
    where document.destination_warehouse_id is not null
  ) pending
  group by warehouse_id
),
warehouse_rows as (
  select
    warehouse.id,
    warehouse.code,
    warehouse.name,
    warehouse.warehouse_type,
    stock.inventory_value,
    stock.out_of_stock_count,
    stock.reorder_count,
    coalesce(expiry.expiry_count, 0) as expiry_count,
    coalesce(pending.pending_count, 0) as pending_count
  from visible_warehouses warehouse
  join warehouse_stock stock on stock.warehouse_id = warehouse.id
  left join warehouse_expiry expiry on expiry.warehouse_id = warehouse.id
  left join warehouse_pending pending on pending.warehouse_id = warehouse.id
)
select jsonb_build_object(
  'generated_at', statement_timestamp(),
  'kpis', jsonb_build_object(
    'inventory_value', coalesce((select sum(quantity * average_cost) from visible_balances), 0),
    'out_of_stock_count', (select count(*) from visible_balances where quantity <= 0),
    'reorder_count', (select count(*) from visible_balances where reorder_point > 0 and quantity <= reorder_point),
    'expired_count', (select count(*) from visible_lots where expires_on < current_date),
    'expiring_count', (
      select count(*)
      from visible_lots
      where expires_on >= current_date
        and warning_days > 0
        and expires_on <= current_date + warning_days
    ),
    'pending_count', (select count(*) from actionable_documents)
  ),
  'activity_7d', (
    select jsonb_build_object(
      'receipt_value', receipt_value,
      'issue_value', issue_value,
      'count_variance_value', count_variance_value,
      'incomplete_transfers', incomplete_transfers
    )
    from activity_7d
  ),
  'actions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'priority', action.priority,
      'kind', action.kind,
      'title', action.title,
      'description', action.description,
      'warehouse_id', action.warehouse_id,
      'warehouse_name', action.warehouse_name,
      'item_id', action.item_id,
      'item_code', action.item_code,
      'item_name', action.item_name,
      'document_id', action.document_id,
      'document_no', action.document_no,
      'document_type', action.document_type,
      'status', action.status,
      'route_page', action.route_page,
      'stock_state', action.stock_state,
      'quantity', action.quantity,
      'expires_on', action.expires_on,
      'lot_number', action.lot_number,
      'occurred_at', action.occurred_at
    ) order by action.priority, action.expires_on nulls last, action.occurred_at desc nulls last)
    from top_actions action
  ), '[]'::jsonb),
  'warehouses', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', warehouse.id,
      'code', warehouse.code,
      'name', warehouse.name,
      'warehouse_type', warehouse.warehouse_type,
      'inventory_value', warehouse.inventory_value,
      'out_of_stock_count', warehouse.out_of_stock_count,
      'reorder_count', warehouse.reorder_count,
      'expiry_count', warehouse.expiry_count,
      'pending_count', warehouse.pending_count
    ) order by
      case warehouse.warehouse_type when 'central' then 1 when 'branch' then 2 else 3 end,
      warehouse.name)
    from warehouse_rows warehouse
  ), '[]'::jsonb)
);
$$;

revoke execute on function public.get_inventory_dashboard_summary() from public;
revoke execute on function public.get_inventory_dashboard_summary() from anon;
grant execute on function public.get_inventory_dashboard_summary() to authenticated;

comment on function public.get_inventory_dashboard_summary() is
  'Tổng hợp Tổng quan kho theo RLS của tài khoản hiện tại; chỉ đọc và không thay đổi số tồn.';
