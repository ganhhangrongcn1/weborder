-- Refund the actual V2 debit atomically with cancellation, including payment
-- provider / timeout writes that never call the frontend loyalty service.
-- No historical backfill: repair individual orders through the existing RPC.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

create or replace function loyalty_private.refund_cancelled_order_spend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_spend public.loyalty_ledger%rowtype;
begin
  if lower(trim(coalesce(new.status, ''))) not in
    ('cancelled', 'canceled', 'cancel', 'refunded') then
    return new;
  end if;

  -- Use ledger identity and amount, never client metadata / points_spent.
  select ll.* into v_spend
  from public.loyalty_ledger ll
  where ll.source_type = 'ORDER' and ll.source_order_id = new.id
    and ll.action = 'SPEND' and ll.action_version = 1 and ll.points < 0
  for update;
  if not found then return new; end if;

  -- Same locking order and event identity as process_order_loyalty_internal.
  perform 1 from public.loyalty_accounts la
  where la.customer_phone = v_spend.customer_phone for update;
  if exists (
    select 1 from public.loyalty_ledger ll
    where ll.reversal_of_ledger_id = v_spend.id and ll.action = 'REVERSE_SPEND'
  ) then return new; end if;

  insert into public.loyalty_ledger (
    id, customer_phone, entry_type, order_id, points, amount, title, note,
    metadata, source, source_type, source_order_id, action, action_version,
    idempotency_key, rule_version_id, reversal_of_ledger_id, actor_type
  ) values (
    'loyalty-v2-' || pg_catalog.gen_random_uuid()::text,
    v_spend.customer_phone, 'ORDER_SPEND_REVERSED', new.id,
    -v_spend.points, v_spend.amount, 'Hoàn điểm đơn hủy',
    'Đơn ' || coalesce(nullif(new.order_code, ''), new.id),
    pg_catalog.jsonb_build_object(
      'source', 'loyalty_v2', 'sourceType', 'ORDER', 'sourceOrderId', new.id,
      'action', 'REVERSE_SPEND', 'reason', 'order_cancelled',
      'paymentStatus', new.metadata->>'paymentStatus'
    ),
    'order', 'ORDER', new.id, 'REVERSE_SPEND', 1,
    'loyalty-v2:ORDER:' || new.id || ':REVERSE_SPEND:v1',
    v_spend.rule_version_id, v_spend.id, 'SERVICE'
  ) on conflict do nothing;
  -- Existing ledger triggers maintain the balance and 60-day point lots.
  -- Errors propagate so cancellation cannot commit without its refund.
  return new;
end;
$$;

revoke all on function loyalty_private.refund_cancelled_order_spend()
  from public, anon, authenticated;
drop trigger if exists orders_refund_cancelled_spend on public.orders;
create trigger orders_refund_cancelled_spend
after update of status on public.orders
for each row execute function loyalty_private.refund_cancelled_order_spend();
commit;
