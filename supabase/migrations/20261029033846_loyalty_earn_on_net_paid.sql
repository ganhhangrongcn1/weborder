-- Remote migration version: 20261029033846 (Supabase apply_migration).
-- New orders earn on net paid merchandise only; historical snapshots and ledger stay unchanged.
create or replace function loyalty_private.order_net_paid_earn_amount(
  p_subtotal numeric, p_promo_discount numeric, p_points_discount numeric,
  p_total_amount numeric, p_shipping_fee numeric
) returns numeric
language sql immutable
set search_path = ''
as $$
  select least(
    greatest(coalesce(p_subtotal, 0) - greatest(coalesce(p_promo_discount, 0), 0)
      - greatest(coalesce(p_points_discount, 0), 0), 0),
    greatest(coalesce(p_total_amount,
      greatest(coalesce(p_subtotal, 0) - greatest(coalesce(p_promo_discount, 0), 0)
        - greatest(coalesce(p_points_discount, 0), 0), 0)
        + greatest(coalesce(p_shipping_fee, 0), 0))
      - greatest(coalesce(p_shipping_fee, 0), 0), 0)
  );
$$;
revoke all on function loyalty_private.order_net_paid_earn_amount(numeric,numeric,numeric,numeric,numeric) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION loyalty_private.snapshot_order_loyalty_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'loyalty_private'
AS $function$
declare
  v_rule public.loyalty_rule_versions%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_tier jsonb;
  v_metadata_points integer;
  v_max_points integer;
begin
  select * into v_rule
  from public.loyalty_rule_versions
  where status = 'ACTIVE' and effective_from <= now()
  order by effective_from desc, version_number desc
  limit 1;

  if not found then
    raise exception 'Chưa có phiên bản quy tắc loyalty đang hoạt động.';
  end if;

  v_account := loyalty_private.rollover_loyalty_account(new.customer_phone, v_rule, now());
  v_tier := loyalty_private.resolve_program_tier(
    v_rule,
    coalesce(v_account.tier_qualifying_spend, 0)
  );
  if v_account.tier_id is not null then
    select value into v_tier
    from jsonb_array_elements(coalesce(v_rule.source_config -> 'tiers', '[]'::jsonb))
    where value ->> 'id' = v_account.tier_id
    limit 1;
    v_tier := coalesce(v_tier, loyalty_private.resolve_program_tier(v_rule, 0));
  end if;

  new.loyalty_rule_version_id := v_rule.id;
  new.loyalty_tier_id := v_tier ->> 'id';
  new.loyalty_earn_numerator := greatest(coalesce((v_tier ->> 'pointPerUnit')::bigint, v_rule.earn_numerator), 1);
  new.loyalty_earn_denominator := greatest(coalesce((v_tier ->> 'currencyPerPoint')::bigint, v_rule.earn_denominator), 1);
  new.points_base_amount := loyalty_private.order_net_paid_earn_amount(
    new.subtotal, new.promo_discount, new.points_discount, new.total_amount, new.shipping_fee
  );
  new.expected_earn_points := floor(
    new.points_base_amount * new.loyalty_earn_numerator / new.loyalty_earn_denominator
  )::integer;
  new.points_discount_amount := coalesce(new.points_discount, 0);

  v_metadata_points := loyalty_private.jsonb_nonnegative_integer(new.metadata, 'pointsSpent');
  new.points_spent := coalesce(new.points_spent, v_metadata_points);
  if new.points_spent is null and coalesce(new.points_discount, 0) > 0 then
    new.points_spent := floor(new.points_discount)::integer;
  end if;
  new.points_spent := coalesce(new.points_spent, 0);

  v_max_points := floor(greatest(coalesce(new.subtotal, 0) - coalesce(new.promo_discount, 0), 0) * loyalty_private.get_loyalty_max_redemption_percent(v_rule.id) / 100)::integer;
  if new.points_spent > v_max_points or new.points_discount_amount > v_max_points then
    raise exception 'Số điểm sử dụng vượt quá tỷ lệ tối đa đang được cấu hình.';
  end if;

  return new;
end;
$function$
;

-- Redemption allowance remains based on merchandise before point redemption.
CREATE OR REPLACE FUNCTION loyalty_private.guard_loyalty_ledger_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'loyalty_private'
AS $function$
declare
  v_max_points integer;
  v_available_points integer;
  v_combined_limit numeric;
begin
  if new.action = 'SPEND' then
    perform loyalty_private.expire_loyalty_account_if_due(new.customer_phone, now());

    perform 1
    from loyalty_private.point_lots l
    where l.customer_phone = public.normalize_vietnam_phone(new.customer_phone)
      and l.remaining_points > 0
      and l.expires_at > now()
    for update;

    select coalesce(sum(l.remaining_points), 0)::integer
    into v_available_points
    from loyalty_private.point_lots l
    where l.customer_phone = public.normalize_vietnam_phone(new.customer_phone)
      and l.remaining_points > 0
      and l.expires_at > now();

    if abs(new.points) > coalesce(v_available_points, 0) then
      raise exception 'Khách không đủ điểm còn hạn. Hiện có %, cần %.',
        coalesce(v_available_points, 0), abs(new.points);
    end if;

    if new.source_type <> 'ORDER' then
      raise exception 'Chỉ đơn hàng trực tiếp mới được sử dụng điểm.';
    end if;

    select loyalty_private.combined_benefit_points_limit(o.subtotal, o.promo_discount)
    into v_combined_limit
    from public.orders o
    where o.id = new.source_order_id;
    if abs(new.points) > coalesce(v_combined_limit, 0) then
      raise exception using
        errcode = 'P4001',
        message = 'LOYALTY_COMBINED_BENEFIT_LIMIT',
        detail = 'Số điểm sử dụng vượt mức còn lại sau ưu đãi.';
    end if;

    select floor(
      greatest(coalesce(o.subtotal, 0) - coalesce(o.promo_discount, 0), 0)
      * loyalty_private.get_loyalty_max_redemption_percent(o.loyalty_rule_version_id) / 100
    )::integer
    into v_max_points
    from public.orders o
    where o.id = new.source_order_id;

    if abs(new.points) > coalesce(v_max_points, 0) then
      raise exception 'Số điểm sử dụng vượt quá tỷ lệ tối đa đang được cấu hình.';
    end if;
  end if;

  return new;
end;
$function$
;
