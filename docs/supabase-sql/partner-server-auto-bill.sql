-- Initially disabled. No history enqueue or business order/loyalty changes.
create table public.partner_auto_bill_scopes (
  hub_id text primary key, branch_uuid uuid not null, enabled boolean not null default false,
  activated_at timestamptz not null default now(),
  printer_key text not null default 'cashier-80mm',
  printer_options jsonb not null default '{"printerName":"Xprinter","receiptWidthMm":80}'::jsonb
);
create table public.partner_auto_bill_intents (
  order_id uuid primary key references public.partner_orders(id),
  status text not null default 'pending' check(status in ('pending','processing','enqueued','skipped')),
  owner uuid, leased_until timestamptz, retry_at timestamptz not null default now(),
  created_at timestamptz not null default now(), completed_at timestamptz,
  job_id uuid references public.print_jobs(id), attempts integer not null default 0
);
create index partner_auto_bill_due on public.partner_auto_bill_intents(retry_at) where status in ('pending','processing');
alter table public.partner_auto_bill_scopes enable row level security;
alter table public.partner_auto_bill_intents enable row level security;
revoke all on public.partner_auto_bill_scopes,public.partner_auto_bill_intents from public,anon,authenticated;
grant all on public.partner_auto_bill_scopes,public.partner_auto_bill_intents to service_role;
alter table public.print_jobs add column auto_bill_key text;
create unique index print_jobs_auto_bill_once on public.print_jobs(auto_bill_key) where auto_bill_key is not null;

create function public.partner_auto_bill_eligible(p public.partner_orders)
returns boolean language sql stable security invoker set search_path='' as $$
  select p.nexpos_status in ('DOING','PICK') and p.branch_uuid is not null
    and coalesce(lower(p.kitchen_work_status),'') not in ('done','completed','cancelled','canceled','preorder')
    and coalesce(lower(p.order_status),'') not in ('done','completed','cancelled','canceled','preorder')
    and exists(select 1 from public.partner_auto_bill_scopes s where s.enabled
      and s.hub_id=p.nexpos_hub_id and s.branch_uuid=p.branch_uuid and p.created_at>=s.activated_at)
$$;

