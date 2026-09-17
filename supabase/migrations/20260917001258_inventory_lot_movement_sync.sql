-- Applied migration version: 20260917001258.
-- Lot accounting follows posted movements; never writes balances or documents.
-- Receipt lots keep their original identity. Transfers can carry multiple lots.
set local lock_timeout = '5s';
lock table public.inventory_stock_balances, public.inventory_stock_movements,
  public.inventory_stock_lots in share row exclusive mode;
alter table public.inventory_stock_lots
  add column if not exists lot_origin_key text not null default 'receipt';
-- Automatic sales reversals have no staff actor; retain the FK when one exists.
alter table public.inventory_stock_lots alter column created_by drop not null;
alter table public.inventory_stock_lots
  drop constraint if exists inventory_stock_lots_source_document_line_id_key;
create unique index if not exists inventory_stock_lots_line_origin_key
  on public.inventory_stock_lots(source_document_line_id, lot_origin_key);

create table if not exists private.inventory_lot_allocations (
  movement_id uuid not null references public.inventory_stock_movements(id),
  lot_id uuid not null references public.inventory_stock_lots(id),
  quantity numeric(18,6) not null check (quantity > 0),
  primary key (movement_id, lot_id)
);
alter table private.inventory_lot_allocations enable row level security;
create index if not exists inventory_lot_allocations_lot_id_idx
  on private.inventory_lot_allocations(lot_id);
revoke all on private.inventory_lot_allocations from public, anon, authenticated;

-- Preserve the existing receipt validation and authorization verbatim.
do $migration$
declare v_definition text;
begin
  select pg_get_functiondef('private.inventory_record_purchase_lot_from_movement()'::regprocedure)
    into v_definition;
  if position('on conflict (source_document_line_id) do nothing' in v_definition) > 0 then
    execute replace(v_definition, 'on conflict (source_document_line_id) do nothing',
      'on conflict (source_document_line_id, lot_origin_key) do nothing');
  elsif position('on conflict (source_document_line_id, lot_origin_key) do nothing' in v_definition) = 0 then
    raise exception 'Unexpected receipt lot function; migration stopped.';
  end if;
end;
$migration$;

-- Reversal must touch the original receipt lot, never an unallocated baseline.
do $migration$
declare v_definition text;
begin
  select pg_get_functiondef('private.inventory_reverse_purchase_receipt_impl(uuid,text,text)'::regprocedure)
    into v_definition;
  v_definition := replace(v_definition, 'where lot.source_document_line_id = v_line.id',
    'where lot.source_document_line_id = v_line.id and lot.lot_origin_key = ''receipt''');
  v_definition := replace(v_definition, 'where source_document_line_id = v_line.id;',
    'where source_document_line_id = v_line.id and lot_origin_key = ''receipt'';');
  execute v_definition;
end;
$migration$;

create or replace function private.inventory_sync_movement_lots()
returns trigger language plpgsql set search_path = '' as $function$
declare
  v_document public.inventory_documents%rowtype;
  v_lot record;
  v_left numeric(18,6) := new.quantity;
  v_take numeric(18,6);
  v_id uuid;
  v_dispatch public.inventory_stock_movements%rowtype;
