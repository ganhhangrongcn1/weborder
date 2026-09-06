-- Enforce the existing checkout cap at the database boundary.
-- Existing orders are not rewritten; unchanged financial values remain editable.
create or replace function loyalty_private.combined_benefit_points_limit(
  p_subtotal numeric, p_promo_discount numeric
) returns numeric
language sql immutable
set search_path = pg_catalog
as $$
  select greatest(floor(greatest(coalesce(p_subtotal, 0), 0) * 40 / 100)
    - greatest(coalesce(p_promo_discount, 0), 0), 0);
$$;
revoke all on function loyalty_private.combined_benefit_points_limit(numeric, numeric) from public, anon, authenticated;

create or replace function loyalty_private.guard_order_combined_benefits()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_limit numeric;
  v_points numeric;
begin
  -- Status, payment collection and identical upserts of historical orders stay valid.
  if tg_op = 'UPDATE' then
    if new.subtotal is not distinct from old.subtotal
      and new.promo_discount is not distinct from old.promo_discount
      and new.points_discount is not distinct from old.points_discount
      and new.points_discount_amount is not distinct from old.points_discount_amount
      and new.points_spent is not distinct from old.points_spent
      and new.metadata -> 'pointsSpent' is not distinct from old.metadata -> 'pointsSpent'
    then
      return new;
    end if;
  end if;
  v_limit := loyalty_private.combined_benefit_points_limit(new.subtotal, new.promo_discount);
  v_points := greatest(
    coalesce(new.points_discount, 0),
    coalesce(new.points_discount_amount, 0),
    coalesce(new.points_spent, 0),
    coalesce(loyalty_private.jsonb_nonnegative_integer(new.metadata, 'pointsSpent'), 0)
  );
  if v_points > v_limit then
    raise exception using
      errcode = 'P4001',
      message = 'LOYALTY_COMBINED_BENEFIT_LIMIT',
      detail = 'Số điểm sử dụng vượt mức còn lại sau ưu đãi.',
      hint = 'Tải lại trang, kiểm tra số điểm sử dụng và tổng thanh toán rồi đặt lại.';
  end if;
  return new;
end;
$$;
revoke all on function loyalty_private.guard_order_combined_benefits() from public, anon, authenticated;

drop trigger if exists orders_zz_guard_combined_benefits on public.orders;
create trigger orders_zz_guard_combined_benefits
before insert or update of subtotal, promo_discount, points_discount, points_discount_amount, points_spent, metadata
on public.orders for each row execute function loyalty_private.guard_order_combined_benefits();

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
      greatest(coalesce(o.points_base_amount, 0), 0)
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
$function$;

notify pgrst, 'reload schema';
