-- CRM voucher RPCs for staff-managed loyalty vouchers.
-- Use this after loyalty tables are locked down from direct frontend writes.

create or replace function public.crm_loyalty_staff_can_write()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and coalesce(p.status, 'active') = 'active'
      and coalesce(p.role, '') in ('admin', 'staff')
  );
$$;

revoke execute on function public.crm_loyalty_staff_can_write() from public, anon, authenticated;

create or replace function public.sync_loyalty_account_metadata(
  p_customer_phone text,
  p_vouchers jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_vouchers jsonb;
  v_metadata jsonb;
begin
  if not public.crm_loyalty_staff_can_write() then
    raise exception 'Tai khoan hien tai chua du quyen cap nhat voucher loyalty.';
  end if;

  v_phone := public.normalize_vietnam_phone(p_customer_phone);
  if coalesce(v_phone, '') = '' then
    raise exception 'So dien thoai loyalty khong hop le.';
  end if;

  v_vouchers := case
    when jsonb_typeof(coalesce(p_vouchers, '[]'::jsonb)) = 'array' then coalesce(p_vouchers, '[]'::jsonb)
    else '[]'::jsonb
  end;
  v_metadata := case
    when jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object' then coalesce(p_metadata, '{}'::jsonb)
    else '{}'::jsonb
  end;

  insert into public.profiles (phone, registered, role, status, metadata)
  values (
    v_phone,
    false,
    'customer',
    'active',
    jsonb_build_object('source', 'crm_voucher_rpc')
  )
  on conflict (phone) do update
    set metadata = coalesce(public.profiles.metadata, '{}'::jsonb)
        || jsonb_build_object('last_loyalty_touch', 'crm_voucher_rpc'),
        updated_at = now();

  insert into public.loyalty_accounts (
    customer_phone,
    total_points,
    vouchers,
    metadata
  )
  values (
    v_phone,
    0,
    v_vouchers,
    (v_metadata - 'pointHistory' - 'voucherHistory')
      || jsonb_build_object('source', 'crm_voucher_rpc')
  )
  on conflict (customer_phone) do update
    set vouchers = excluded.vouchers,
        metadata = coalesce(public.loyalty_accounts.metadata, '{}'::jsonb)
          || excluded.metadata,
        updated_at = now();

  return true;
end;
$$;

revoke execute on function public.sync_loyalty_account_metadata(text, jsonb, jsonb) from public, anon;
grant execute on function public.sync_loyalty_account_metadata(text, jsonb, jsonb) to authenticated;

create or replace function public.set_loyalty_voucher_usage(
  p_customer_phone text,
  p_voucher_id text default '',
  p_voucher_code text default '',
  p_order_id text default '',
  p_used_at timestamptz default now(),
  p_used boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_voucher_id text;
  v_voucher_code text;
  v_is_staff boolean;
  v_is_owner boolean;
  v_current_vouchers jsonb;
  v_next_vouchers jsonb;
  v_found boolean;
begin
  v_phone := public.normalize_vietnam_phone(p_customer_phone);
  v_voucher_id := trim(coalesce(p_voucher_id, ''));
  v_voucher_code := upper(trim(coalesce(p_voucher_code, '')));

  if coalesce(v_phone, '') = '' then
    raise exception 'So dien thoai loyalty khong hop le.';
  end if;
  if v_voucher_id = '' and v_voucher_code = '' then
    raise exception 'Can voucher id hoac voucher code de cap nhat.';
  end if;

  select public.crm_loyalty_staff_can_write() into v_is_staff;
  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and public.normalize_vietnam_phone(p.phone) = v_phone
      and coalesce(p.status, 'active') = 'active'
  )
  into v_is_owner;

  if not coalesce(v_is_staff, false) and not coalesce(v_is_owner, false) then
    raise exception 'Tai khoan hien tai chua du quyen cap nhat voucher nay.';
  end if;

  select coalesce(vouchers, '[]'::jsonb)
  into v_current_vouchers
  from public.loyalty_accounts
  where customer_phone = v_phone;

  if v_current_vouchers is null then
    return false;
  end if;

  select
    coalesce(jsonb_agg(
      case
        when matched then
          voucher
          || jsonb_build_object(
            'used', coalesce(p_used, true),
            'usedAt', case when coalesce(p_used, true) then coalesce(p_used_at, now())::text else '' end,
            'orderCode', trim(coalesce(p_order_id, ''))
          )
        else voucher
      end
    ), '[]'::jsonb),
    coalesce(bool_or(matched), false)
  into v_next_vouchers, v_found
  from (
    select
      item.voucher,
      (
        (v_voucher_id <> '' and coalesce(item.voucher ->> 'id', '') = v_voucher_id)
        or
        (v_voucher_code <> '' and upper(coalesce(item.voucher ->> 'code', '')) = v_voucher_code)
      ) as matched
    from jsonb_array_elements(v_current_vouchers) as item(voucher)
  ) source;

  if not coalesce(v_found, false) then
    return false;
  end if;

  update public.loyalty_accounts
  set vouchers = v_next_vouchers,
      updated_at = now()
  where customer_phone = v_phone;

  return true;
end;
$$;

revoke execute on function public.set_loyalty_voucher_usage(text, text, text, text, timestamptz, boolean) from public, anon;
grant execute on function public.set_loyalty_voucher_usage(text, text, text, text, timestamptz, boolean) to authenticated;

notify pgrst, 'reload schema';
