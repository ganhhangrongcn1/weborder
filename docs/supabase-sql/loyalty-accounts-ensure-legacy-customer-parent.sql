-- Loyalty account parent hotfix.
-- Safe to rerun.
--
-- Context:
-- loyalty_accounts.customer_phone still references legacy public.customers(phone)
-- on the live database, while newer customer stubs are created in public.profiles.
-- This trigger keeps both parent tables present before loyalty_accounts writes.

create or replace function public.ensure_loyalty_customer_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_now timestamptz := now();
begin
  v_phone := public.normalize_vietnam_phone(new.customer_phone);

  if v_phone = '' then
    raise exception 'Số điện thoại loyalty không hợp lệ.';
  end if;

  new.customer_phone := v_phone;

  insert into public.profiles (
    phone,
    name,
    registered,
    role,
    status,
    metadata,
    created_at,
    updated_at
  )
  values (
    v_phone,
    '',
    false,
    'customer',
    'active',
    jsonb_build_object(
      'customer_stub', true,
      'customer_source_latest', 'loyalty_accounts_parent_trigger',
      'customer_stub_last_synced_at', v_now
    ),
    v_now,
    v_now
  )
  on conflict (phone) do nothing;

  insert into public.customers (
    phone,
    name,
    registered,
    member_rank,
    created_at,
    updated_at
  )
  values (
    v_phone,
    '',
    false,
    'Member',
    v_now,
    v_now
  )
  on conflict (phone) do update
  set updated_at = excluded.updated_at;

  return new;
end;
$$;

revoke execute on function public.ensure_loyalty_customer_parent() from public, anon, authenticated;

drop trigger if exists trg_ensure_loyalty_customer_parent on public.loyalty_accounts;

create trigger trg_ensure_loyalty_customer_parent
before insert or update of customer_phone
on public.loyalty_accounts
for each row
execute function public.ensure_loyalty_customer_parent();

notify pgrst, 'reload schema';
