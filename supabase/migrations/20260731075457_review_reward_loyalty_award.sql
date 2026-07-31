create or replace function public.approve_review_reward_claim(
  p_claim_id uuid,
  p_reviewer_auth_user_id uuid
)
returns table (
  ok boolean,
  applied boolean,
  claim_id uuid,
  ledger_id text,
  points integer,
  message text
)
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_claim public.review_reward_claims%rowtype;
  v_reviewer public.profiles%rowtype;
  v_ledger_id text;
  v_retention_days integer := 3;
  v_existing_ledger_id text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Chỉ hệ thống máy chủ được duyệt thưởng đánh giá.';
  end if;

  select *
  into v_reviewer
  from public.profiles
  where auth_user_id = p_reviewer_auth_user_id
    and lower(coalesce(role, '')) = 'admin'
    and lower(coalesce(status, 'active')) = 'active'
  limit 1;

  if not found then
    raise exception 'Người duyệt không có quyền admin.';
  end if;

  select *
  into v_claim
  from public.review_reward_claims
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'Không tìm thấy yêu cầu thưởng đánh giá.';
  end if;

  v_ledger_id := 'loyalty-v2-review-' || v_claim.id::text;

  if v_claim.status = 'approved' then
    select id
    into v_existing_ledger_id
    from public.loyalty_ledger
    where idempotency_key = 'review-reward-' || v_claim.id::text
    limit 1;

    return query select
      true,
      false,
      v_claim.id,
      coalesce(v_existing_ledger_id, v_ledger_id),
      v_claim.reward_points,
      'Yêu cầu đã được duyệt trước đó.';
    return;
  end if;

  if v_claim.status not in ('pending', 'processing') then
    raise exception 'Yêu cầu không còn ở trạng thái chờ duyệt.';
  end if;

  if v_claim.required_rating <> 5 or v_claim.reward_points <= 0 then
    raise exception 'Yêu cầu không có cấu hình thưởng 5 sao hợp lệ.';
  end if;

  insert into public.profiles (phone, registered, role, status, metadata)
  values (
    public.normalize_vietnam_phone(v_claim.customer_phone),
    false,
    'customer',
    'active',
    jsonb_build_object('source', 'review_reward')
  )
  on conflict (phone) do nothing;

  insert into public.loyalty_accounts (customer_phone, total_points, metadata)
  values (
    public.normalize_vietnam_phone(v_claim.customer_phone),
    0,
    jsonb_build_object('source', 'review_reward')
  )
  on conflict (customer_phone) do nothing;

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
    actor_type,
    actor_id,
    created_at
  )
  values (
    v_ledger_id,
    public.normalize_vietnam_phone(v_claim.customer_phone),
    'ADMIN_ADJUST',
    null,
    v_claim.reward_points,
    0,
    'Thưởng đánh giá 5 sao',
    v_claim.partner_source || ' · ' || coalesce(v_claim.order_code, ''),
    jsonb_build_object(
      'source', 'review_reward',
      'reviewRewardClaimId', v_claim.id,
      'partnerOrderId', v_claim.partner_order_id,
      'partnerSource', v_claim.partner_source,
      'requiredRating', v_claim.required_rating
    ),
    v_claim.partner_order_id,
    v_claim.order_code,
    'review_reward',
    'ADMIN',
    v_claim.id::text,
    'ADMIN_ADJUST',
    1,
    'review-reward-' || v_claim.id::text,
    'admin',
    v_reviewer.id,
    now()
  )
  on conflict do nothing
  returning id into v_existing_ledger_id;

  if v_existing_ledger_id is null then
    select id
    into v_existing_ledger_id
    from public.loyalty_ledger
    where idempotency_key = 'review-reward-' || v_claim.id::text
    limit 1;

    if v_existing_ledger_id is null then
      raise exception 'Không thể ghi ledger thưởng đánh giá.';
    end if;
  end if;

  select proof_retention_days
  into v_retention_days
  from public.review_reward_settings
  where id = 'default';

  update public.review_reward_claims
  set
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = p_reviewer_auth_user_id,
    proof_delete_after = now() + make_interval(days => greatest(2, least(3, coalesce(v_retention_days, 3)))),
    updated_at = now()
  where id = v_claim.id;

  return query select
    true,
    true,
    v_claim.id,
    v_existing_ledger_id,
    v_claim.reward_points,
    'Đã duyệt và cộng điểm.';
end;
$function$;

revoke all on function public.approve_review_reward_claim(uuid, uuid) from public;
revoke all on function public.approve_review_reward_claim(uuid, uuid) from anon;
revoke all on function public.approve_review_reward_claim(uuid, uuid) from authenticated;
grant execute on function public.approve_review_reward_claim(uuid, uuid) to service_role;

comment on function public.approve_review_reward_claim(uuid, uuid) is
  'Atomic review reward approval. Service role only; points and phone are read from the locked claim.';

notify pgrst, 'reload schema';
