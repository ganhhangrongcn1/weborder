-- POS Loyalty Event RPC
-- Muc tieu:
-- 1. Tao RPC apply_loyalty_event ma frontend dang goi.
-- 2. Cho phep admin/staff/kitchen active cong/tru diem cho khach qua RPC.
-- 3. Khong can cap quyen insert/update truc tiep vao loyalty_accounts/loyalty_ledger cho nhan vien.
--
-- Cach chay:
-- Supabase Dashboard -> SQL Editor -> paste toan bo file nay -> Run.
--
-- Dieu kien:
-- - public.profiles da co auth_user_id cho tai khoan nhan vien dang dang nhap POS.
-- - public.profiles.role cua nhan vien la admin/staff/kitchen va status = active.
-- - public.loyalty_accounts.customer_phone co unique/on conflict.

create extension if not exists pgcrypto;

create or replace function public.normalize_vietnam_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');

  if v_digits ~ '^84[0-9]{9}$' then
    return '0' || substr(v_digits, 3);
  end if;

  if v_digits ~ '^0[0-9]{9}$' then
    return v_digits;
  end if;

  return '';
end;
$$;

create or replace function public.can_apply_loyalty_event(
  p_customer_phone text,
  p_entry_type text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_customer_phone text;
  v_entry_type text;
  v_profile public.profiles%rowtype;
  v_email text;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return true;
  end if;

  if auth.uid() is null then
    return false;
  end if;

  v_customer_phone := public.normalize_vietnam_phone(p_customer_phone);
  v_entry_type := upper(trim(coalesce(p_entry_type, '')));
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select *
  into v_profile
  from public.profiles
  where auth_user_id = auth.uid()
     or (v_email <> '' and lower(coalesce(email, '')) = v_email)
  order by case when auth_user_id = auth.uid() then 0 else 1 end
  limit 1;

  if not found or lower(coalesce(v_profile.status, '')) <> 'active' then
    return false;
  end if;

  if lower(coalesce(v_profile.role, '')) in ('admin', 'staff', 'kitchen') then
    return true;
  end if;

  -- Customer app can still write its own non-order loyalty events.
  -- POS/order earn/spend must be done by operational accounts above.
  if lower(coalesce(v_profile.role, '')) = 'customer'
    and public.normalize_vietnam_phone(v_profile.phone) = v_customer_phone
    and v_entry_type in ('CHECKIN', 'MILESTONE')
  then
    return true;
  end if;

  return false;
end;
$$;

drop function if exists public.apply_loyalty_event(text, text, integer, text, numeric, text, text, jsonb, timestamptz);

create or replace function public.apply_loyalty_event(
  p_customer_phone text,
  p_entry_type text,
  p_points integer,
  p_order_id text default null,
  p_amount numeric default 0,
  p_title text default '',
  p_note text default '',
  p_metadata jsonb default '{}'::jsonb,
  p_created_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_entry_type text;
  v_points integer;
  v_order_id text;
  v_amount numeric;
  v_created_at timestamptz;
  v_current_points integer;
  v_next_points integer;
  v_ledger_id text;
begin
  v_phone := public.normalize_vietnam_phone(p_customer_phone);
  v_entry_type := upper(trim(coalesce(p_entry_type, '')));
  v_points := coalesce(p_points, 0);
  v_order_id := nullif(trim(coalesce(p_order_id, '')), '');
  v_amount := coalesce(p_amount, 0);
  v_created_at := coalesce(p_created_at, now());

  if v_phone = '' then
    raise exception 'Số điện thoại không hợp lệ.';
  end if;

  if v_entry_type = '' then
    raise exception 'Loại sự kiện điểm không hợp lệ.';
  end if;

  if v_points = 0 then
    return;
  end if;

  if not public.can_apply_loyalty_event(v_phone, v_entry_type) then
    raise exception 'Tài khoản hiện tại chưa được quyền cộng/trừ điểm loyalty.';
  end if;

  -- Idempotent theo order_id cho cộng/trừ điểm đơn hàng.
  if v_order_id is not null
    and v_entry_type in ('ORDER_EARN', 'ORDER_SPEND')
    and exists (
      select 1
      from public.loyalty_ledger
      where customer_phone = v_phone
        and entry_type = v_entry_type
        and order_id = v_order_id
      limit 1
    )
  then
    return;
  end if;

  insert into public.profiles (phone, registered, role, status, metadata)
  values (
    v_phone,
    false,
    'customer',
    'active',
    jsonb_build_object('source', 'loyalty_event_rpc')
  )
  on conflict (phone) do nothing;

  insert into public.loyalty_accounts (
    customer_phone,
    total_points,
    metadata,
    updated_at
  )
  values (
    v_phone,
    0,
    jsonb_build_object('source', 'loyalty_event_rpc'),
    now()
  )
  on conflict (customer_phone) do nothing;

  select coalesce(total_points, 0)::integer
  into v_current_points
  from public.loyalty_accounts
  where customer_phone = v_phone
  for update;

  v_current_points := coalesce(v_current_points, 0);
  v_next_points := v_current_points + v_points;

  if v_next_points < 0 then
    raise exception 'Khách không đủ điểm để sử dụng. Hiện có %, cần %.',
      v_current_points,
      abs(v_points);
  end if;

  v_ledger_id := case
    when v_order_id is not null then
      lower(v_entry_type) || '-' || regexp_replace(v_order_id, '[^a-zA-Z0-9_-]', '-', 'g')
    else
      lower(v_entry_type) || '-' || gen_random_uuid()::text
  end;

  insert into public.loyalty_ledger (
    id,
    customer_phone,
    entry_type,
    order_id,
    points,
    amount,
    title,
    note,
    metadata,
    created_at
  )
  values (
    v_ledger_id,
    v_phone,
    v_entry_type,
    v_order_id,
    v_points,
    v_amount,
    nullif(trim(coalesce(p_title, '')), ''),
    nullif(trim(coalesce(p_note, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'source', 'apply_loyalty_event',
        'entryType', v_entry_type,
        'orderId', v_order_id
      ),
    v_created_at
  )
  on conflict (id) do nothing;

  update public.loyalty_accounts
  set
    total_points = v_next_points,
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'lastEntryType', v_entry_type,
        'lastOrderId', v_order_id,
        'lastPointsDelta', v_points,
        'lastEventAt', v_created_at
      ),
    updated_at = now()
  where customer_phone = v_phone;
end;
$$;

revoke execute on function public.can_apply_loyalty_event(text, text) from public, anon;
revoke execute on function public.apply_loyalty_event(text, text, integer, text, numeric, text, text, jsonb, timestamptz) from public, anon;
grant execute on function public.normalize_vietnam_phone(text) to anon, authenticated;
grant execute on function public.can_apply_loyalty_event(text, text) to authenticated;
grant execute on function public.apply_loyalty_event(text, text, integer, text, numeric, text, text, jsonb, timestamptz) to authenticated;

-- Select policy de POS/CRM doc diem neu loyalty tables dang bat RLS.
-- Khong cap insert/update/delete truc tiep; cong/tru diem dung RPC ben tren.
grant select on public.loyalty_accounts to authenticated;
grant select on public.loyalty_ledger to authenticated;

drop policy if exists loyalty_accounts_select_staff_or_owner on public.loyalty_accounts;
create policy loyalty_accounts_select_staff_or_owner
on public.loyalty_accounts
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and lower(coalesce(p.status, '')) = 'active'
      and (
        lower(coalesce(p.role, '')) in ('admin', 'staff', 'kitchen')
        or (
          lower(coalesce(p.role, '')) = 'customer'
          and public.normalize_vietnam_phone(p.phone) = public.normalize_vietnam_phone(loyalty_accounts.customer_phone)
        )
      )
  )
);

drop policy if exists loyalty_ledger_select_staff_or_owner on public.loyalty_ledger;
create policy loyalty_ledger_select_staff_or_owner
on public.loyalty_ledger
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and lower(coalesce(p.status, '')) = 'active'
      and (
        lower(coalesce(p.role, '')) in ('admin', 'staff', 'kitchen')
        or (
          lower(coalesce(p.role, '')) = 'customer'
          and public.normalize_vietnam_phone(p.phone) = public.normalize_vietnam_phone(loyalty_ledger.customer_phone)
        )
      )
  )
);

-- Kiem tra nhanh sau khi chay migration.
select
  'apply_loyalty_event_rpc_ready' as check_name,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'apply_loyalty_event'
  ) as ok;

select
  'active_operational_profiles' as check_name,
  count(*) as total
from public.profiles
where lower(coalesce(role, '')) in ('admin', 'staff', 'kitchen')
  and lower(coalesce(status, '')) = 'active'
  and auth_user_id is not null;
