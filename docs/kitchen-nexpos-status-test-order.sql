-- Test order for NexPOS status handling on /kitchen.
-- Run this in Supabase SQL editor.
--
-- It creates one partner order:
--   TEST-KITCHEN-001
--
-- Then run one of the status update blocks at the bottom to test:
--   DOING, FINISH, PRE_ORDER, CANCELLED

with selected_branch as (
  select
    nullif(trim(coalesce(p.metadata ->> 'branch_uuid', p.metadata ->> 'branchUuid', '')), '') as branch_uuid_text,
    nullif(trim(coalesce(p.metadata ->> 'branch_id', p.metadata ->> 'branchId', '')), '') as branch_id,
    nullif(trim(coalesce(p.metadata ->> 'branch_name', p.metadata ->> 'branchName', '')), '') as branch_name
  from public.profiles p
  where p.status = 'active'
    and p.role in ('admin', 'staff', 'kitchen')
    and (
      nullif(trim(coalesce(p.metadata ->> 'branch_uuid', p.metadata ->> 'branchUuid', '')), '') is not null
      or nullif(trim(coalesce(p.metadata ->> 'branch_name', p.metadata ->> 'branchName', '')), '') is not null
    )
  order by p.updated_at desc nulls last, p.created_at desc nulls last
  limit 1
),
branch_payload as (
  select
    case
      when branch_uuid_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then branch_uuid_text::uuid
      else null
    end as branch_uuid,
    coalesce(branch_id, branch_uuid_text, 'TEST-BRANCH') as branch_id,
    coalesce(branch_name, 'Chi nhánh test') as branch_name
  from selected_branch
  union all
  select
    null::uuid,
    'TEST-BRANCH',
    'Chi nhánh test'
  where not exists (select 1 from selected_branch)
),
test_order as (
  insert into public.partner_orders (
    order_code,
    display_order_code,
    nexpos_order_id,
    nexpos_status,
    partner_source,
    branch_id,
    branch_uuid,
    branch_name,
    nexpos_hub_id,
    nexpos_hub_name,
    nexpos_site_id,
    nexpos_site_name,
    customer_name,
    customer_phone,
    customer_phone_key,
    subtotal,
    discount_amount,
    shipping_fee,
    total_amount,
    points_base_amount,
    order_status,
    kitchen_status,
    kitchen_work_status,
    point_status,
    order_time,
    raw_data
  )
  select
    'TEST-KITCHEN-001',
    'TEST-KITCHEN-001',
    'NEXPOS-TEST-KITCHEN-001',
    'DOING',
    'grabfood',
    branch_payload.branch_id,
    branch_payload.branch_uuid,
    branch_payload.branch_name,
    'TEST-HUB',
    branch_payload.branch_name,
    branch_payload.branch_id,
    branch_payload.branch_name,
    'Khách test bếp',
    '0900000001',
    '0900000001',
    89000,
    0,
    0,
    89000,
    89000,
    'preparing',
    'cooking',
    'pending',
    'pending',
    now(),
    jsonb_build_object(
      'test', true,
      'status', 'DOING',
      'source', 'grab',
      'note', 'Đơn test trạng thái NexPOS cho bếp'
    )
  from branch_payload
  limit 1
  on conflict (order_code) do update
  set
    display_order_code = excluded.display_order_code,
    nexpos_order_id = excluded.nexpos_order_id,
    nexpos_status = excluded.nexpos_status,
    partner_source = excluded.partner_source,
    branch_id = excluded.branch_id,
    branch_uuid = excluded.branch_uuid,
    branch_name = excluded.branch_name,
    nexpos_hub_id = excluded.nexpos_hub_id,
    nexpos_hub_name = excluded.nexpos_hub_name,
    nexpos_site_id = excluded.nexpos_site_id,
    nexpos_site_name = excluded.nexpos_site_name,
    customer_name = excluded.customer_name,
    customer_phone = excluded.customer_phone,
    customer_phone_key = excluded.customer_phone_key,
    subtotal = excluded.subtotal,
    discount_amount = excluded.discount_amount,
    shipping_fee = excluded.shipping_fee,
    total_amount = excluded.total_amount,
    points_base_amount = excluded.points_base_amount,
    order_status = excluded.order_status,
    kitchen_status = excluded.kitchen_status,
    kitchen_work_status = excluded.kitchen_work_status,
    order_time = excluded.order_time,
    raw_data = excluded.raw_data,
    kitchen_done_at = null,
    updated_at = now()
  returning id, order_code
),
deleted_old_items as (
  delete from public.partner_order_items
  where order_code = 'TEST-KITCHEN-001'
)
insert into public.partner_order_items (
  item_key,
  partner_order_id,
  order_code,
  partner_source,
  branch_id,
  branch_uuid,
  nexpos_hub_id,
  nexpos_site_id,
  partner_item_id,
  partner_item_sku,
  partner_item_name,
  web_product_id,
  web_product_name,
  quantity,
  unit_price,
  line_total,
  options,
  note,
  item_status,
  kitchen_item_status
)
select
  concat(test_order.order_code, '-', item.partner_item_id),
  test_order.id,
  test_order.order_code,
  'grabfood',
  branch_payload.branch_id,
  branch_payload.branch_uuid,
  'TEST-HUB',
  branch_payload.branch_id,
  item.partner_item_id,
  item.partner_item_sku,
  item.partner_item_name,
  null,
  '',
  item.quantity,
  item.unit_price,
  item.line_total,
  item.options,
  item.note,
  'pending',
  'pending'