begin
  -- Existing business RPCs already lock balances first; retain that lock order.
  perform 1 from public.inventory_stock_balances
    where warehouse_id = new.warehouse_id and item_id = new.item_id for update;
  select * into strict v_document from public.inventory_documents where id = new.document_id;

  -- Receipt reversal already validates/decrements its own exact source lot.
  if new.direction = 'out' and new.movement_stage = 'reversal'
    and exists (select 1 from public.inventory_documents
      where id = v_document.source_document_id and document_type = 'purchase_receipt') then
    return new;
  end if;

  if new.direction = 'out' then
    for v_lot in
      select * from public.inventory_stock_lots
      where warehouse_id = new.warehouse_id and item_id = new.item_id
        and remaining_quantity > 0 and status = 'active'
      order by expires_on nulls last, created_at, id for update
    loop
      exit when v_left <= 0;
      v_take := least(v_left, v_lot.remaining_quantity);
      update public.inventory_stock_lots
      set remaining_quantity = remaining_quantity - v_take,
          status = case when remaining_quantity = v_take then 'depleted' else status end,
          updated_at = now()
      where id = v_lot.id;
      insert into private.inventory_lot_allocations values (new.id, v_lot.id, v_take);
      v_left := v_left - v_take;
    end loop;
    -- A remainder is legacy/unallocated stock, not permission to change total stock.
    return new;
  end if;

  if new.movement_stage = 'completion'
    and v_document.document_type in ('purchase_receipt', 'production_output') then
    -- The existing receipt trigger runs before this trigger (alphabetical order).
    return new;
  end if;

  if new.movement_stage = 'reversal' and v_document.source_document_id is not null then
    for v_lot in
      select l.id, l.remaining_quantity, l.received_quantity,
        sum(a.quantity) as allocated
      from private.inventory_lot_allocations a
      join public.inventory_stock_movements m on m.id = a.movement_id
      join public.inventory_stock_lots l on l.id = a.lot_id
      where m.document_id = v_document.source_document_id and m.direction = 'out'
        and m.warehouse_id = new.warehouse_id and m.item_id = new.item_id
      group by l.id order by l.id
    loop
      exit when v_left <= 0;
      perform 1 from public.inventory_stock_lots where id = v_lot.id for update;
      v_take := least(v_left, v_lot.allocated, v_lot.received_quantity - v_lot.remaining_quantity);
      if v_take > 0 then
        update public.inventory_stock_lots
        set remaining_quantity = remaining_quantity + v_take,
            status = case when status = 'depleted' then 'active' else status end,
            updated_at = now()
        where id = v_lot.id;
        insert into private.inventory_lot_allocations values (new.id, v_lot.id, v_take);
        v_left := v_left - v_take;
      end if;
    end loop;
  elsif new.movement_stage = 'receipt' and v_document.document_type = 'transfer' then
    select * into v_dispatch from public.inventory_stock_movements
      where document_line_id = new.document_line_id and direction = 'out'
        and movement_stage = 'dispatch' and warehouse_id = v_document.source_warehouse_id;
    -- When multiple lots were dispatched but only part arrived, identity is unknown.
    -- Do not invent which expiry arrived; preserve identity only for full receipt.
    if found and v_dispatch.quantity = new.quantity then
      for v_lot in
        select l.*, a.quantity as allocated from private.inventory_lot_allocations a
        join public.inventory_stock_lots l on l.id = a.lot_id
        where a.movement_id = v_dispatch.id order by l.id
      loop
        v_take := least(v_left, v_lot.allocated);
        exit when v_take <= 0;
        insert into public.inventory_stock_lots (
          warehouse_id, item_id, source_document_id, source_document_line_id,
          lot_origin_key, lot_number, manufactured_on, expires_on,
          received_quantity, remaining_quantity, unit_cost, metadata, created_by
        ) values (
          new.warehouse_id, new.item_id, new.document_id, new.document_line_id,
          'transfer:' || v_lot.id, v_lot.lot_number, v_lot.manufactured_on, v_lot.expires_on,
          v_take, v_take, new.unit_cost,
          jsonb_build_object('source_type', 'transfer', 'document_no', v_document.document_no,
            'parent_lot_id', v_lot.id, 'lot_identity_unknown',
            coalesce((v_lot.metadata->>'lot_identity_unknown')::boolean, false)), new.created_by
        ) returning id into v_id;
        insert into private.inventory_lot_allocations values (new.id, v_id, v_take);
        v_left := v_left - v_take;
      end loop;
    end if;
  end if;

  if v_left > 0 then
    insert into public.inventory_stock_lots (
      warehouse_id, item_id, source_document_id, source_document_line_id,
      lot_origin_key, lot_number, received_quantity, remaining_quantity,
      unit_cost, metadata, created_by
    ) values (
      new.warehouse_id, new.item_id, new.document_id, new.document_line_id,
      'unallocated:' || new.id, 'CXĐ-' || v_document.document_no, v_left, v_left,
      new.unit_cost, jsonb_build_object('source_type', v_document.document_type,
        'document_no', v_document.document_no, 'lot_identity_unknown', true), new.created_by
    ) returning id into v_id;
    insert into private.inventory_lot_allocations values (new.id, v_id, v_left);
  end if;
  return new;
end;
$function$;
revoke all on function private.inventory_sync_movement_lots() from public, anon, authenticated;

drop trigger if exists inventory_sync_lots_after_movement on public.inventory_stock_movements;
create trigger inventory_sync_lots_after_movement
  after insert on public.inventory_stock_movements for each row
  execute function private.inventory_sync_movement_lots();