create function public.partner_auto_bill_enqueue() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if public.partner_auto_bill_eligible(new) then
    insert into public.partner_auto_bill_intents(order_id) values(new.id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger partner_auto_bill_enqueue after insert or update on public.partner_orders
for each row execute function public.partner_auto_bill_enqueue();

-- Covers old Kitchen clients too. A printed/failed automatic job keeps its key.
-- Manual reprints intentionally have a separate request and no automatic key.
create function public.partner_auto_bill_key_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.partner_orders; s public.partner_auto_bill_scopes;
begin
  if new.job_type is distinct from 'customer_bill' or new.source_type is distinct from 'partner'
    or not (coalesce(new.requested_by,'') like 'auto-kitchen:%' or coalesce(new.requested_by,'')='auto-server-partner') then
    new.auto_bill_key:=null; return new;
  end if;
  select * into p from public.partner_orders where id::text=new.order_id;
  select * into s from public.partner_auto_bill_scopes where hub_id=p.nexpos_hub_id
    and enabled and branch_uuid=p.branch_uuid and p.created_at>=activated_at;
  -- Preserve keys already attached before a scope rollback.
  if s.hub_id is null and not exists(select 1 from public.print_jobs j where j.order_id=new.order_id
    and j.auto_bill_key is not null) then new.auto_bill_key:=null; return new; end if;
  if p.id is null or new.branch_uuid is distinct from p.branch_uuid::text
    or new.printer_key is distinct from coalesce(s.printer_key,'cashier-80mm') then
    raise exception 'auto_bill_scope_mismatch';
  end if;
  new.auto_bill_key:=new.branch_uuid||':'||new.printer_key||':customer_bill:partner:'||p.id::text;
  new.created_at:=clock_timestamp(); new.requested_at:=new.created_at;
  return new;
end $$;
create trigger partner_auto_bill_key_guard before insert on public.print_jobs
for each row execute function public.partner_auto_bill_key_guard();

create function public.partner_auto_bill_claim(p_owner uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t record; result jsonb:='[]'; order_row public.partner_orders; item_rows jsonb;
begin
  for t in select i.order_id,s.printer_options from public.partner_auto_bill_intents i
    join public.partner_orders p on p.id=i.order_id
    join public.partner_auto_bill_scopes s on s.hub_id=p.nexpos_hub_id and s.enabled and s.branch_uuid=p.branch_uuid
    where i.retry_at<=now() and (i.status='pending' or (i.status='processing' and i.leased_until<now()))
    order by i.created_at for update of i skip locked limit 2
  loop
    select * into order_row from public.partner_orders where id=t.order_id;
    if not public.partner_auto_bill_eligible(order_row) or
      (select created_at from public.partner_auto_bill_intents where order_id=t.order_id)<now()-interval '5 minutes' then
      update public.partner_auto_bill_intents set status='skipped',completed_at=now() where order_id=t.order_id;
      continue;
    end if;
    select jsonb_agg(to_jsonb(x) order by x.line_index,x.id) into item_rows
      from public.partner_order_items x where partner_order_id=t.order_id;
    if coalesce(jsonb_array_length(item_rows),0)=0 then continue; end if;
    update public.partner_auto_bill_intents set status='processing',owner=p_owner,
      leased_until=now()+interval '120 seconds',attempts=attempts+1 where order_id=t.order_id;
    result:=result||jsonb_build_array(jsonb_build_object('order',to_jsonb(order_row),'items',item_rows,
      'printer_options',t.printer_options,'template',(select value from public.app_configs where id='ghr_receipt_template')));
  end loop;
  return result;
end $$;

create function public.partner_auto_bill_commit(p_owner uuid,p_order_id uuid,p_expected_hash text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.partner_orders; s public.partner_auto_bill_scopes; intent public.partner_auto_bill_intents;
  key_value text; job uuid; source_count integer; stored_count integer;
begin
  -- Same order→intent ordering as the order trigger; never hold intent while locking order.
  select * into p from public.partner_orders where id=p_order_id for update;
  select * into s from public.partner_auto_bill_scopes where hub_id=p.nexpos_hub_id and enabled for share;
  select * into intent from public.partner_auto_bill_intents where order_id=p_order_id for update;
  if intent.status<>'processing' or intent.owner is distinct from p_owner or intent.leased_until<=now() then
    raise exception 'auto_bill_lease_lost'; end if;
  if s.hub_id is null or not public.partner_auto_bill_eligible(p) then
    update public.partner_auto_bill_intents set status='skipped',completed_at=now() where order_id=p_order_id;
    return jsonb_build_object('enqueued',false);
  end if;
  if p.nexpos_enrichment_hash is distinct from p_expected_hash then raise exception 'auto_bill_snapshot_changed'; end if;
  if p_payload->>'type'<>'customer_bill' or p_payload->'order'->>'id' is distinct from p.id::text
    or length(coalesce(p_payload->>'text',''))=0 then raise exception 'auto_bill_payload_invalid'; end if;
  select count(*) into stored_count from public.partner_order_items where partner_order_id=p_order_id;
  source_count:=jsonb_array_length(coalesce(p.raw_data->'items',p.raw_data->'dishes',p.raw_data->'order_items','[]'::jsonb));
  if stored_count=0 or source_count>stored_count or jsonb_array_length(p_payload->'order'->'items')<>stored_count then
    raise exception 'auto_bill_items_incomplete'; end if;
  key_value:=p.branch_uuid::text||':'||s.printer_key||':customer_bill:partner:'||p.id::text;
  -- Adopt a job created by Kitchen/manual action before this renderer; never repeat it.
  select id into job from public.print_jobs where order_id=p.id::text and branch_uuid=p.branch_uuid::text
    and printer_key=s.printer_key and job_type='customer_bill' order by (auto_bill_key is not null) desc,created_at limit 1;
  if job is not null then
    update public.print_jobs set auto_bill_key=key_value where id=job and auto_bill_key is null;
  else
    insert into public.print_jobs(branch_uuid,printer_key,job_type,status,order_id,order_code,source_type,
      payload,requested_by,requested_at,created_at,updated_at)
    values(p.branch_uuid::text,s.printer_key,'customer_bill','pending',p.id::text,
      coalesce(p.display_order_code,p.order_code),'partner',p_payload,'auto-server-partner',now(),now(),now())
    on conflict (auto_bill_key) where auto_bill_key is not null do nothing returning id into job;
    if job is null then select id into job from public.print_jobs where auto_bill_key=key_value; end if;
  end if;
  update public.partner_auto_bill_intents set status='enqueued',job_id=job,completed_at=now(),leased_until=null
    where order_id=p_order_id;
  return jsonb_build_object('enqueued',true,'job_id',job);
end $$;

create function public.partner_auto_bill_retry(p_owner uuid,p_order_id uuid) returns void
language sql security invoker set search_path='' as $$
  update public.partner_auto_bill_intents set status='pending',retry_at=now()+interval '15 seconds',
    owner=null,leased_until=null where order_id=p_order_id and owner=p_owner and status='processing'
$$;
revoke all on function public.partner_auto_bill_eligible(public.partner_orders),public.partner_auto_bill_enqueue(),
  public.partner_auto_bill_key_guard(),public.partner_auto_bill_claim(uuid),
  public.partner_auto_bill_commit(uuid,uuid,text,jsonb),public.partner_auto_bill_retry(uuid,uuid) from public,anon,authenticated;
grant execute on function public.partner_auto_bill_eligible(public.partner_orders),public.partner_auto_bill_claim(uuid),
  public.partner_auto_bill_commit(uuid,uuid,text,jsonb),public.partner_auto_bill_retry(uuid,uuid) to service_role;
notify pgrst,'reload schema';
