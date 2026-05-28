-- Partner order loyalty claim RPC for GHR.
-- Safe to run multiple times.
--
-- Usage example:
-- select * from public.claim_partner_order_points(
--   p_order_code := 'GF-TEST-001',
--   p_customer_phone := '0900000000'
-- );

create extension if not exists pgcrypto;

create or replace function public.normalize_vietnam_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');

  if digits = '' then
    return '';
  end if;

  if left(digits, 4) = '0084' then
    digits := '84' || substring(digits from 5);
  end if;

  if left(digits, 2) = '84' then
    digits := '0' || substring(digits from 3);
  elsif left(digits, 1) <> '0' and length(digits) = 9 then
    digits := '0' || digits;
  end if;

  if digits ~ '^0[0-9]{9}$' then
    return digits;
  end if;

  return '';
end;
$$;

create unique index if not exists loyalty_ledger_partner_order_earn_unique
on public.loyalty_ledger (partner_order_id)
where partner_order_id is not null and entry_type = 'PARTNER_ORDER_EARN';

create or replace function public.get_loyalty_order_rule()
returns table (
  currency_per_point numeric,
  point_per_unit numeric
)
language plpgsql
stable
as $$
declare
  v_rule jsonb;
begin
  select value
  into v_rule
  from public.app_configs
  where id = 'ghr_loyalty'
  limit 1;

  currency_per_point := greatest(coalesce((v_rule ->> 'currencyPerPoint')::numeric, 100), 1);
  point_per_unit := greatest(coalesce((v_rule ->> 'pointPerUnit')::numeric, 1), 1);

  return next;
end;
$$;

