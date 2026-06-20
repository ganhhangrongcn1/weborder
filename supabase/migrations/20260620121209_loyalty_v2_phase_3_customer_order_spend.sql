-- Phase 3: cho phép customer đã đăng nhập trừ điểm V2 cho chính đơn ORDER của mình.
-- Không mở quyền settle/reverse; các action đó vẫn do staff/admin/kitchen/service_role xử lý.

create or replace function loyalty_private.process_order_loyalty_internal(
  p_source_type text,
  p_source_order_id text,
  p_action text,
  p_idempotency_key text
)
returns table (
  ok boolean,
  applied boolean,
  event_id text,
  action text,
  points_delta integer,
  balance_before integer,
  balance_after integer,
  message text
)
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private, auth
as $$
declare
  v_source_type text := upper(trim(coalesce(p_source_type, '')));
  v_source_order_id text := trim(coalesce(p_source_order_id, ''));
  v_action text := upper(trim(coalesce(p_action, '')));
  v_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  v_phone text;
  v_order_status text;
  v_order_code text;
  v_rule_version_id uuid;
  v_points_base numeric := 0;
  v_expected_earn integer := 0;
  v_points_spent integer := 0;
  v_partner_order_id uuid;
  v_actor_type text;
  v_actor_id uuid;
  v_actor_phone text;
  v_actor_role text;
  v_event_id text;
  v_delta integer;
  v_balance_before integer;
  v_balance_after integer;
  v_original public.loyalty_ledger%rowtype;
  v_existing public.loyalty_ledger%rowtype;
  v_inserted_id text;
  v_profile_id uuid;
