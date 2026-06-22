-- Loyalty V2: add narrow metadata and voucher RPCs before frontend deployment.
-- This compatibility step does not revoke legacy permissions yet.

begin;

alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_ledger enable row level security;

create or replace function public.sync_loyalty_account_metadata(
  p_customer_phone text,
  p_vouchers jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private, auth
as $$
declare
  v_phone text := public.normalize_vietnam_phone(p_customer_phone);
  v_actor_role text := '';
  v_safe_vouchers jsonb := coalesce(p_vouchers, '[]'::jsonb);
  v_safe_metadata jsonb := coalesce(p_metadata, '{}'::jsonb)
    - 'totalPoints'
    - 'pointHistory'
    - 'checkinHistory';
begin
  select lower(coalesce(actor.actor_role, ''))
  into v_actor_role
  from loyalty_private.current_actor() actor;

  if v_actor_role not in ('service_role', 'admin', 'staff', 'kitchen', 'crm') then
    return false;
  end if;
  if coalesce(v_phone, '') = '' then
    raise exception 'Số điện thoại loyalty không hợp lệ.';
  end if;
  if jsonb_typeof(v_safe_vouchers) <> 'array' then
    raise exception 'Danh sách voucher loyalty phải là mảng JSON.';
  end if;
  if jsonb_array_length(v_safe_vouchers) > 500 or pg_column_size(v_safe_vouchers) > 1048576 then
    raise exception 'Danh sách voucher loyalty vượt giới hạn an toàn.';
  end if;
  if jsonb_typeof(v_safe_metadata) <> 'object' or pg_column_size(v_safe_metadata) > 1048576 then
    raise exception 'Metadata loyalty không hợp lệ hoặc vượt giới hạn an toàn.';
  end if;

  insert into public.loyalty_accounts (
    customer_phone,
    total_points,
    vouchers,
    metadata
  ) values (
    v_phone,
    0,
    v_safe_vouchers,
    v_safe_metadata
  )
  on conflict (customer_phone) do update
  set vouchers = excluded.vouchers,
      metadata = coalesce(public.loyalty_accounts.metadata, '{}'::jsonb) || excluded.metadata,
      updated_at = now();

  return true;
end;
$$;

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
set search_path = pg_catalog, public, loyalty_private, auth
as $$
declare
  v_phone text := public.normalize_vietnam_phone(p_customer_phone);
  v_voucher_id text := trim(coalesce(p_voucher_id, ''));
  v_voucher_code text := upper(trim(coalesce(p_voucher_code, '')));
  v_actor_phone text := '';
  v_actor_role text := '';
  v_updated_count integer := 0;
begin
  select
    public.normalize_vietnam_phone(actor.actor_phone),
    lower(coalesce(actor.actor_role, ''))
  into v_actor_phone, v_actor_role
  from loyalty_private.current_actor() actor;

  if v_actor_role = 'customer' then
    if v_actor_phone <> v_phone or p_used is not true then
      raise exception 'Tài khoản hiện tại không được phép thay đổi voucher này.';
    end if;
  elsif v_actor_role not in ('service_role', 'admin', 'staff', 'kitchen', 'crm') then
    raise exception 'Tài khoản hiện tại không được phép thay đổi voucher loyalty.';
  end if;

  if coalesce(v_phone, '') = '' or (v_voucher_id = '' and v_voucher_code = '') then
    raise exception 'Thiếu thông tin voucher loyalty hợp lệ.';
  end if;

  update public.loyalty_accounts account
  set vouchers = (
        select coalesce(
          jsonb_agg(
            case
              when (
                (v_voucher_id <> '' and trim(coalesce(voucher.value ->> 'id', '')) = v_voucher_id)
                or (
                  v_voucher_code <> ''
                  and upper(trim(coalesce(voucher.value ->> 'code', ''))) = v_voucher_code
                )
              ) then
                case
                  when p_used then voucher.value || jsonb_build_object(
                    'used', true,
                    'usedAt', coalesce(p_used_at, now()),
                    'orderCode', trim(coalesce(p_order_id, ''))
                  )
                  else (voucher.value - 'usedAt' - 'orderCode') || jsonb_build_object('used', false)
                end
              else voucher.value
            end
            order by voucher.ordinality
          ),
          '[]'::jsonb
        )
        from jsonb_array_elements(coalesce(account.vouchers, '[]'::jsonb))
          with ordinality as voucher(value, ordinality)
      ),
      updated_at = now()
  where account.customer_phone = v_phone
    and exists (
      select 1
      from jsonb_array_elements(coalesce(account.vouchers, '[]'::jsonb)) as item(value)
      where (v_voucher_id <> '' and trim(coalesce(item.value ->> 'id', '')) = v_voucher_id)
         or (
           v_voucher_code <> ''
           and upper(trim(coalesce(item.value ->> 'code', ''))) = v_voucher_code
         )
    );

  get diagnostics v_updated_count = row_count;
  return v_updated_count > 0;
end;
$$;

revoke all on function public.sync_loyalty_account_metadata(text, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function public.sync_loyalty_account_metadata(text, jsonb, jsonb)
to authenticated, service_role;

revoke all on function public.set_loyalty_voucher_usage(text, text, text, text, timestamptz, boolean)
from public, anon, authenticated;
grant execute on function public.set_loyalty_voucher_usage(text, text, text, text, timestamptz, boolean)
to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
