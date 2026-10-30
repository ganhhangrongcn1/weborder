-- Service-only WSS invalidation queue. Existing 15-second polling remains fallback.
alter table public.nexpos_event_workers add column if not exists sync_enabled boolean not null default false;
alter table public.nexpos_shadow_sync_control add column if not exists lock_owner uuid;
create table if not exists public.nexpos_event_pending (
  hub_id text primary key references public.nexpos_shadow_hubs(nexpos_hub_id),
  generation bigint not null default 1,
  completed_generation bigint not null default 0,
  signaled_at timestamptz not null default now(),
  completed_at timestamptz,
  last_run_id uuid
);
alter table public.nexpos_event_pending enable row level security;
revoke all on public.nexpos_event_pending from public, anon, authenticated;
grant all on public.nexpos_event_pending to service_role;
create table if not exists public.nexpos_event_sync_receipts (
  hub_id text not null,
  generation bigint not null,
  partner_order_id uuid not null,
  source_status_before text,
  source_status_after text,
  item_count integer not null,
  committed_at timestamptz not null default now(),
  primary key (hub_id, generation, partner_order_id)
);
alter table public.nexpos_event_sync_receipts enable row level security;
revoke all on public.nexpos_event_sync_receipts from public, anon, authenticated;
grant all on public.nexpos_event_sync_receipts to service_role;

create or replace function public.nexpos_enqueue_report() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare h text;
begin
  if new.enabled and new.sync_enabled and new.expires_at > now() then
    foreach h in array new.hub_ids loop
      if exists(select 1 from public.nexpos_shadow_hubs where nexpos_hub_id=h and enabled)
        and coalesce(new.last_report->'events'->h, '{}'::jsonb) <> coalesce(old.last_report->'events'->h, '{}'::jsonb)
        and coalesce(new.last_report->'events'->h, '{}'::jsonb) <> '{}'::jsonb then
        insert into public.nexpos_event_pending(hub_id) values(h)
        on conflict(hub_id) do update set generation=nexpos_event_pending.generation+1, signaled_at=now();
      end if;
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.nexpos_enqueue_report() from public,anon,authenticated;
grant execute on function public.nexpos_enqueue_report() to service_role;
drop trigger if exists nexpos_report_queue on public.nexpos_event_workers;
create trigger nexpos_report_queue after update of last_report on public.nexpos_event_workers
for each row execute function public.nexpos_enqueue_report();

