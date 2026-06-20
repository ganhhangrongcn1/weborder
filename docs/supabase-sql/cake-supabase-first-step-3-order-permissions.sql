-- GHR Cake Supabase-first - Step 3: cake_orders runtime permissions
-- Run this file in Supabase SQL Editor if runtime insert returns:
-- permission denied for table cake_orders
--
-- Goal:
-- Grant the minimum SQL privileges needed by the cake order flow.
--
-- Safe notes:
-- - This file does not delete public data.
-- - It does not DELETE/TRUNCATE/DROP public.* tables.
-- - RLS policies still control which rows can be inserted/read/updated.

grant usage on schema public to anon, authenticated;

grant insert on table public.cake_orders to anon, authenticated;
grant select, update on table public.cake_orders to authenticated;

-- Keep RLS enabled. Policies decide actual row access.
alter table public.cake_orders enable row level security;

-- Ensure the expected insert policy exists.
drop policy if exists "cake_orders_insert_public" on public.cake_orders;
create policy "cake_orders_insert_public"
  on public.cake_orders
  for insert
  to anon, authenticated
  with check (true);

-- Admin/staff select policy.
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

-- Admin/staff update policy.
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

select
  'cake_orders permissions updated' as result,
  now() as checked_at;