-- Unit rebasing updates movements and lots separately; keep allocation quantities aligned.
create or replace function private.inventory_rebase_lot_allocations()
returns trigger language plpgsql set search_path = '' as $function$
begin
  update private.inventory_lot_allocations
  set quantity = round(quantity * new.quantity / old.quantity, 6)
  where movement_id = new.id;
  return new;
end;
$function$;
revoke all on function private.inventory_rebase_lot_allocations() from public, anon, authenticated;
drop trigger if exists inventory_rebase_lot_allocations on public.inventory_stock_movements;
create trigger inventory_rebase_lot_allocations
  after update of quantity on public.inventory_stock_movements for each row
  when (old.quantity is distinct from new.quantity)
  execute function private.inventory_rebase_lot_allocations();
notify pgrst, 'reload schema';
-- Run once with the movement-sync migration, in the SAME transaction.
-- No inferred historical FIFO/FEFO; retain source lots in a private recovery snapshot.
lock table public.inventory_stock_balances, public.inventory_stock_movements,
  public.inventory_stock_lots in share row exclusive mode;
create table if not exists private.inventory_lot_reconciliation_backup (
  revision text not null, lot_id uuid not null, snapshot jsonb not null,
  saved_at timestamptz not null default now(), primary key (revision, lot_id)
);
alter table private.inventory_lot_reconciliation_backup enable row level security;
revoke all on private.inventory_lot_reconciliation_backup from public, anon, authenticated;

do $reconcile$
declare
  v_pair record;
  v_source record;
  v_before text;
  v_after text;
begin
  select md5(coalesce(jsonb_agg(to_jsonb(b) order by warehouse_id,item_id)::text,''))
    into v_before from public.inventory_stock_balances b;
  for v_pair in
    select b.warehouse_id,b.item_id,b.quantity,b.average_cost,
      coalesce(sum(l.remaining_quantity),0) as lot_quantity
    from public.inventory_stock_balances b
    join public.inventory_items i on i.id=b.item_id
    left join public.inventory_stock_lots l on l.warehouse_id=b.warehouse_id and l.item_id=b.item_id
    where coalesce(i.metadata->>'track_expiry','false')='true' or l.id is not null
    group by b.warehouse_id,b.item_id,b.quantity,b.average_cost
    having coalesce(sum(l.remaining_quantity),0) <> greatest(b.quantity,0)
  loop
    insert into private.inventory_lot_reconciliation_backup(revision,lot_id,snapshot)
      select '20260917',l.id,to_jsonb(l) from public.inventory_stock_lots l
      where l.warehouse_id=v_pair.warehouse_id and l.item_id=v_pair.item_id
      on conflict do nothing;
    -- Unknown identity is not expired or valid: retire stale balances without deleting history.
    update public.inventory_stock_lots
      set remaining_quantity=0,status='depleted',updated_at=now(),
          metadata=metadata || jsonb_build_object('reconciled_at',now(),
            'reconciliation_reason','legacy_lot_identity_unavailable')
      where warehouse_id=v_pair.warehouse_id and item_id=v_pair.item_id;
    if v_pair.quantity>0 then
      select m.document_id,m.document_line_id,d.document_no,m.created_by into v_source
      from public.inventory_stock_movements m join public.inventory_documents d on d.id=m.document_id
      where m.warehouse_id=v_pair.warehouse_id and m.item_id=v_pair.item_id and m.direction='in'
      order by m.movement_sequence desc limit 1;
      if not found then raise exception 'Positive legacy stock has no inbound source; stop for review.'; end if;
      insert into public.inventory_stock_lots(
        warehouse_id,item_id,source_document_id,source_document_line_id,lot_origin_key,
        lot_number,received_quantity,remaining_quantity,unit_cost,metadata,created_by
      ) values (
        v_pair.warehouse_id,v_pair.item_id,v_source.document_id,v_source.document_line_id,
        'baseline:20260917','CXĐ-TỒN-CŨ',v_pair.quantity,v_pair.quantity,v_pair.average_cost,
        jsonb_build_object('lot_identity_unknown',true,'source_type','legacy_reconciliation',
          'document_no',v_source.document_no,'baseline_quantity',v_pair.quantity,
          'reconciliation_revision','20260917'),v_source.created_by
      );
    end if;
  end loop;
  select md5(coalesce(jsonb_agg(to_jsonb(b) order by warehouse_id,item_id)::text,''))
    into v_after from public.inventory_stock_balances b;
  if v_before is distinct from v_after then raise exception 'Balances changed during lot reconciliation.'; end if;
end;
$reconcile$;
