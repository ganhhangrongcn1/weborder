-- Regression check on the reported order. All data changes roll back.
-- Run after the companion migration and before the one-off repair.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';
do $$
declare
  v_before integer;
  v_result record;
begin
  perform 1 from public.orders where id = 'GHR261030182428095' for update;
  select total_points into strict v_before from public.loyalty_accounts
    where customer_phone = '0905248695' for update;
  if exists(select 1 from public.loyalty_ledger
    where source_order_id = 'GHR261030182428095' and action = 'REVERSE_SPEND') then
    raise exception 'Run regression before the one-off refund';
  end if;

  -- Failed payment cancellation, then timeout / repeated provider delivery.
  update public.orders set status = 'cancelled'
    where id = 'GHR261030182428095';
  update public.orders set status = 'cancelled'
    where id = 'GHR261030182428095';
  if (select count(*) from public.loyalty_ledger
      where source_order_id = 'GHR261030182428095' and action = 'REVERSE_SPEND') <> 1 then
    raise exception 'Expected exactly one refund';
  end if;
  if (select total_points from public.loyalty_accounts
      where customer_phone = '0905248695') <> v_before + 9000 then
    raise exception 'Refund did not restore exactly 9000 points';
  end if;
  if not exists(select 1 from public.loyalty_ledger r
      join public.loyalty_ledger s on s.id = r.reversal_of_ledger_id
      join loyalty_private.point_lots lot on lot.source_ledger_id = r.id
      where r.source_order_id = 'GHR261030182428095'
        and r.action = 'REVERSE_SPEND' and r.points = -s.points
        and lot.remaining_points = 9000) then
    raise exception 'Missing reversal linkage or spendable point lot';
  end if;
  select * into v_result from loyalty_private.process_order_loyalty_internal(
    'ORDER', 'GHR261030182428095', 'REVERSE_SPEND',
    'loyalty-v2:ORDER:GHR261030182428095:REVERSE_SPEND:v1');
  if not v_result.ok or v_result.applied then
    raise exception 'Existing RPC did not recognize automatic refund';
  end if;

  -- Completed, paid order must not receive a refund on ordinary status writes.
  update public.orders set status = status where id = 'GHR261030183211010';
  if exists(select 1 from public.loyalty_ledger
      where source_order_id = 'GHR261030183211010' and action = 'REVERSE_SPEND') then
    raise exception 'Paid completed order incorrectly refunded';
  end if;
end;
$$;
rollback;
