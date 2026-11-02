-- Independent Pay2S receipts. No SePay data/configuration is changed.
create table if not exists public.pay2s_webhook_receipts (
  transaction_id text primary key,
  transaction_payload jsonb not null,
  session_id uuid references public.pos_payment_sessions(id),
  result text not null default 'received',
  received_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.pay2s_webhook_receipts enable row level security;
revoke all on public.pay2s_webhook_receipts from public, anon, authenticated;
grant select, insert, update on public.pay2s_webhook_receipts to service_role;

create index if not exists pos_payment_sessions_pay2s_reference_idx
  on public.pos_payment_sessions ((regexp_replace(upper(payment_reference), '[^A-Z0-9]', '', 'g')))
  where provider = 'pay2s';

create or replace function public.receive_pay2s_transaction(p_transaction jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_id text := p_transaction->>'id';
  v_receipt public.pay2s_webhook_receipts%rowtype;
  v_session public.pos_payment_sessions%rowtype;
  v_order public.orders%rowtype;
  v_ids uuid[];
  v_reason text;
  v_meta jsonb;
  v_amount numeric := (p_transaction->>'amount')::numeric;
  v_time timestamptz := (p_transaction->>'transactionDate')::timestamptz;
  v_sync_order boolean;
begin
  if coalesce(v_id, '') = '' or v_amount <= 0 or v_amount <> trunc(v_amount)
    or v_time is null or jsonb_typeof(p_transaction->'references') <> 'array' then
    raise exception 'Invalid Pay2S transaction';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('pay2s:' || v_id, 0));
  select * into v_receipt from public.pay2s_webhook_receipts where transaction_id = v_id;
  if found then
    if v_receipt.transaction_payload <> p_transaction then
      return jsonb_build_object('reason', 'transaction_conflict', 'complete', false);
    end if;
    if v_receipt.completed_at is not null then
      return jsonb_build_object('reason', v_receipt.result, 'complete', true);
    end if;
    -- A previously unmatched transaction can be retried after the session becomes visible.
  else
    insert into public.pay2s_webhook_receipts(transaction_id, transaction_payload) values (v_id, p_transaction);
  end if;

  if p_transaction->>'direction' <> 'IN' then v_reason := 'ignored_outgoing';
  else
    select array_agg(id) into v_ids from public.pos_payment_sessions
    where provider = 'pay2s' and regexp_replace(upper(payment_reference), '[^A-Z0-9]', '', 'g') in
      (select jsonb_array_elements_text(p_transaction->'references'));
    if coalesce(cardinality(v_ids), 0) = 0 then v_reason := 'no_pay2s_session';
    elsif cardinality(v_ids) <> 1 then v_reason := 'ambiguous_reference';
    else
      select * into v_session from public.pos_payment_sessions where id = v_ids[1] for update;
      if coalesce(v_session.provider_payload#>>'{bankTransfer,accountNumber}', '') <> p_transaction->>'accountNumber'
        or coalesce(p_transaction->>'bankBin', '') = ''
        or v_session.provider_payload#>>'{bankTransfer,bankBin}' is distinct from p_transaction->>'bankBin' then
        v_reason := 'account_mismatch';
      elsif v_session.amount_expected <> v_amount then v_reason := 'amount_mismatch';
      elsif v_session.status not in ('pending_payment', 'paid', 'converting', 'converted')
        or (v_session.status = 'pending_payment' and (v_session.expires_at <= now() or v_session.expires_at is null)) then
        v_reason := 'late_payment_manual_review';
      elsif v_session.status <> 'pending_payment' and v_session.provider_transaction_id is distinct from v_id then
        v_reason := 'already_paid_other_transaction';
      else
        v_sync_order := v_session.source <> 'pos';
        if v_session.order_id is not null then
          select * into v_order from public.orders where id = v_session.order_id for update;
          if not found then
            raise exception 'Linked payment order is not visible yet';
          end if;
          if v_order.status in ('cancelled', 'canceled', 'expired')
            or coalesce(v_order.metadata->>'paymentStatus', '') in ('cancelled', 'expired', 'paid_after_cancel') then
            v_reason := 'late_payment_manual_review';
          elsif coalesce(v_order.pickup_branch_uuid, v_order.branch_uuid) is distinct from v_session.branch_uuid
            or v_order.total_amount <> v_amount or v_order.payment_method <> 'bank_qr' then
            v_reason := 'linked_order_mismatch';
          elsif v_order.metadata->>'paymentStatus' = 'paid'
            and (v_order.metadata->>'paymentProvider' is distinct from 'pay2s'
              or v_order.metadata#>>'{pay2sWebhook,providerTransactionId}' is distinct from v_id) then
            v_reason := 'order_already_paid';
          end if;
          if v_session.source = 'web' then v_sync_order := v_order.metadata->>'deviceMode' = 'phone'; end if;
        elsif v_sync_order then
          raise exception 'Missing linked order for Pay2S payment';
        end if;
        if v_reason is null then
          if v_session.status = 'pending_payment' then
            update public.pos_payment_sessions set status = 'paid', amount_paid = v_amount,
              provider_transaction_id = v_id, paid_at = v_time, updated_at = now(),
              provider_payload = provider_payload || jsonb_build_object('pay2sWebhook', p_transaction->'raw')
            where id = v_session.id returning * into v_session;
          end if;
          if v_sync_order and coalesce(v_order.metadata->>'paymentStatus', '') <> 'paid' then
            v_meta := coalesce(v_order.metadata, '{}'::jsonb) || jsonb_build_object(
              'status', 'preparing', 'orderStatus', 'preparing', 'kitchenStatus', 'pending',
              'paymentMethod', 'bank_qr', 'paymentStatus', 'paid', 'paymentProvider', 'pay2s',
              'paymentAmount', v_amount, 'paymentReference', v_session.payment_reference,
              'qrPaymentSessionId', v_session.id, 'paidAt', v_time,
              'pay2sWebhook', (p_transaction->'raw') || jsonb_build_object('providerTransactionId', v_id)
            );
            update public.orders set status = 'preparing', kitchen_status = 'pending', metadata = v_meta,
              pos_shift_id = coalesce(pos_shift_id, v_session.pos_shift_id), updated_at = now()
            where id = v_order.id;
          end if;
          update public.pay2s_webhook_receipts set session_id = v_session.id, result = 'settled_pending_effects'
            where transaction_id = v_id;
          return jsonb_build_object('reason', 'settled', 'complete', false, 'session', to_jsonb(v_session), 'syncOrder', v_sync_order);
        end if;
      end if;
    end if;
  end if;
  update public.pay2s_webhook_receipts set result = v_reason,
    session_id = v_session.id,
    completed_at = case when v_reason = 'no_pay2s_session' then null else now() end
  where transaction_id = v_id;
  return jsonb_build_object('reason', v_reason, 'complete', v_reason <> 'no_pay2s_session');
end;
$$;
revoke all on function public.receive_pay2s_transaction(jsonb) from public, anon, authenticated;
grant execute on function public.receive_pay2s_transaction(jsonb) to service_role;
notify pgrst, 'reload schema';
