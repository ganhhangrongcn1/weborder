-- GHR Cake: gia cố quyền tạo đơn công khai cho route /banhkembanhtrang.
-- An toàn để chạy lại nhiều lần. Không xóa dữ liệu và không đổi quyền đọc của khách.

grant usage on schema public to anon, authenticated;
grant insert on table public.cake_orders to anon, authenticated;
grant select, update on table public.cake_orders to authenticated;

alter table public.cake_orders enable row level security;

drop policy if exists "cake_orders_insert_public" on public.cake_orders;
create policy "cake_orders_insert_public"
  on public.cake_orders
  for insert
  to anon, authenticated
  with check (
    status = 'new'
    and fulfillment_type in ('pickup', 'delivery')
    and length(btrim(order_code)) between 3 and 32
    and length(btrim(cake_id)) between 1 and 120
    and length(btrim(cake_name)) between 1 and 200
    and cake_price >= 0
    and cake_price <= 10000000
    and length(btrim(customer_name)) between 1 and 120
    and customer_phone ~ '^0[0-9]{9}$'
    and length(coalesce(cake_message, '')) <= 300
    and length(coalesce(delivery_address, '')) <= 500
    and length(coalesce(note, '')) <= 1000
    and (shipping_fee is null or (shipping_fee >= 0 and shipping_fee <= 5000000))
    and (
      fulfillment_type = 'pickup'
      or length(btrim(coalesce(delivery_address, ''))) >= 5
    )
  );

drop policy if exists "cake_orders_select_admin_staff" on public.cake_orders;
create policy "cake_orders_select_admin_staff"
  on public.cake_orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = (select auth.uid())
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
      where p.auth_user_id = (select auth.uid())
        and p.role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.auth_user_id = (select auth.uid())
        and p.role in ('admin', 'staff')
    )
  );

notify pgrst, 'reload schema';

select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'cake_orders'
order by policyname;
