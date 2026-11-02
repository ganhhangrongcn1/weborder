CREATE OR REPLACE FUNCTION public.nexpos_enqueue_signals(p_worker_id text, p_signals jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare w public.nexpos_event_workers; s jsonb; oid text; h text;
begin
  select * into w from public.nexpos_event_workers where worker_id=p_worker_id
    and enabled and sync_enabled and id_sync_enabled and expires_at>now() for update;
  if w.worker_id is null then raise exception 'signal_scope_disabled'; end if;
  if w.last_signal_at>clock_timestamp()-interval '250 milliseconds' then return false; end if;
  if jsonb_typeof(p_signals) is distinct from 'array' or jsonb_array_length(p_signals) not between 1 and 32 then raise exception 'invalid_signals'; end if;
  for s in select value from jsonb_array_elements(p_signals) loop
    h:=s->>'hub_id';
    if not(s ?& array['hub_id','topic','order_ids','received_at']) or not(h=any(w.hub_ids)) or not exists(select 1 from public.nexpos_shadow_hubs where nexpos_hub_id=h and enabled)
      or s->>'topic' not in ('saas_order_status_change','saas_notifications','saas_print_bill','reconnect')
      or jsonb_typeof(s->'order_ids') is distinct from 'array' or jsonb_array_length(s->'order_ids')>32 then raise exception 'invalid_signal_scope'; end if;
    if s->>'topic' in ('saas_order_status_change','saas_notifications','saas_print_bill') and jsonb_array_length(s->'order_ids')>0 then
      for oid in select jsonb_array_elements_text(s->'order_ids') loop
        if length(oid) not between 1 and 128 or oid~'[[:cntrl:][:space:]]' then raise exception 'invalid_order_identity'; end if;
        insert into public.nexpos_order_event_pending(hub_id,order_id,worker_id,received_at)
          values(h,oid,p_worker_id,least(clock_timestamp(),(s->>'received_at')::timestamptz))
        on conflict(hub_id,order_id) do update set generation=nexpos_order_event_pending.generation+1,
          received_at=excluded.received_at,signaled_at=clock_timestamp(),worker_id=excluded.worker_id,
          pending=true,retry_at=clock_timestamp();
      end loop;
    else
      insert into public.nexpos_event_pending(hub_id) values(h)
      on conflict(hub_id) do update set generation=nexpos_event_pending.generation+1,signaled_at=clock_timestamp();
    end if;
  end loop;
  update public.nexpos_event_workers set last_signal_at=clock_timestamp() where worker_id=p_worker_id;
  return true;
end $function$;
