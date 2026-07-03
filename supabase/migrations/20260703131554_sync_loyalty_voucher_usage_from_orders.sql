-- Sync loyalty wallet voucher usage from real order state.
-- This fixes cases where a loyalty voucher was used on an order
-- but remained marked as unused in loyalty_accounts.vouchers.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function loyalty_private.compute_loyalty_voucher_usage_from_orders(
  p_customer_phone text,
  p_vouchers jsonb default '[]'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  with normalized as (
    select
      public.normalize_vietnam_phone(p_customer_phone) as customer_phone,
      case
        when jsonb_typeof(coalesce(p_vouchers, '[]'::jsonb)) = 'array'
          then coalesce(p_vouchers, '[]'::jsonb)
        else '[]'::jsonb
      end as vouchers
  ),
  voucher_rows as (
    select
      item.ordinality,
      item.voucher
    from normalized
    cross join lateral jsonb_array_elements(normalized.vouchers) with ordinality as item(voucher, ordinality)
  ),
  matched as (
    select
      voucher_rows.ordinality,
      voucher_rows.voucher,
      coalesce(order_match.used, false) as used,
      coalesce(order_match.used_at_text, '') as used_at_text,
      coalesce(order_match.order_code, '') as order_code
    from voucher_rows
    cross join normalized
    left join lateral (
      select
        true as used,
        o.created_at::text as used_at_text,
        coalesce(nullif(btrim(o.order_code), ''), btrim(o.id)) as order_code
      from public.orders o
      where normalized.customer_phone <> ''
        and public.normalize_vietnam_phone(o.customer_phone) = normalized.customer_phone
        and public.normalize_order_counting_status(o.status) not in (
          'cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded'
        )
        and (
          (
            btrim(coalesce(voucher_rows.voucher ->> 'id', '')) <> ''
            and btrim(coalesce(o.metadata ->> 'promoVoucherId', '')) = btrim(coalesce(voucher_rows.voucher ->> 'id', ''))
          )
          or (
            btrim(coalesce(o.metadata ->> 'promoVoucherId', '')) = ''
            and upper(btrim(coalesce(o.promo_code, ''))) = upper(btrim(coalesce(voucher_rows.voucher ->> 'code', '')))
            and (
              left(btrim(coalesce(voucher_rows.voucher ->> 'createdAt', '')), 10) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              or (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= left(btrim(coalesce(voucher_rows.voucher ->> 'createdAt', '')), 10)::date
            )
          )
        )
      order by o.created_at desc, o.id desc
      limit 1
    ) as order_match on true
  )
  select coalesce(
    jsonb_agg(
      matched.voucher || jsonb_build_object(
        'used', matched.used,
        'usedAt', matched.used_at_text,
        'orderCode', matched.order_code
      )
      order by matched.ordinality
    ),
    '[]'::jsonb
  )
  from matched;
$$;

revoke all on function loyalty_private.compute_loyalty_voucher_usage_from_orders(text, jsonb)
from public, anon, authenticated;

create or replace function public.sync_loyalty_voucher_usage_from_orders(
  p_customer_phone text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_phone text;
  v_is_staff boolean := false;
  v_is_owner boolean := false;
  v_current_vouchers jsonb := '[]'::jsonb;
  v_next_vouchers jsonb := '[]'::jsonb;
begin
  v_phone := public.normalize_vietnam_phone(p_customer_phone);

  if coalesce(v_phone, '') = '' then
    raise exception 'So dien thoai loyalty khong hop le.';
  end if;

  select public.crm_loyalty_staff_can_write()
  into v_is_staff;

  select exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and public.normalize_vietnam_phone(p.phone) = v_phone
      and coalesce(p.status, 'active') = 'active'
  )
  into v_is_owner;

  if not coalesce(v_is_staff, false) and not coalesce(v_is_owner, false) then
    raise exception 'Tai khoan hien tai chua du quyen dong bo voucher nay.';
  end if;

  select coalesce(la.vouchers, '[]'::jsonb)
  into v_current_vouchers
  from public.loyalty_accounts la
  where la.customer_phone = v_phone;

  if not found then
    return false;
  end if;

  v_next_vouchers := loyalty_private.compute_loyalty_voucher_usage_from_orders(
    v_phone,
    v_current_vouchers
  );

  update public.loyalty_accounts
  set vouchers = v_next_vouchers,
      updated_at = now()
  where customer_phone = v_phone
    and vouchers is distinct from v_next_vouchers;

  return true;
end;
$$;

revoke all on function public.sync_loyalty_voucher_usage_from_orders(text)
from public, anon;
grant execute on function public.sync_loyalty_voucher_usage_from_orders(text)
to authenticated, service_role;

with recalculated as (
  select
    la.customer_phone,
    loyalty_private.compute_loyalty_voucher_usage_from_orders(
      la.customer_phone,
      la.vouchers
    ) as next_vouchers
  from public.loyalty_accounts la
)
update public.loyalty_accounts as la
set vouchers = recalculated.next_vouchers,
    updated_at = now()
from recalculated
where la.customer_phone = recalculated.customer_phone
  and la.vouchers is distinct from recalculated.next_vouchers;

comment on function loyalty_private.compute_loyalty_voucher_usage_from_orders(text, jsonb) is
  'Builds wallet voucher usage from real non-cancelled orders for one customer.';
comment on function public.sync_loyalty_voucher_usage_from_orders(text) is
  'Synchronizes one loyalty wallet so voucher used flags follow active order usage.';

notify pgrst, 'reload schema';

commit;