create or replace function public.claim_partner_order_points(
  p_order_id uuid default null,
  p_order_code text default '',
  p_customer_phone text default '',
  p_amount_per_point numeric default null
)
returns table (
  ok boolean,
  message text,
  partner_order_id uuid,
  partner_order_code text,
  points integer,
  total_points integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.partner_orders%rowtype;
  v_phone text;
  v_order_phone text;
  v_profile_id uuid;
  v_amount_per_point numeric;
  v_point_per_unit numeric;
  v_points integer;
  v_total_points integer;
  v_ledger_id text;
  v_existing_points integer;
begin
  v_phone := public.normalize_vietnam_phone(p_customer_phone);

  if v_phone = '' then
    return query select false, 'Số điện thoại không hợp lệ.', null::uuid, ''::text, 0, 0;
    return;
  end if;

  select currency_per_point, point_per_unit
  into v_amount_per_point, v_point_per_unit
  from public.get_loyalty_order_rule();

  v_amount_per_point := greatest(coalesce(p_amount_per_point, v_amount_per_point, 100), 1);
  v_point_per_unit := greatest(coalesce(v_point_per_unit, 1), 1);

  select *
  into v_order
  from public.partner_orders
  where
    (p_order_id is not null and id = p_order_id)
    or (
      p_order_id is null
      and trim(coalesce(p_order_code, '')) <> ''
      and order_code = trim(p_order_code)
    )
  limit 1
  for update;

  if not found then
    return query select false, 'Không tìm thấy đơn đối tác.', null::uuid, trim(coalesce(p_order_code, '')), 0, 0;
    return;
  end if;

  v_order_phone := public.normalize_vietnam_phone(
    coalesce(nullif(v_order.customer_phone_key, ''), v_order.customer_phone)
  );

  if v_order_phone = '' or v_order_phone <> v_phone then
    return query select false, 'Số điện thoại không khớp với đơn hàng.', v_order.id, v_order.order_code, 0, 0;
    return;
  end if;

  if lower(coalesce(v_order.order_status, '')) in ('cancelled', 'canceled', 'cancel', 'refunded', 'preorder', 'pre_order', 'preordered', 'scheduled') then
    return query select false, 'Đơn đã hủy hoặc hoàn tiền nên không thể cộng điểm.', v_order.id, v_order.order_code, 0, 0;
    return;
  end if;

  select coalesce(points, 0)::integer
  into v_existing_points
  from public.loyalty_ledger
  where partner_order_id = v_order.id
    and entry_type = 'PARTNER_ORDER_EARN'
  limit 1;

  if found then
    update public.partner_orders
    set point_status = 'claimed'
    where id = v_order.id
      and coalesce(point_status, '') <> 'claimed';

    select coalesce(total_points, 0)::integer
    into v_total_points
    from public.loyalty_accounts
    where customer_phone = v_phone;

    return query select false, 'Đơn này đã được cộng điểm trước đó.', v_order.id, v_order.order_code, 0, coalesce(v_total_points, 0);
    return;
  end if;

  if v_order.point_status = 'claimed' then
    select coalesce(total_points, 0)::integer
    into v_total_points
    from public.loyalty_accounts
    where customer_phone = v_phone;

    return query select false, 'Đơn này đã được cộng điểm trước đó.', v_order.id, v_order.order_code, 0, coalesce(v_total_points, 0);
    return;
  end if;

  if v_order.point_status in ('rejected', 'expired') then
    return query select false, 'Đơn này không còn đủ điều kiện cộng điểm.', v_order.id, v_order.order_code, 0, 0;
    return;
  end if;

  v_points := floor(
    (greatest(coalesce(v_order.points_base_amount, v_order.total_amount, 0), 0) / v_amount_per_point)
    * v_point_per_unit
  )::integer;

  if v_points <= 0 then
    return query select false, 'Giá trị đơn chưa đủ để cộng điểm.', v_order.id, v_order.order_code, 0, 0;
    return;
  end if;

  select id
  into v_profile_id
  from public.profiles
  where phone = v_phone
  limit 1;

  if v_profile_id is null then
    insert into public.profiles (phone, registered, role, status)
    values (v_phone, false, 'customer', 'active')
    on conflict (phone) do update
    set updated_at = now()
    returning id into v_profile_id;
  end if;

  insert into public.loyalty_accounts (
    customer_phone,
    total_points,
    metadata,
    updated_at
  )
  values (
    v_phone,
    v_points,
    jsonb_build_object(
      'lastPartnerOrderCode', v_order.order_code,
      'lastPartnerSource', v_order.partner_source
    ),
    now()
  )
  on conflict (customer_phone) do update
  set
    total_points = greatest(coalesce(public.loyalty_accounts.total_points, 0) + v_points, 0),
    metadata = coalesce(public.loyalty_accounts.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning public.loyalty_accounts.total_points::integer into v_total_points;

  v_ledger_id := 'partner-point-' || v_order.id::text;

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
    partner_order_id,
    partner_order_code,
    source,
    created_at
  )
  values (
    v_ledger_id,
    v_phone,
    'PARTNER_ORDER_EARN',
    null,
    v_points,
    coalesce(v_order.points_base_amount, v_order.total_amount, 0),
    'Cộng điểm từ đơn đối tác',
    'Đơn ' || v_order.order_code || ' - ' || v_order.partner_source,
    jsonb_build_object(
      'partnerOrderId', v_order.id,
      'partnerOrderCode', v_order.order_code,
      'partnerSource', v_order.partner_source,
      'branchId', v_order.branch_id,
      'branchName', v_order.branch_name,
      'totalAmount', v_order.total_amount,
      'pointsBaseAmount', v_order.points_base_amount,
      'currencyPerPoint', v_amount_per_point,
      'pointPerUnit', v_point_per_unit
    ),
    v_order.id,
    v_order.order_code,
    v_order.partner_source,
    now()
  );

  update public.partner_orders
  set
    point_status = 'claimed',
    claimed_by_profile_id = v_profile_id,
    claimed_customer_phone = v_phone,
    claimed_at = now()
  where id = v_order.id;

  return query select true, 'Cộng điểm thành công.', v_order.id, v_order.order_code, v_points, v_total_points;
end;
$$;

grant execute on function public.claim_partner_order_points(uuid, text, text, numeric) to anon, authenticated;
grant execute on function public.normalize_vietnam_phone(text) to anon, authenticated;
grant execute on function public.get_loyalty_order_rule() to anon, authenticated;
