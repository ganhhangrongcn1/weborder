-- Module: Bánh sinh nhật bánh tráng
-- Tạo bảng đơn bánh riêng và seed 2 config key dùng bởi trang /banhkembanhtrang.
-- Safe to run multiple times.

create table if not exists public.cake_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  cake_id text not null,
  cake_name text not null,
  cake_price numeric not null default 0,
  customer_name text not null,
  customer_phone text not null,
  pickup_time timestamptz,
  cake_message text default '',
  fulfillment_type text not null default 'pickup',
  delivery_address text default '',
  delivery_lat numeric,
  delivery_lng numeric,
  distance_km numeric,
  shipping_fee numeric,
  note text default '',
  status text not null default 'new',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cake_orders_created_at_idx
  on public.cake_orders (created_at desc);

create index if not exists cake_orders_customer_phone_idx
  on public.cake_orders (customer_phone);

alter table public.cake_orders enable row level security;

drop policy if exists "cake_orders_insert_public" on public.cake_orders;
create policy "cake_orders_insert_public"
  on public.cake_orders
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "cake_orders_select_admin_staff" on public.cake_orders;
create policy "cake_orders_select_admin_staff"
  on public.cake_orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.role in ('admin', 'staff')
    )
  );

drop policy if exists "cake_orders_update_admin_staff" on public.cake_orders;
create policy "cake_orders_update_admin_staff"
  on public.cake_orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.role in ('admin', 'staff')
    )
  );

insert into public.app_configs (id, value, updated_at)
values
  (
    'ghr_cake_settings',
    '{
      "zaloPhone": "0788422424",
      "pickupAddress": "Gánh Hàng Rong",
      "orderNotice": "Đặt trước tối thiểu 2 - 4 tiếng để shop chuẩn bị bánh đẹp nhất.",
      "featuredProductIds": [
        "set-trai-tim-couple",
        "set-banh-trang-cuon-bo-18cm",
        "set-cuon-bo-mix-ps-muoi-tac-18cm",
        "set-banh-trang-cuon-tron-mix-topping-18cm"
      ],
      "shippingConfig": {
        "baseFeeFirst3Km": 25000,
        "feePerNextKm": 8000,
        "freeShipThreshold": 0,
        "supportShippingEnabled": false,
        "maxSupportShipFee": 0,
        "customerNote": "Bánh sinh nhật cần giao cẩn thận nên phí ship sẽ được tính riêng.",
        "maxRadiusKm": 12,
        "sourceBranchId": ""
      }
    }'::jsonb,
    now()
  )
on conflict (id) do nothing;

-- Danh sách bánh mặc định đã nằm trong frontend để tránh file SQL quá dài.
-- Khi admin bấm "Lưu cấu hình" ở /admin/cakes, key ghr_cake_products sẽ được ghi vào app_configs.
