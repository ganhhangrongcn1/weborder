-- Read-only wallet snapshot for the customer loyalty page.
-- This keeps the customer app away from direct table reads so RLS changes on
-- loyalty_accounts / loyalty_ledger / customer_vouchers do not break the UI.

begin;

create or replace function public.get_customer_loyalty_wallet_snapshot(p_phone text)
returns table (
  customer_phone text,
  total_points integer,
  checkin_streak integer,
  last_checkin_date text,
  last_missed_streak integer,
  comeback_used_date text,
  vouchers jsonb,
  tier_id text,
  tier_cycle_year integer,
  tier_qualifying_spend numeric,
  tier_qualifying_order_count integer,
  tier_qualified_at timestamptz,
  last_purchase_at timestamptz,
  points_expires_at timestamptz,
  updated_at timestamptz,
  point_history jsonb,
  voucher_history jsonb
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  with input_phone as (
    select public.normalize_vietnam_phone(p_phone) as customer_phone
  ),
  account_row as (
    select la.*
    from public.loyalty_accounts la
    join input_phone i on i.customer_phone = la.customer_phone
    where i.customer_phone <> ''
    limit 1
  ),
  ledger_rows as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ll.id,
          'entry_type', ll.entry_type,
          'order_id', ll.order_id,
          'points', coalesce(ll.points, 0),
          'amount', coalesce(ll.amount, 0),
          'title', coalesce(ll.title, ''),
          'note', coalesce(ll.note, ''),
          'source', coalesce(ll.source, ''),
          'source_type', coalesce(ll.source_type, ''),
          'source_order_id', coalesce(ll.source_order_id, ''),
          'action', coalesce(ll.action, ''),
          'action_version', coalesce(ll.action_version, 0),
          'idempotency_key', coalesce(ll.idempotency_key, ''),
          'partner_order_code', coalesce(ll.partner_order_code, ''),
          'partner_order_id', coalesce(ll.partner_order_id::text, ''),
          'metadata', coalesce(ll.metadata, '{}'::jsonb),
          'created_at', ll.created_at
        )
        order by ll.created_at desc
      ),
      '[]'::jsonb
    ) as rows
    from public.loyalty_ledger ll
    join input_phone i on i.customer_phone = ll.customer_phone
    where i.customer_phone <> ''
  ),
  voucher_rows as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', cv.id,
          'voucher_instance_id', cv.voucher_instance_id,
          'profile_id', cv.profile_id,
          'customer_phone', cv.customer_phone,
          'voucher_template_id', cv.voucher_template_id,
          'campaign_id', cv.campaign_id,
          'batch_id', cv.batch_id,
          'voucher_code', cv.voucher_code,
          'voucher_name', cv.voucher_name,
          'voucher_type', cv.voucher_type,
          'management_group', cv.management_group,
          'discount_type', cv.discount_type,
          'discount_value', cv.discount_value,
          'max_discount', cv.max_discount,
          'min_order', cv.min_order,
          'valid_days_after_grant', cv.valid_days_after_grant,
          'status', cv.status,
          'source_type', cv.source_type,
          'source_label', cv.source_label,
          'campaign_key', cv.campaign_key,
          'campaign_label', cv.campaign_label,
          'audience', cv.audience,
          'granted_at', cv.granted_at,
          'expires_at', cv.expires_at,
          'used_at', cv.used_at,
          'used_order_id', cv.used_order_id,
          'used_order_code', cv.used_order_code,
          'canceled_at', cv.canceled_at,
          'metadata', coalesce(cv.metadata, '{}'::jsonb),
          'legacy_payload', coalesce(cv.legacy_payload, '{}'::jsonb),
          'created_at', cv.created_at,
          'updated_at', cv.updated_at
        )
        order by cv.granted_at desc, cv.created_at desc
      ),
      '[]'::jsonb
    ) as rows
    from public.customer_vouchers cv
    join input_phone i on i.customer_phone = cv.customer_phone
    where i.customer_phone <> ''
  )
  select
    i.customer_phone,
    coalesce(a.total_points, 0)::integer,
    coalesce(a.checkin_streak, 0)::integer,
    a.last_checkin_date,
    coalesce(a.last_missed_streak, 0)::integer,
    a.comeback_used_date,
    coalesce(a.vouchers, '[]'::jsonb),
    coalesce(a.tier_id, 'new_customer'),
    coalesce(a.tier_cycle_year, extract(year from now())::integer),
    coalesce(a.tier_qualifying_spend, 0),
    coalesce(a.tier_qualifying_order_count, 0)::integer,
    a.tier_qualified_at,
    a.last_purchase_at,
    a.points_expires_at,
    a.updated_at,
    coalesce(l.rows, '[]'::jsonb) as point_history,
    coalesce(v.rows, '[]'::jsonb) as voucher_history
  from input_phone i
  left join account_row a on true
  cross join ledger_rows l
  cross join voucher_rows v
  where i.customer_phone <> '';
$$;

revoke all on function public.get_customer_loyalty_wallet_snapshot(text) from public;
grant execute on function public.get_customer_loyalty_wallet_snapshot(text) to anon, authenticated, service_role;

comment on function public.get_customer_loyalty_wallet_snapshot(text) is
  'Read-only customer wallet snapshot for the loyalty page. Returns loyalty balance, point history and customer vouchers for one normalized phone.';

notify pgrst, 'reload schema';

commit;
