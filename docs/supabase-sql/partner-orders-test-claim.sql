-- Partner order claim test for GHR.
-- Run after docs/partner-orders-claim-points.sql.
--
-- If you run this file again and the order was already claimed,
-- change GF-TEST-001 to a new code, for example GF-TEST-002.

insert into public.profiles (
  phone,
  name,
  registered,
  role,
  status
)
values (
  '0900000000',
  'Khách test FoodApp',
  true,
  'customer',
  'active'
)
on conflict (phone) do update
set
  name = excluded.name,
  registered = true,
  updated_at = now();

with test_order as (
  insert into public.partner_orders (
    order_code,
    partner_source,
    branch_id,
    branch_name,
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
    point_status,
    order_time,
    raw_data
  )
  values (
    'GF-TEST-001',
    'grabfood',
    'branch-1',
    'Chi nhánh test',
    'Khách test FoodApp',
    '0900000000',
    '0900000000',
    125000,
    0,
    0,
    125000,
    125000,
    'completed',
    'pending',
    'pending',
    now(),
    jsonb_build_object(
      'test', true,
      'note', 'Đơn test claim điểm từ partner_orders'
    )
  )
  on conflict (order_code) do update
  set
    partner_source = excluded.partner_source,
    branch_id = excluded.branch_id,
    branch_name = excluded.branch_name,
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
    order_time = excluded.order_time,
    raw_data = excluded.raw_data,
    updated_at = now()
  returning id, order_code
),
deleted_old_items as (
  delete from public.partner_order_items
  where order_code = 'GF-TEST-001'
)
insert into public.partner_order_items (
  partner_order_id,
  order_code,
  partner_source,
  branch_id,
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
  item_status
)
select
  test_order.id,
  test_order.order_code,
  'grabfood',
  'branch-1',
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
  'pending'
from test_order
cross join (
  values
    (
      'gf-item-001',
      'BT-TRON',
      'Bánh tráng trộn đặc biệt',
      2::numeric,
      45000::numeric,
      90000::numeric,
      '[{"name":"Ít cay"}]'::jsonb,
      'Không hành'
    ),
    (
      'gf-item-002',
      'TRA-TAC',
      'Trà tắc',
      1::numeric,
      35000::numeric,
      35000::numeric,
      '[]'::jsonb,
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

select *
from public.claim_partner_order_points(
  p_order_code := 'GF-TEST-001',
  p_customer_phone := '0900000000'
);

select
  order_code,
  partner_source,
  customer_phone_key,
  total_amount,
  points_base_amount,
  order_status,
  kitchen_status,
  point_status,
  claimed_customer_phone,
  claimed_at
from public.partner_orders
where order_code = 'GF-TEST-001';

select
  customer_phone,
  total_points,
  updated_at
from public.loyalty_accounts
where customer_phone = '0900000000';

select
  id,
  customer_phone,
  entry_type,
  order_id,
  partner_order_code,
  source,
  points,
  amount,
  title,
  created_at
from public.loyalty_ledger
where partner_order_code = 'GF-TEST-001'
order by created_at desc;
