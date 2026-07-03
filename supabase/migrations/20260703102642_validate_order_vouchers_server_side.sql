-- Voucher security phase 1B.
-- Validate every order voucher against server-owned coupon or wallet data.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create index if not exists orders_promo_code_usage_idx
on public.orders ((upper(btrim(promo_code))), customer_phone, created_at)
where btrim(coalesce(promo_code, '')) <> '';

create index if not exists orders_promo_voucher_id_idx
on public.orders ((metadata ->> 'promoVoucherId'))
where btrim(coalesce(metadata ->> 'promoVoucherId', '')) <> '';

create or replace function loyalty_private.safe_nonnegative_numeric(
  p_value text,
  p_fallback numeric default 0
)
returns numeric
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select case
    when btrim(coalesce(p_value, '')) ~ '^[0-9]+([.][0-9]+)?$'
      then greatest(btrim(p_value)::numeric, 0)
    else greatest(coalesce(p_fallback, 0), 0)
  end;
$$;

revoke all on function loyalty_private.safe_nonnegative_numeric(text, numeric)
from public, anon, authenticated;

create or replace function loyalty_private.evaluate_order_voucher(
  p_order_id text,
  p_customer_phone text,
  p_subtotal numeric,
  p_promo_code text,
  p_promo_source text,
  p_promo_voucher_id text,
  p_at timestamptz
)
returns table(
  is_valid boolean,
  reason text,
  discount_amount numeric,
  promo_code text,
  promo_source text,
  promo_voucher_id text
)
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_order_id text := btrim(coalesce(p_order_id, ''));
  v_phone text := public.normalize_vietnam_phone(p_customer_phone);
  v_subtotal numeric := greatest(coalesce(p_subtotal, 0), 0);
  v_code text := upper(btrim(coalesce(p_promo_code, '')));
  v_source text := case
    when lower(btrim(coalesce(p_promo_source, ''))) = 'loyalty' then 'loyalty'
    else 'checkout'
  end;
  v_requested_voucher_id text := btrim(coalesce(p_promo_voucher_id, ''));
  v_effective_at timestamptz := coalesce(p_at, now());
  v_today date := (coalesce(p_at, now()) at time zone 'Asia/Ho_Chi_Minh')::date;
  v_actor_uid uuid := auth.uid();
  v_actor_is_staff boolean := false;
  v_actor_is_owner boolean := false;
  v_wallet jsonb := '[]'::jsonb;
  v_voucher jsonb;
  v_voucher_id text;
  v_voucher_created_at text;
  v_expiry text;
  v_discount_type text;
  v_value numeric := 0;
  v_max_discount numeric := 0;
  v_min_order numeric := 0;
  v_discount numeric := 0;
  v_coupon public.coupons%rowtype;
  v_coupon_data jsonb := '{}'::jsonb;
  v_voucher_type text;
  v_start_at text;
  v_end_at text;
  v_usage_limit integer := 0;
  v_per_user_limit integer := 0;
  v_usage_count integer := 0;