from test_order
cross join branch_payload
cross join (
  values
    (
      'test-banh-trang',
      'BT-TEST',
      'Bánh Tráng Trộn Test',
      1::numeric,
      49000::numeric,
      49000::numeric,
      '[{"name":"Mức Độ Cay: Hơi Cay"},{"name":"Ngon Hơn Khi Ăn Cùng: Tóp mỡ mắm tỏi da giòn","price":10000}]'::jsonb,
      'ít rau'
    ),
    (
      'test-tra-tac',
      'TRA-TEST',
      'Trà Tắc Test',
      1::numeric,
      40000::numeric,
      40000::numeric,
      '[{"name":"Size: L"}]'::jsonb,
      ''
    )
) as item(
  partner_item_id,
  partner_item_sku,
  partner_item_name,
  quantity,
  unit_price,
  line_total,
  options,
  note
);

select
  order_code,
  partner_source,
  branch_id,
  branch_uuid,
  branch_name,
  nexpos_status,
  order_status,
  kitchen_status,
  kitchen_work_status,
  raw_data ->> 'status' as raw_status
from public.partner_orders
where order_code = 'TEST-KITCHEN-001';

-- =========================
-- STATUS TEST BLOCKS
-- Run one block at a time.
-- =========================

-- 1) Test active order: should appear in Đang làm.
-- update public.partner_orders
-- set
--   nexpos_status = 'DOING',
--   order_status = 'preparing',
--   kitchen_status = 'cooking',
--   kitchen_work_status = 'pending',
--   kitchen_done_at = null,
--   raw_data = jsonb_set(coalesce(raw_data, '{}'::jsonb), '{status}', '"DOING"', true),
--   updated_at = now()
-- where order_code = 'TEST-KITCHEN-001';

-- 2) Test finished order: should move to Đã xong.
-- update public.partner_orders
-- set
--   nexpos_status = 'FINISH',
--   order_status = 'completed',
--   kitchen_status = 'served',
--   raw_data = jsonb_set(coalesce(raw_data, '{}'::jsonb), '{status}', '"FINISH"', true),
--   updated_at = now()
-- where order_code = 'TEST-KITCHEN-001';

-- 3) Test pre-order: should hide from Đang làm.
-- update public.partner_orders
-- set
--   nexpos_status = 'PRE_ORDER',
--   kitchen_work_status = 'pending',
--   kitchen_done_at = null,
--   raw_data = jsonb_set(coalesce(raw_data, '{}'::jsonb), '{status}', '"PRE_ORDER"', true),
--   updated_at = now()
-- where order_code = 'TEST-KITCHEN-001';

-- 4) Test cancelled order: should appear in Đã hủy.
-- update public.partner_orders
-- set
--   nexpos_status = 'CANCELLED',
--   order_status = 'cancelled',
--   kitchen_status = 'cancelled',
--   raw_data = jsonb_set(coalesce(raw_data, '{}'::jsonb), '{status}', '"CANCELLED"', true),
--   updated_at = now()
-- where order_code = 'TEST-KITCHEN-001';
