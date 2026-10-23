# Source Of Truth Live Regression Checklist

Mục tiêu:
- chốt nhanh xem source of truth hiện tại đã chạy ổn ở live chưa
- kiểm tra theo đúng business flow thật
- có SQL check nhanh sau mỗi bước

## 1. Partner Order Ingest

### Bước test
- chờ 1 đơn mới từ:
  - `grabfood`
  - `shopeefood`
  - `xanhngon` nếu có
- ghi lại:
  - `order_code`
  - `partner_source`
  - `customer_phone_key`
  - `branch_name`

### Kỳ vọng
- đơn vào `partner_orders`
- item vào `partner_order_items`
- không ghi đè đơn cũ chỉ vì trùng `order_code`
- `partner_source + nexpos_order_id` vẫn là identity thật

### SQL check
```sql
select
  id,
  order_code,
  partner_source,
  nexpos_order_id,
  branch_name,
  customer_name,
  customer_phone,
  customer_phone_key,
  order_status,
  kitchen_status,
  created_at
from public.partner_orders
where created_at >= now() - interval '2 hours'
order by created_at desc;
```

## 2. Partner Customer Profile Hydration

### Bước test
- lấy 1 đơn partner mới có `customer_phone_key` hợp lệ
- check customer đó trong `profiles`

### Kỳ vọng
- có `profile`
- `role = customer`
- `registered = false`
- `metadata.customer_stub = true`
- `metadata.customer_source_latest` đúng nguồn

### SQL check
```sql
select
  id,
  phone,
  name,
  role,
  registered,
  metadata ->> 'customer_stub' as customer_stub,
  metadata ->> 'customer_source_first' as source_first,
  metadata ->> 'customer_source_latest' as source_latest,
  metadata ->> 'customer_source_ref_latest' as source_ref_latest,
  created_at,
  updated_at
from public.profiles
where phone = '0339413274';
```

## 3. Phone Invalid / Missing Case

### Bước test
- tìm 1 đơn partner có `customer_phone_key = ''`

### Kỳ vọng
- đơn vẫn vào `partner_orders`
- không tự tạo profile rác

### SQL check
```sql
select
  order_code,
  partner_source,
  customer_name,
  customer_phone,
  customer_phone_key
from public.partner_orders
where nullif(trim(coalesce(customer_phone_key, '')), '') is null
order by created_at desc
limit 20;
```

## 4. Claim Điểm Partner

### Bước test
- claim 1 đơn partner chưa claim
- claim lại lần 2

### Kỳ vọng
- lần 1 claim thành công
- lần 2 không cộng trùng
- `point_status = claimed`
- ledger chỉ có 1 dòng earn hợp lệ

### SQL check
```sql
select
  id,
  order_code,
  partner_source,
  point_status,
  claimed_by_profile_id,
  claimed_customer_phone,
  claimed_at
from public.partner_orders
where order_code = 'GF-062';
```

```sql
select
  entry_type,
  customer_phone,
  order_id,
  partner_order_id,
  partner_order_code,
  points,
  amount,
  created_at
from public.loyalty_ledger
where partner_order_code = 'GF-062'
order by created_at desc;
```

## 5. Tracking Summary

### Bước test
- mở tracking theo 1 số có:
  - web orders
  - partner orders
- so khớp tổng đơn, tổng chi tiêu, pending/claimed points

### Kỳ vọng
- tracking summary tính cả web + partner
- không tính:
  - `cancelled`
  - `refunded`
  - `preorder`
  - `scheduled`
- không bị lệch vì format phone khác nhau

### SQL check
```sql
select
  id,
  order_code,
  customer_phone,
  status,
  total_amount,
  created_at
from public.orders
where customer_phone in ('0339413274', '339413274', '84339413274', '+84339413274', '0084339413274')
order by created_at desc;
```

