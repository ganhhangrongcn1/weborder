alter table public.nexpos_event_workers add column if not exists id_sync_enabled boolean not null default false;
alter table public.nexpos_event_workers add column if not exists last_signal_at timestamptz;
create table public.nexpos_order_event_pending (
  hub_id text not null references public.nexpos_shadow_hubs(nexpos_hub_id),
  order_id text not null check(length(order_id) between 1 and 128),
  generation bigint not null default 1,
  completed_generation bigint not null default 0,
  pending boolean not null default true,
  retry_at timestamptz not null default now(),
  worker_id text not null references public.nexpos_event_workers(worker_id),
  received_at timestamptz not null,
  signaled_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(hub_id,order_id)
);
create table public.nexpos_order_event_receipts (
  hub_id text not null,
  order_id text not null,
  generation bigint not null,
  partner_order_id uuid not null,
  source_status_before text,
  source_status_after text,
  received_at timestamptz not null,
  committed_at timestamptz not null default now(),
  primary key(hub_id,order_id,generation)
);
create index nexpos_order_event_ready on public.nexpos_order_event_pending(retry_at,signaled_at) where pending;
alter table public.nexpos_order_event_pending enable row level security;
alter table public.nexpos_order_event_receipts enable row level security;
revoke all on public.nexpos_order_event_pending,public.nexpos_order_event_receipts from public,anon,authenticated;
grant all on public.nexpos_order_event_pending,public.nexpos_order_event_receipts to service_role;

create or replace function public.nexpos_enqueue_signals(p_worker_id text,p_signals jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
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
    if s->>'topic'='saas_order_status_change' and jsonb_array_length(s->'order_ids')>0 then
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
end $$;
revoke all on function public.nexpos_enqueue_signals(text,jsonb) from public,anon,authenticated;
grant execute on function public.nexpos_enqueue_signals(text,jsonb) to service_role;

create or replace function public.nexpos_enqueue_report() returns trigger
language plpgsql security invoker set search_path='' as $$
declare h text;
begin
  if new.id_sync_enabled and new.last_report->>'delivery_mode'='immediate-v1' then return new; end if;
  if new.enabled and new.sync_enabled and new.expires_at>now() then
    foreach h in array new.hub_ids loop
      if exists(select 1 from public.nexpos_shadow_hubs where nexpos_hub_id=h and enabled)
        and coalesce(new.last_report->'events'->h,'{}'::jsonb)<>coalesce(old.last_report->'events'->h,'{}'::jsonb) then
        insert into public.nexpos_event_pending(hub_id) values(h)
        on conflict(hub_id) do update set generation=nexpos_event_pending.generation+1,signaled_at=clock_timestamp();
      end if;
    end loop;
  end if;
  return new;
end $$;

create or replace function public.nexpos_commit_id_order(
  p_owner uuid,p_order jsonb,p_items jsonb,p_promotions jsonb,p_existing_id uuid,
  p_expected_hash text,p_observed_at timestamptz,p_generation bigint,p_hub text,p_source_id text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare q public.nexpos_order_event_pending; w public.nexpos_event_workers; result jsonb; before_status text;
begin
  -- Match enqueue's lock order: worker first, then pending row.
  select * into w from public.nexpos_event_workers x where x.worker_id=(
    select worker_id from public.nexpos_order_event_pending where hub_id=p_hub and order_id=p_source_id)
    and x.enabled and x.sync_enabled and x.id_sync_enabled and x.expires_at>now() and p_hub=any(x.hub_ids) for share;
  if w.worker_id is null then raise exception 'id_event_scope_revoked'; end if;
  select * into q from public.nexpos_order_event_pending e where e.hub_id=p_hub and e.order_id=p_source_id
    and e.worker_id=w.worker_id and e.generation>=p_generation for share;
  if q.order_id is null then raise exception 'id_event_scope_revoked'; end if;
  if p_existing_id is not null then
    select nexpos_status into before_status from public.partner_orders where id=p_existing_id
      and nexpos_hub_id=p_hub and nexpos_order_id=p_source_id;
    if not found then raise exception 'id_event_order_scope'; end if;
  elsif p_order->>'nexpos_hub_id' is distinct from p_hub or p_order->>'nexpos_order_id' is distinct from p_source_id then
    raise exception 'id_event_insert_scope';
  end if;
  result:=public.nexpos_commit_order(p_owner,p_order,p_items,p_promotions,p_existing_id,p_expected_hash,p_observed_at,null);
  if not coalesce((result->>'stale')::boolean,false) then
    insert into public.nexpos_order_event_receipts(hub_id,order_id,generation,partner_order_id,source_status_before,source_status_after,received_at)
      values(p_hub,p_source_id,p_generation,(result->'row'->>'id')::uuid,before_status,result->'row'->>'nexpos_status',q.received_at)
      on conflict do nothing;
  end if;
  return result;
end $$;
revoke all on function public.nexpos_commit_id_order(uuid,jsonb,jsonb,jsonb,uuid,text,timestamptz,bigint,text,text) from public,anon,authenticated;
grant execute on function public.nexpos_commit_id_order(uuid,jsonb,jsonb,jsonb,uuid,text,timestamptz,bigint,text,text) to service_role;
notify pgrst,'reload schema';
