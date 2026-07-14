-- Kiểm tra sau triển khai. Không để lại dữ liệu test.

do $verify$
declare
  v_order_id uuid;
  v_phone text;
begin
  select
    po.id,
    public.normalize_vietnam_phone(
      coalesce(nullif(po.customer_phone_key, ''), po.customer_phone)
    )
  into v_order_id, v_phone
  from public.partner_orders po
  where lower(trim(coalesce(po.point_status, 'pending'))) not in ('claimed', 'rejected', 'expired')
    and coalesce(po.order_time, po.created_at) <= now() - interval '7 days'
    and public.normalize_vietnam_phone(
      coalesce(nullif(po.customer_phone_key, ''), po.customer_phone)
    ) <> ''
  order by coalesce(po.order_time, po.created_at)
  limit 1;

  if v_order_id is null then
    raise exception 'Không có đơn quá hạn phù hợp để kiểm tra trigger.';
  end if;

  begin
    insert into public.loyalty_ledger (
      id,
      customer_phone,
      entry_type,
      points,
      partner_order_id,
      source_type,
      source_order_id,
      action,
      action_version,
      idempotency_key
    ) values (
      'verify-partner-claim-window-' || gen_random_uuid()::text,
      v_phone,
      'PARTNER_ORDER_EARN',
      1,
      v_order_id,
      'PARTNER_ORDER',
      v_order_id::text,
      'CLAIM_PARTNER_EARN',
      1,
      'verify-partner-claim-window-' || gen_random_uuid()::text
    );

    raise exception 'Trigger không chặn giao dịch điểm quá hạn.';
  exception
    when others then
      if sqlerrm <> 'Đơn đối tác đã quá 7 ngày và hết hạn tích điểm.' then
        raise;
      end if;
  end;
end;
$verify$;

with candidate as (
  select
    public.normalize_vietnam_phone(
      coalesce(nullif(po.customer_phone_key, ''), po.customer_phone)
    ) as phone,
    count(*) as expired_orders
  from public.partner_orders po
  where lower(trim(coalesce(po.point_status, 'pending'))) not in ('claimed', 'rejected', 'expired')
    and coalesce(po.order_time, po.created_at) <= now() - interval '7 days'
    and public.normalize_vietnam_phone(
      coalesce(nullif(po.customer_phone_key, ''), po.customer_phone)
    ) <> ''
  group by 1
  order by count(*) desc
  limit 1
),
sample_summary as (
  select s.*
  from candidate c
  cross join lateral public.get_customer_order_count_summary(c.phone) s
),
sample_statuses as (
  select
    count(*) filter (where s.point_status = 'expired') as expired,
    count(*) filter (where s.point_status = 'pending') as pending,
    count(*) filter (where s.point_status = 'claimed') as claimed
  from candidate c
  cross join lateral public.get_customer_order_point_statuses(c.phone, 500) s
  where s.source_type = 'PARTNER_ORDER'
),
global_counts as (
  select
    count(*) filter (
      where lower(trim(coalesce(po.point_status, 'pending'))) not in ('claimed', 'rejected', 'expired')
        and coalesce(po.order_time, po.created_at) <= now() - interval '7 days'
    ) as expired_unclaimed,
    count(*) filter (
      where lower(trim(coalesce(po.point_status, 'pending'))) = 'claimed'
        and coalesce(po.order_time, po.created_at) <= now() - interval '7 days'
    ) as old_claimed
  from public.partner_orders po
)
select jsonb_pretty(jsonb_build_object(
  'trigger_ready', exists (
    select 1
    from pg_catalog.pg_trigger t
    where t.tgname = 'loyalty_ledger_partner_claim_window'
      and t.tgrelid = 'public.loyalty_ledger'::regclass
      and not t.tgisinternal
      and t.tgenabled <> 'D'
  ),
  'trigger_blocks_expired_claim', true,
  'sample_customer_hash', (select md5(phone) from candidate),
  'sample_expired_orders', (select expired_orders from candidate),
  'sample_pending_points', (select pending_points from sample_summary),
  'sample_statuses', (select to_jsonb(ss) from sample_statuses ss),
  'global_counts', (select to_jsonb(gc) from global_counts gc),
  'status_rpc_anon_execute', has_function_privilege(
    'anon',
    'public.get_customer_order_point_statuses(text,integer)',
    'EXECUTE'
  ),
  'status_rpc_authenticated_execute', has_function_privilege(
    'authenticated',
    'public.get_customer_order_point_statuses(text,integer)',
    'EXECUTE'
  ),
  'summary_rpc_anon_execute', has_function_privilege(
    'anon',
    'public.get_customer_order_count_summary(text)',
    'EXECUTE'
  ),
  'private_trigger_anon_execute', has_function_privilege(
    'anon',
    'loyalty_private.enforce_partner_order_claim_window()',
    'EXECUTE'
  )
)) as verification;
