-- Explicitly approved convention: consume earlier-expiry lots first.
-- Only Xoai So Che in CN 30/4, not a claim of historical physical traceability.
-- Execute inside BEGIN/COMMIT (or BEGIN/ROLLBACK for rehearsal).
set local lock_timeout = '5s';
lock table public.inventory_stock_balances, public.inventory_stock_movements,
  public.inventory_stock_lots in share row exclusive mode;
do $repair$
declare
  v_item uuid; v_wh uuid; v_baseline public.inventory_stock_lots%rowtype;
  v_lot record; v_left numeric; v_take numeric; v_before text; v_after text;
  v_other_lots text; v_business text; v_stock numeric; v_count integer;
begin
  select id into strict v_item from public.inventory_items where code='BTP_000124';
  select id into strict v_wh from public.inventory_warehouses where code='WH-BR-20260824-8516';
  if exists(select 1 from private.inventory_lot_reconciliation_backup
    where revision='20260917-mango-approved-fefo') then return; end if;
  select * into strict v_baseline from public.inventory_stock_lots
    where item_id=v_item and warehouse_id=v_wh and lot_origin_key='baseline:20260917';
  if exists(select 1 from private.inventory_lot_allocations where lot_id=v_baseline.id) then
    raise exception 'Baseline has subsequent allocations; stop for review.';
  end if;
  select count(*) into v_count from public.inventory_stock_lots l
    join private.inventory_lot_reconciliation_backup b on b.lot_id=l.id and b.revision='20260917'
    where l.item_id=v_item and l.warehouse_id=v_wh and l.lot_origin_key='receipt'
      and l.remaining_quantity=0 and l.lot_number in ('SX-LSX-000026','SX-LSX-000028');
  if v_count<>2 then raise exception 'Original lot state changed; stop for review.'; end if;
  select quantity into strict v_stock from public.inventory_stock_balances
    where item_id=v_item and warehouse_id=v_wh;
  if v_stock<>v_baseline.remaining_quantity or v_stock>14000 or v_stock<0 then
    raise exception 'Stock differs from approved baseline; stop for review.';
  end if;

  select md5(jsonb_build_object(
    'balances',(select jsonb_agg(to_jsonb(x) order by warehouse_id,item_id) from public.inventory_stock_balances x),
    'movements',(select jsonb_agg(to_jsonb(x) order by id) from public.inventory_stock_movements x),
    'documents',(select jsonb_agg(to_jsonb(x) order by id) from public.inventory_documents x),
    'lines',(select jsonb_agg(to_jsonb(x) order by id) from public.inventory_document_lines x)
  )::text) into v_before;
  select md5(jsonb_agg(to_jsonb(l) order by id)::text) into v_other_lots
    from public.inventory_stock_lots l where not (item_id=v_item and warehouse_id=v_wh);
  insert into private.inventory_lot_reconciliation_backup(revision,lot_id,snapshot)
    select '20260917-mango-approved-fefo',l.id,to_jsonb(l) from public.inventory_stock_lots l
    where l.item_id=v_item and l.warehouse_id=v_wh;

  v_left := v_baseline.remaining_quantity;
  -- Retain remaining stock in the last-to-be-consumed lots (reverse FEFO order).
  for v_lot in
    select l.* from public.inventory_stock_lots l
    join private.inventory_lot_reconciliation_backup b on b.lot_id=l.id and b.revision='20260917'
    where l.item_id=v_item and l.warehouse_id=v_wh and l.lot_origin_key='receipt'
    order by l.expires_on desc nulls first,l.created_at desc,l.id desc
  loop
    v_take := least(v_left,v_lot.received_quantity);
    update public.inventory_stock_lots set remaining_quantity=v_take,
      status=case when v_take>0 then 'active' else 'depleted' end,updated_at=now(),
      metadata=metadata || jsonb_build_object('reconciliation_reason','user_approved_legacy_fefo',
        'legacy_allocation_inferred',true,'legacy_fefo_at',now()) where id=v_lot.id;
    v_left := v_left-v_take;
  end loop;
  if v_left<>0 then raise exception 'Insufficient original lot capacity'; end if;
  update public.inventory_stock_lots set remaining_quantity=0,status='depleted',updated_at=now(),
    metadata=metadata || jsonb_build_object('superseded_by','user_approved_legacy_fefo')
    where id=v_baseline.id;
  if (select sum(remaining_quantity) from public.inventory_stock_lots
      where item_id=v_item and warehouse_id=v_wh)<>v_stock then
    raise exception 'Lot total changed'; end if;
  if (select md5(jsonb_agg(to_jsonb(l) order by id)::text) from public.inventory_stock_lots l
      where not (item_id=v_item and warehouse_id=v_wh)) is distinct from v_other_lots then
    raise exception 'Unrelated lots changed'; end if;
  select md5(jsonb_build_object(
    'balances',(select jsonb_agg(to_jsonb(x) order by warehouse_id,item_id) from public.inventory_stock_balances x),
    'movements',(select jsonb_agg(to_jsonb(x) order by id) from public.inventory_stock_movements x),
    'documents',(select jsonb_agg(to_jsonb(x) order by id) from public.inventory_documents x),
    'lines',(select jsonb_agg(to_jsonb(x) order by id) from public.inventory_document_lines x)
  )::text) into v_after;
  if v_before is distinct from v_after then raise exception 'Business data changed'; end if;
end;
$repair$;