create or replace function public.nexpos_sync_lease(p_owner uuid,p_action text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  if p_owner is null then return false; end if;
  if p_action='acquire' then
    update public.nexpos_shadow_sync_control set lock_owner=p_owner, locked_until=clock_timestamp()+interval '120 seconds',
      last_started_at=clock_timestamp(),updated_at=clock_timestamp()
    where control_key='nexpos_partner_orders' and mode in ('dual_write','compare_only')
      and (locked_until is null or locked_until < clock_timestamp());
  elsif p_action='renew' then
    update public.nexpos_shadow_sync_control set locked_until=clock_timestamp()+interval '120 seconds'
    where control_key='nexpos_partner_orders' and lock_owner=p_owner and locked_until>clock_timestamp();
  elsif p_action='release' then
    update public.nexpos_shadow_sync_control set locked_until=null,lock_owner=null
    where control_key='nexpos_partner_orders' and lock_owner=p_owner;
  else return false;
  end if;
  get diagnostics affected=row_count;
  return affected=1;
end $$;
revoke all on function public.nexpos_sync_lease(uuid,text) from public,anon,authenticated;
grant execute on function public.nexpos_sync_lease(uuid,text) to service_role;

-- Internal typed JSON writer: quote identifiers, bind values, preserve defaults and triggers.
-- Only service_role may call it; only the three importer-owned tables are accepted.
create or replace function public.nexpos_write_json(p_table text,p_data jsonb,p_id uuid default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare cols text; vals text; assignments text; result_id uuid; current_row jsonb;
begin
  if p_table not in ('partner_orders','partner_order_items','partner_order_promotions')
     or jsonb_typeof(p_data)<>'object' or p_data='{}'::jsonb
     or p_data ?| array['id','created_at','updated_at'] then raise exception 'invalid_sync_patch'; end if;
  if exists(select 1 from jsonb_object_keys(p_data) k where not exists (
    select 1 from information_schema.columns c where c.table_schema='public' and c.table_name=p_table and c.column_name=k))
    then raise exception 'invalid_sync_column'; end if;
  if p_id is not null then
    execute format('select to_jsonb(t) from public.%I t where id=$1',p_table) into current_row using p_id;
    if current_row is null then raise exception 'sync_row_missing'; end if;
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into p_data from jsonb_each(p_data)
      where value is distinct from current_row->key;
    if p_data='{}'::jsonb then return p_id; end if;
  end if;
  select string_agg(format('%I',k),','),string_agg(format('r.%I',k),','),
    string_agg(format('%I=r.%I',k,k),',') into cols,vals,assignments from jsonb_object_keys(p_data) k;
  if p_id is null then
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I,$1) r returning id',p_table,cols,vals,p_table)
    into result_id using p_data;
  else
    execute format('update public.%I t set %s,updated_at=clock_timestamp() from jsonb_populate_record(null::public.%I,$1) r where t.id=$2 and (to_jsonb(t) @> $1) is not true returning t.id',p_table,assignments,p_table)
    into result_id using p_data,p_id;
    result_id:=coalesce(result_id,p_id);
  end if;
  return result_id;
end $$;
revoke all on function public.nexpos_write_json(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.nexpos_write_json(text,jsonb,uuid) to service_role;

create or replace function public.nexpos_commit_order(
  p_owner uuid,p_order jsonb,p_items jsonb,p_promotions jsonb,p_existing_id uuid,
  p_expected_hash text,p_observed_at timestamptz,p_generation bigint default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing public.partner_orders; order_id uuid; item jsonb; promo jsonb; child_id uuid;
  created boolean:=false; hub text; before_status text; current_mode text;
begin
  -- Row lock prevents takeover while this transaction applies a complete order.
  select mode into current_mode from public.nexpos_shadow_sync_control
    where control_key='nexpos_partner_orders' and lock_owner=p_owner and locked_until>clock_timestamp() for update;
  if current_mode is null or current_mode not in ('dual_write','compare_only') then raise exception 'sync_lease_lost'; end if;
  if current_mode='compare_only' and (p_existing_id is null or p_order ?| array['nexpos_status','order_status','kitchen_status','raw_data','synced_at'])
    then raise exception 'sync_compare_only_scope'; end if;
  if p_existing_id is null then
    select * into existing from public.partner_orders where partner_source=p_order->>'partner_source'
      and nexpos_order_id=p_order->>'nexpos_order_id' for update;
  else
    select * into existing from public.partner_orders where id=p_existing_id for update;
    if existing.id is null then raise exception 'sync_order_missing'; end if;
  end if;
  hub:=coalesce(existing.nexpos_hub_id,p_order->>'nexpos_hub_id');
  if not exists(select 1 from public.nexpos_shadow_hubs where nexpos_hub_id=hub and enabled) then raise exception 'sync_hub_disabled'; end if;
  if p_generation is not null and not exists(select 1 from public.nexpos_event_workers w
    where w.enabled and w.sync_enabled and w.expires_at>now() and hub=any(w.hub_ids)) then raise exception 'sync_scope_revoked'; end if;
  if existing.id is not null then
    if p_existing_id is null or existing.nexpos_enrichment_hash is distinct from p_expected_hash
      or existing.last_nexpos_observed_at>p_observed_at then
      return jsonb_build_object('row',to_jsonb(existing),'created',false,'stale',true);
    end if;
    order_id:=existing.id; before_status:=existing.nexpos_status;
    perform public.nexpos_write_json('partner_orders',p_order,order_id);
  else
    if jsonb_array_length(p_items)=0 then raise exception 'sync_missing_items'; end if;
    order_id:=public.nexpos_write_json('partner_orders',p_order);
    created:=true;
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if created then
      perform public.nexpos_write_json('partner_order_items', (item-'id') || jsonb_build_object('partner_order_id',order_id));
    else
      child_id:=(item->>'id')::uuid;
      if not exists(select 1 from public.partner_order_items where id=child_id and partner_order_id=order_id) then raise exception 'sync_item_scope'; end if;
      perform public.nexpos_write_json('partner_order_items',item-'id',child_id);
    end if;
  end loop;
  for promo in select value from jsonb_array_elements(p_promotions) loop
    select id into child_id from public.partner_order_promotions where partner_order_id=order_id and promotion_key=promo->>'promotion_key';
    perform public.nexpos_write_json('partner_order_promotions',promo || jsonb_build_object('partner_order_id',order_id),child_id);
  end loop;
  select * into existing from public.partner_orders where id=order_id;
  if p_generation is not null then
    insert into public.nexpos_event_sync_receipts(hub_id,generation,partner_order_id,source_status_before,source_status_after,item_count)
    select hub,p_generation,order_id,before_status,existing.nexpos_status,count(*) from public.partner_order_items where partner_order_id=order_id
    on conflict do nothing;
  end if;
  return jsonb_build_object('row',to_jsonb(existing),'created',created,'stale',false);
end $$;
revoke all on function public.nexpos_commit_order(uuid,jsonb,jsonb,jsonb,uuid,text,timestamptz,bigint) from public,anon,authenticated;
grant execute on function public.nexpos_commit_order(uuid,jsonb,jsonb,jsonb,uuid,text,timestamptz,bigint) to service_role;