```sql
select
  id,
  order_code,
  partner_source,
  customer_phone,
  customer_phone_key,
  order_status,
  nexpos_status,
  total_amount,
  points_base_amount,
  point_status,
  order_time
from public.partner_orders
where customer_phone_key in ('0339413274', '339413274', '84339413274', '+84339413274', '0084339413274')
   or customer_phone in ('0339413274', '339413274', '84339413274', '+84339413274', '0084339413274')
order by order_time desc;
```

## 6. Kitchen Quà Tháng / Đơn Thứ 3

### Bước test
- chọn 1 khách có đủ 3 đơn trong tháng
- mở kitchen card của đơn mới nhất
- thử claim quà tháng

### Kỳ vọng
- `monthlyOrderCount` đúng
- khách đủ điều kiện thì hiện badge/quà đúng
- claim thành công 1 lần
- claim lại không tạo trùng
- quà tháng không dựa vào `profiles.total_orders` để quyết định

### SQL check
```sql
select
  customer_key,
  customer_key_type,
  customer_name,
  customer_phone,
  reward_month,
  order_count_at_claim,
  gift_code,
  gift_name,
  claimed_order_source,
  claimed_order_id,
  claimed_order_code,
  claimed_by_name,
  claimed_at
from public.monthly_customer_gifts
where reward_month = to_char(now(), 'YYYY-MM')
order by claimed_at desc;
```

## 7. CRM Totals

### Bước test
- mở CRM
- tìm 1 khách partner mới hydrate
- tìm 1 khách web cũ
- tìm 1 khách vừa có web vừa có partner

### Kỳ vọng
- `totalOrders` và `totalSpent` không cộng đơn bị loại
- `tier` đi theo `totalSpent`
- khách chưa đăng ký nhưng có giao dịch vẫn hiện trong CRM
- khách đăng ký nhưng chưa có giao dịch vẫn hiện, nhưng không bị cộng đơn giả

### SQL check
```sql
select
  po.customer_phone_key,
  count(*) as partner_orders_count,
  sum(coalesce(po.total_amount, 0)) as partner_total_spent
from public.partner_orders po
where nullif(trim(coalesce(po.customer_phone_key, '')), '') is not null
  and lower(coalesce(po.order_status, '')) not in ('cancelled', 'refunded', 'preorder', 'scheduled')
group by po.customer_phone_key
order by partner_orders_count desc
limit 20;
```

## 8. Duplicate Customer Safety

### Bước test
- kiểm tra không có duplicate `customer` profile theo phone
- kiểm tra admin/staff/kitchen không bị hydrate nhầm thành customer

### SQL check
```sql
select
  phone,
  count(*) as total
from public.profiles
where lower(coalesce(role, 'customer')) = 'customer'
group by phone
having count(*) > 1;
```

```sql
select
  phone,
  role,
  registered,
  metadata
from public.profiles
where phone = '0383340888';
```

## 9. Backfill Done Check

### Mục tiêu
- xác nhận không còn phone hợp lệ nào trong `partner_orders` mà thiếu `profiles`

### SQL check
```sql
select
  po.partner_source,
  count(distinct po.customer_phone_key) as missing_phone_count
from public.partner_orders po
left join public.profiles p
  on p.phone = po.customer_phone_key
where nullif(trim(coalesce(po.customer_phone_key, '')), '') is not null
  and p.id is null
group by po.partner_source
order by po.partner_source;
```

### Kỳ vọng
- nếu source of truth đã sạch backlog:
  - `grabfood = 0`
  - `shopeefood = 0`
  - `xanhngon = 0`

## 10. Pass Điều Kiện Cuối

Coi như pass live regression khi:
- partner order mới vào được
- partner item vào được
- customer profile tự hydrate đúng
- claim điểm partner idempotent
- kitchen quà tháng đếm đúng
- tracking summary không lệch do phone format
- CRM không lệch tổng đơn / tổng chi tiêu
- không có duplicate customer profile theo phone
- không còn backlog phone hợp lệ thiếu profile