begin
  is_valid := false;
  reason := 'voucher_invalid';
  discount_amount := 0;
  promo_code := v_code;
  promo_source := v_source;
  promo_voucher_id := v_requested_voucher_id;

  if v_code = '' then
    is_valid := true;
    reason := 'no_voucher';
    promo_source := '';
    promo_voucher_id := '';
    return next;
    return;
  end if;

  if v_source = 'loyalty' then
    if v_phone = '' then
      reason := 'customer_phone_required';
      return next;
      return;
    end if;

    select exists (
      select 1
      from public.profiles p
      where p.auth_user_id = v_actor_uid
        and lower(coalesce(p.status, '')) = 'active'
        and lower(coalesce(p.role, '')) in ('admin', 'staff', 'kitchen', 'crm')
    )
    into v_actor_is_staff;

    select exists (
      select 1
      from public.profiles p
      where p.auth_user_id = v_actor_uid
        and public.normalize_vietnam_phone(p.phone) = v_phone
        and lower(coalesce(p.status, '')) = 'active'
        and lower(coalesce(p.role, '')) = 'customer'
    )
    into v_actor_is_owner;

    if not coalesce(v_actor_is_staff, false)
      and not coalesce(v_actor_is_owner, false)
    then
      reason := 'loyalty_owner_required';
      return next;
      return;
    end if;

    select coalesce(la.vouchers, '[]'::jsonb)
    into v_wallet
    from public.loyalty_accounts la
    where la.customer_phone = v_phone;

    if not found then
      reason := 'loyalty_wallet_not_found';
      return next;
      return;
    end if;

    select item.voucher
    into v_voucher
    from jsonb_array_elements(v_wallet) as item(voucher)
    where case
      when v_requested_voucher_id <> ''
        then btrim(coalesce(item.voucher ->> 'id', '')) = v_requested_voucher_id
      else upper(btrim(coalesce(item.voucher ->> 'code', ''))) = v_code
    end
    limit 1;

    if v_voucher is null then
      reason := 'loyalty_voucher_not_found';
      return next;
      return;
    end if;

    v_voucher_id := btrim(coalesce(v_voucher ->> 'id', ''));
    promo_voucher_id := v_voucher_id;

    if upper(btrim(coalesce(v_voucher ->> 'code', ''))) <> v_code then
      reason := 'loyalty_voucher_code_mismatch';
      return next;
      return;
    end if;

    if lower(coalesce(v_voucher ->> 'used', 'false')) = 'true' then
      reason := 'loyalty_voucher_used';
      return next;
      return;
    end if;

    if lower(coalesce(v_voucher ->> 'canceled', 'false')) = 'true' then
      reason := 'loyalty_voucher_canceled';
      return next;
      return;
    end if;

    v_expiry := left(btrim(coalesce(
      nullif(v_voucher ->> 'expiredAt', ''),
      nullif(v_voucher ->> 'endAt', ''),
      v_voucher ->> 'expiry',
      ''
    )), 10);

    if v_expiry ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and v_today > v_expiry::date
    then
      reason := 'loyalty_voucher_expired';
      return next;
      return;
    end if;

    v_voucher_created_at := left(btrim(coalesce(v_voucher ->> 'createdAt', '')), 10);

    if exists (
      select 1
      from public.orders o
      where o.id <> v_order_id
        and public.normalize_vietnam_phone(o.customer_phone) = v_phone
        and public.normalize_order_counting_status(o.status) not in (
          'cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded'
        )
        and (
          (
            v_voucher_id <> ''
            and btrim(coalesce(o.metadata ->> 'promoVoucherId', '')) = v_voucher_id
          )
          or (
            btrim(coalesce(o.metadata ->> 'promoVoucherId', '')) = ''
            and upper(btrim(coalesce(o.promo_code, ''))) = v_code
            and (
              v_voucher_created_at !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
              or (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= v_voucher_created_at::date
            )
          )
        )
    ) then
      reason := 'loyalty_voucher_used';
      return next;
      return;
    end if;

    v_discount_type := lower(btrim(coalesce(v_voucher ->> 'discountType', 'fixed')));
    v_value := loyalty_private.safe_nonnegative_numeric(v_voucher ->> 'value', 0);
    v_max_discount := loyalty_private.safe_nonnegative_numeric(v_voucher ->> 'maxDiscount', 0);
    v_min_order := loyalty_private.safe_nonnegative_numeric(v_voucher ->> 'minOrder', 0);
  else
    v_coupon := loyalty_private.resolve_configured_coupon(v_code);
    if v_coupon.id is null then
      reason := 'coupon_not_found';
      return next;
      return;
    end if;

    v_coupon_data := coalesce(v_coupon.data, '{}'::jsonb);
    v_voucher_type := lower(coalesce(
      nullif(btrim(v_coupon_data ->> 'voucherType'), ''),
      nullif(btrim(v_coupon.voucher_type), ''),
      'checkout'
    ));

    if v_voucher_type = 'loyalty' then
      reason := 'voucher_source_mismatch';
      return next;
      return;
    end if;

    if lower(coalesce(
      nullif(btrim(v_coupon_data ->> 'active'), ''),
      v_coupon.active::text,
      'true'
    )) = 'false' then
      reason := 'coupon_inactive';
      return next;
      return;
    end if;

    v_start_at := left(btrim(coalesce(
      nullif(v_coupon_data ->> 'startAt', ''),
      nullif(v_coupon.start_at::text, ''),
      ''
    )), 10);
    v_end_at := left(btrim(coalesce(
      nullif(v_coupon_data ->> 'endAt', ''),
      nullif(v_coupon_data ->> 'expiry', ''),
      nullif(v_coupon.end_at::text, ''),
      ''
    )), 10);

    if v_start_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and v_today < v_start_at::date
    then
      reason := 'coupon_not_started';
      return next;
      return;
    end if;

    if v_end_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and v_today > v_end_at::date
    then
      reason := 'coupon_expired';
      return next;
      return;
    end if;

    v_discount_type := lower(coalesce(
      nullif(btrim(v_coupon_data ->> 'discountType'), ''),
      nullif(btrim(v_coupon.discount_type), ''),
      'fixed'
    ));
    v_value := loyalty_private.safe_nonnegative_numeric(
      v_coupon_data ->> 'value',
      v_coupon.value
    );
    v_max_discount := loyalty_private.safe_nonnegative_numeric(
      v_coupon_data ->> 'maxDiscount',
      v_coupon.max_discount
    );
    v_min_order := loyalty_private.safe_nonnegative_numeric(
      v_coupon_data ->> 'minOrder',
      v_coupon.min_order
    );
    v_usage_limit := floor(loyalty_private.safe_nonnegative_numeric(
      v_coupon_data ->> 'usageLimit',
      v_coupon.usage_limit
    ))::integer;
    v_per_user_limit := floor(loyalty_private.safe_nonnegative_numeric(
      v_coupon_data ->> 'perUserLimit',
      v_coupon.per_user_limit
    ))::integer;
    promo_voucher_id := coalesce(
      nullif(v_requested_voucher_id, ''),
      nullif(btrim(v_coupon_data ->> 'id'), ''),
      v_coupon.id::text
    );

    if v_usage_limit > 0 then
      select count(*)::integer
      into v_usage_count
      from public.orders o
      where o.id <> v_order_id
        and upper(btrim(coalesce(o.promo_code, ''))) = v_code
        and public.normalize_order_counting_status(o.status) not in (
          'cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded'
        );

      if v_usage_count >= v_usage_limit then
        reason := 'coupon_usage_limit_reached';
        return next;
        return;
      end if;
    end if;

    if v_per_user_limit > 0 and v_phone <> '' then
      select count(*)::integer
      into v_usage_count
      from public.orders o
      where o.id <> v_order_id
        and public.normalize_vietnam_phone(o.customer_phone) = v_phone
        and upper(btrim(coalesce(o.promo_code, ''))) = v_code
        and public.normalize_order_counting_status(o.status) not in (
          'cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded'
        );

      if v_usage_count >= v_per_user_limit then
        reason := 'coupon_per_user_limit_reached';
        return next;
        return;
      end if;
    end if;
  end if;

  if v_subtotal < v_min_order then
    reason := 'voucher_min_order_not_met';
    return next;
    return;
  end if;

  if v_value <= 0 then
    reason := 'voucher_zero_discount';
    return next;
    return;
  end if;

  if v_discount_type = 'percent' then
    v_discount := floor(v_subtotal * least(v_value, 100) / 100);
    if v_max_discount > 0 then
      v_discount := least(v_discount, v_max_discount);
    end if;
  else
    v_discount := v_value;
  end if;

  is_valid := true;
  reason := 'ok';
  discount_amount := greatest(v_discount, 0);
  promo_code := v_code;
  promo_source := v_source;
  return next;
end;
$$;

revoke all on function loyalty_private.evaluate_order_voucher(
  text, text, numeric, text, text, text, timestamptz
)
from public, anon, authenticated;

create or replace function public.validate_checkout_voucher(
  p_order_id text,
  p_customer_phone text,
  p_subtotal numeric,
  p_promo_code text,
  p_promo_source text,
  p_promo_voucher_id text,
  p_at timestamptz
)
returns table(
  is_valid boolean,
  reason text,
  discount_amount numeric,
  promo_code text,
  promo_source text,
  promo_voucher_id text
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select *
  from loyalty_private.evaluate_order_voucher(
    p_order_id,
    p_customer_phone,
    p_subtotal,
    p_promo_code,
    p_promo_source,
    p_promo_voucher_id,
    p_at
  );
$$;

revoke all on function public.validate_checkout_voucher(
  text, text, numeric, text, text, text, timestamptz
)
from public, anon, authenticated;
grant execute on function public.validate_checkout_voucher(
  text, text, numeric, text, text, text, timestamptz
)
to anon, authenticated, service_role;

create or replace function loyalty_private.validate_order_voucher_before_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_metadata jsonb;
  v_source text;
  v_voucher_id text;
  v_requested_discount numeric;
  v_lock_key text;
  v_result record;
begin
  v_metadata := case
    when jsonb_typeof(coalesce(new.metadata, '{}'::jsonb)) = 'object'
      then coalesce(new.metadata, '{}'::jsonb)
    else '{}'::jsonb
  end;
  v_source := lower(btrim(coalesce(v_metadata ->> 'promoSource', '')));
  v_voucher_id := btrim(coalesce(v_metadata ->> 'promoVoucherId', ''));
  v_requested_discount := greatest(coalesce(new.promo_discount, 0), 0);

  if tg_op = 'UPDATE'
    and new.customer_phone is not distinct from old.customer_phone
    and new.subtotal is not distinct from old.subtotal
    and new.promo_discount is not distinct from old.promo_discount
    and new.promo_code is not distinct from old.promo_code
    and coalesce(new.metadata ->> 'promoSource', '') is not distinct from coalesce(old.metadata ->> 'promoSource', '')
    and coalesce(new.metadata ->> 'promoVoucherId', '') is not distinct from coalesce(old.metadata ->> 'promoVoucherId', '')
  then
    return new;
  end if;

  if btrim(coalesce(new.promo_code, '')) = '' then
    if v_requested_discount > 0 then
      raise exception 'voucher_invalid:voucher_code_required'
        using errcode = 'P0001';
    end if;
    new.promo_discount := 0;
    return new;
  end if;

  v_lock_key := concat_ws(
    ':',
    'ghr-voucher',
    case when v_source = 'loyalty' then 'loyalty' else 'checkout' end,
    upper(btrim(coalesce(new.promo_code, ''))),
    case
      when v_source = 'loyalty'
        then coalesce(nullif(v_voucher_id, ''), public.normalize_vietnam_phone(new.customer_phone))
      else ''
    end
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_lock_key, 0)
  );

  select *
  into v_result
  from loyalty_private.evaluate_order_voucher(
    new.id,
    new.customer_phone,
    new.subtotal,
    new.promo_code,
    v_source,
    v_voucher_id,
    new.created_at
  );

  if not coalesce(v_result.is_valid, false) then
    raise exception 'voucher_invalid:%', coalesce(v_result.reason, 'voucher_invalid')
      using errcode = 'P0001';
  end if;

  if abs(v_requested_discount - coalesce(v_result.discount_amount, 0)) > 0.009 then
    raise exception 'voucher_invalid:voucher_discount_mismatch'
      using errcode = 'P0001';
  end if;

  new.promo_code := v_result.promo_code;
  new.promo_discount := v_result.discount_amount;
  new.metadata := v_metadata || jsonb_build_object(
    'promoSource', v_result.promo_source,
    'promoVoucherId', v_result.promo_voucher_id,
    'serverVoucherValidated', true,
    'serverVoucherValidatedAt', now()::text
  );
  return new;
end;
$$;

revoke all on function loyalty_private.validate_order_voucher_before_write()
from public, anon, authenticated;

drop trigger if exists orders_00_validate_voucher on public.orders;
create trigger orders_00_validate_voucher
before insert or update of
  customer_phone,
  subtotal,
  promo_discount,
  promo_code,
  metadata
on public.orders
for each row
execute function loyalty_private.validate_order_voucher_before_write();

do $$
begin
  if has_function_privilege(
    'anon',
    'loyalty_private.evaluate_order_voucher(text,text,numeric,text,text,text,timestamptz)',
    'EXECUTE'
  ) then
    raise exception 'Private voucher evaluator is executable by anonymous callers.';
  end if;

  if not has_function_privilege(
    'anon',
    'public.validate_checkout_voucher(text,text,numeric,text,text,text,timestamptz)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous checkout cannot preflight regular vouchers.';
  end if;
end;
$$;

comment on function public.validate_checkout_voucher(
  text, text, numeric, text, text, text, timestamptz
) is 'Preflights checkout and loyalty vouchers using server-owned data.';
comment on function loyalty_private.validate_order_voucher_before_write() is
  'Rejects forged, expired, overused, or non-owned vouchers before an order write.';

notify pgrst, 'reload schema';

commit;