begin
  if v_source_type not in ('ORDER', 'PARTNER_ORDER') then
    raise exception 'Nguồn đơn loyalty không hợp lệ.';
  end if;
  if v_source_order_id = '' then
    raise exception 'Thiếu định danh đơn hàng.';
  end if;
  if v_action not in ('SPEND', 'SETTLE_EARN', 'REVERSE_SPEND', 'REVERSE_EARN', 'CLAIM_PARTNER_EARN') then
    raise exception 'Hành động loyalty không hợp lệ.';
  end if;
  if v_idempotency_key = '' or length(v_idempotency_key) > 200 then
    raise exception 'Idempotency key không hợp lệ.';
  end if;

  if v_source_type = 'ORDER' then
    select
      public.normalize_vietnam_phone(o.customer_phone),
      lower(trim(coalesce(o.status, ''))),
      o.order_code,
      o.loyalty_rule_version_id,
      coalesce(o.points_base_amount, 0),
      coalesce(o.expected_earn_points, 0),
      coalesce(o.points_spent, 0)
    into
      v_phone, v_order_status, v_order_code, v_rule_version_id,
      v_points_base, v_expected_earn, v_points_spent
    from public.orders o
    where o.id = v_source_order_id
    for update;

    if not found then
      raise exception 'Không tìm thấy đơn trong orders.';
    end if;
  else
    begin
      v_partner_order_id := v_source_order_id::uuid;
    exception when invalid_text_representation then
      raise exception 'partner_order_id không đúng định dạng UUID.';
    end;

    select
      public.normalize_vietnam_phone(
        coalesce(nullif(po.customer_phone_key, ''), po.customer_phone)
      ),
      lower(trim(coalesce(po.order_status, ''))),
      po.order_code,
      po.loyalty_rule_version_id,
      coalesce(po.points_base_amount, 0),
      coalesce(po.expected_earn_points, 0),
      coalesce(po.points_spent, 0)
    into
      v_phone, v_order_status, v_order_code, v_rule_version_id,
      v_points_base, v_expected_earn, v_points_spent
    from public.partner_orders po
    where po.id = v_partner_order_id
    for update;

    if not found then
      raise exception 'Không tìm thấy đơn trong partner_orders.';
    end if;
  end if;

  if v_phone = '' then
    raise exception 'Đơn không có số điện thoại hợp lệ để xử lý loyalty.';
  end if;

  select *
  into v_actor_type, v_actor_id, v_actor_phone, v_actor_role
  from loyalty_private.current_actor();

  if v_actor_role = 'service_role' then
    null;
  elsif v_actor_role in ('admin', 'staff', 'kitchen') then
    null;
  elsif v_action = 'CLAIM_PARTNER_EARN'
    and v_source_type = 'PARTNER_ORDER'
    and v_actor_role = 'customer'
    and v_actor_phone = v_phone
  then
    null;
  elsif v_action = 'SPEND'
    and v_source_type = 'ORDER'
    and v_actor_role = 'customer'
    and v_actor_phone = v_phone
  then
    null;
  else
    raise exception 'Tài khoản hiện tại không được phép thực hiện hành động loyalty này.';
  end if;

  if v_action = 'SPEND' then
    if v_source_type <> 'ORDER' then
      raise exception 'Chỉ đơn trong orders mới được sử dụng điểm.';
    end if;
    if v_order_status in ('cancelled', 'canceled', 'cancel', 'refunded') then
      raise exception 'Không thể trừ điểm cho đơn đã hủy hoặc hoàn tiền.';
    end if;
    if v_points_spent <= 0 then
      raise exception 'Đơn không có snapshot points_spent hợp lệ.';
    end if;
    v_delta := -v_points_spent;
  elsif v_action = 'SETTLE_EARN' then
    if v_source_type <> 'ORDER' then
      raise exception 'Đơn đối tác phải dùng CLAIM_PARTNER_EARN.';
    end if;
    if v_order_status not in ('completed', 'done', 'hoan_tat', 'hoan tat') then
      raise exception 'Chỉ cộng điểm khi đơn đã hoàn tất.';
    end if;
    if v_expected_earn <= 0 then
      raise exception 'Đơn không có expected_earn_points hợp lệ.';
    end if;
    v_delta := v_expected_earn;
  elsif v_action = 'CLAIM_PARTNER_EARN' then
    if v_source_type <> 'PARTNER_ORDER' then
      raise exception 'CLAIM_PARTNER_EARN chỉ áp dụng cho partner_orders.';
    end if;
    if v_order_status not in ('completed', 'done', 'hoan_tat', 'hoan tat') then
      raise exception 'Đơn đối tác chưa hoàn tất nên chưa thể nhận điểm.';
    end if;
    if v_expected_earn <= 0 then
      raise exception 'Đơn đối tác không có expected_earn_points hợp lệ.';
    end if;
    v_delta := v_expected_earn;
  elsif v_action = 'REVERSE_SPEND' then
    if v_order_status not in ('cancelled', 'canceled', 'cancel', 'refunded') then
      raise exception 'Chỉ hoàn điểm đã dùng khi đơn đã hủy hoặc hoàn tiền.';
    end if;
    select * into v_original
    from public.loyalty_ledger ll
    where ll.source_type = v_source_type
      and ll.source_order_id = v_source_order_id
      and ll.action = 'SPEND'
      and ll.action_version = 1
    limit 1
    for update;
    if not found then
      raise exception 'Không tìm thấy giao dịch SPEND gốc.';
    end if;
    v_delta := -v_original.points;
  elsif v_action = 'REVERSE_EARN' then
    if v_order_status not in ('cancelled', 'canceled', 'cancel', 'refunded') then
      raise exception 'Chỉ thu hồi điểm khi đơn đã hủy hoặc hoàn tiền.';
    end if;
    select * into v_original
    from public.loyalty_ledger ll
    where ll.source_type = v_source_type
      and ll.source_order_id = v_source_order_id
      and ll.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN')
      and ll.action_version = 1
    order by case when ll.action = 'SETTLE_EARN' then 0 else 1 end
    limit 1
    for update;
    if not found then
      raise exception 'Không tìm thấy giao dịch cộng điểm gốc.';
    end if;
    v_delta := -v_original.points;
  end if;

  insert into public.loyalty_accounts (customer_phone, total_points, metadata)
  values (v_phone, 0, jsonb_build_object('source', 'loyalty_v2'))
  on conflict (customer_phone) do nothing;

  select coalesce(la.total_points, 0)::integer
  into v_balance_before
  from public.loyalty_accounts la
  where la.customer_phone = v_phone
  for update;

  select * into v_existing
  from public.loyalty_ledger ll
  where ll.source_type = v_source_type
    and ll.source_order_id = v_source_order_id
    and ll.action = v_action
    and ll.action_version = 1
  limit 1;

  if found then
    return query select
      true, false, v_existing.id, v_action, v_existing.points,
      v_balance_before, v_balance_before,
      'Sự kiện đã được xử lý trước đó.';
    return;
  end if;

  if v_balance_before + v_delta < 0 and v_action <> 'REVERSE_EARN' then
    raise exception 'Khách không đủ điểm. Hiện có %, cần %.',
      v_balance_before, abs(v_delta);
  end if;

  v_event_id := 'loyalty-v2-' || gen_random_uuid()::text;

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
    source_type,
    source_order_id,
    action,
    action_version,
    idempotency_key,
    rule_version_id,
    reversal_of_ledger_id,
    actor_type,
    actor_id,
    created_at
  ) values (
    v_event_id,
    v_phone,
    case v_action
      when 'SPEND' then 'ORDER_SPEND'
      when 'SETTLE_EARN' then 'ORDER_EARN'
      when 'REVERSE_SPEND' then 'ORDER_SPEND_REVERSED'
      when 'REVERSE_EARN' then 'ORDER_EARN_REVERSED'
      else 'PARTNER_ORDER_EARN'
    end,
    case when v_source_type = 'ORDER' then v_source_order_id else null end,
    v_delta,
    v_points_base,
    case v_action
      when 'SPEND' then 'Sử dụng điểm cho đơn hàng'
      when 'SETTLE_EARN' then 'Cộng điểm đơn hoàn tất'
      when 'REVERSE_SPEND' then 'Hoàn điểm đơn hủy'
      when 'REVERSE_EARN' then 'Thu hồi điểm đơn hủy'
      else 'Cộng điểm đơn đối tác'
    end,
    'Đơn ' || coalesce(nullif(v_order_code, ''), v_source_order_id),
    jsonb_build_object(
      'source', 'loyalty_v2',
      'sourceType', v_source_type,
      'sourceOrderId', v_source_order_id,
      'action', v_action,
      'pointsBaseAmount', v_points_base
    ),
    case when v_source_type = 'PARTNER_ORDER' then v_partner_order_id else null end,
    case when v_source_type = 'PARTNER_ORDER' then v_order_code else null end,
    case when v_source_type = 'PARTNER_ORDER' then 'partner' else 'order' end,
    v_source_type,
    v_source_order_id,
    v_action,
    1,
    v_idempotency_key,
    v_rule_version_id,
    case when v_action in ('REVERSE_SPEND', 'REVERSE_EARN') then v_original.id else null end,
    v_actor_type,
    v_actor_id,
    now()
  )
  on conflict do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select * into v_existing
    from public.loyalty_ledger ll
    where ll.source_type = v_source_type
      and ll.source_order_id = v_source_order_id
      and ll.action = v_action
      and ll.action_version = 1
    order by ll.created_at
    limit 1;

    if not found then
      if exists (
        select 1
        from public.loyalty_ledger ll
        where ll.idempotency_key = v_idempotency_key
      ) then
        raise exception 'Idempotency key đã được dùng cho một sự kiện khác.';
      end if;
      raise exception 'Không thể tạo sự kiện loyalty do xung đột dữ liệu.';
    end if;

    select coalesce(la.total_points, 0)::integer
    into v_balance_after
    from public.loyalty_accounts la
    where la.customer_phone = v_phone;

    return query select
      true, false, v_existing.id, v_action, coalesce(v_existing.points, 0),
      v_balance_before, v_balance_after,
      'Sự kiện đã được xử lý trước đó.';
    return;
  end if;

  if v_action = 'CLAIM_PARTNER_EARN' then
    select p.id into v_profile_id
    from public.profiles p
    where public.normalize_vietnam_phone(p.phone) = v_phone
    order by (p.auth_user_id is not null) desc, p.created_at
    limit 1;

    update public.partner_orders
    set
      point_status = 'claimed',
      claimed_by_profile_id = coalesce(v_profile_id, claimed_by_profile_id),
      claimed_customer_phone = v_phone,
      claimed_at = coalesce(claimed_at, now())
    where id = v_partner_order_id;
  end if;

  select coalesce(la.total_points, 0)::integer
  into v_balance_after
  from public.loyalty_accounts la
  where la.customer_phone = v_phone;

  return query select
    true, true, v_event_id, v_action, v_delta,
    v_balance_before, v_balance_after,
    'Xử lý loyalty thành công.';
end;
$$;

notify pgrst, 'reload schema';
