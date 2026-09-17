-- Run inside BEGIN / ROLLBACK. No fixture is committed.
create function pg_temp.lot_test_post(p_item uuid,p_wh uuid,p_to uuid,p_type text,
  p_direction text,p_stage text,p_qty numeric,p_expiry date default null,p_source uuid default null)
returns uuid language plpgsql as $$
declare d uuid; l uuid; m uuid; u uuid;
begin
  select base_unit_id into u from public.inventory_items where id=p_item;
  insert into public.inventory_documents(document_no,idempotency_key,document_type,
    source_warehouse_id,destination_warehouse_id,source_document_id,reversal_reason)
  values ('TEST-LOT-'||gen_random_uuid(),gen_random_uuid()::text,p_type,p_wh,p_to,p_source,
    case when p_source is not null then 'rollback test' end) returning id into d;
  insert into public.inventory_document_lines(document_id,item_id,unit_id,expected_quantity,
    actual_quantity,base_quantity,lot_number,expires_on)
  values(d,p_item,u,p_qty,p_qty,p_qty,'TEST-'||d,p_expiry) returning id into l;
  insert into public.inventory_stock_movements(warehouse_id,item_id,document_id,document_line_id,
    direction,movement_stage,quantity,unit_cost,occurred_at)
  values(p_wh,p_item,d,l,p_direction,p_stage,p_qty,0,now()) returning id into m;
  return m;
end;
$$;

do $tests$
declare
  i uuid; w uuid; w2 uuid; m uuid; m2 uuid; m3 uuid; d uuid; a uuid; b uuid;
  q numeric; before_balances text; after_balances text; n integer;
begin
  select item_id,warehouse_id into i,w from public.inventory_stock_lots
    order by created_at limit 1;
  select id into w2 from public.inventory_warehouses where id<>w order by id limit 1;
  if i is null or w2 is null then raise exception 'Missing fixture catalog'; end if;
  select md5(jsonb_agg(to_jsonb(x) order by warehouse_id,item_id)::text)
    into before_balances from public.inventory_stock_balances x;
  update public.inventory_stock_lots set remaining_quantity=0,status='depleted'
    where item_id=i and warehouse_id in (w,w2);

  m := pg_temp.lot_test_post(i,w,w,'purchase_receipt','in','completion',7000,current_date+2);
  select id into a from public.inventory_stock_lots
    where source_document_line_id=(select document_line_id from public.inventory_stock_movements where id=m);
  m := pg_temp.lot_test_post(i,w,w,'purchase_receipt','in','completion',7000,current_date+1);
  select id into b from public.inventory_stock_lots
    where source_document_line_id=(select document_line_id from public.inventory_stock_movements where id=m);
  -- FEFO, not receipt order; movement quantity already is in base units.
  m := pg_temp.lot_test_post(i,w,w,'stock_issue','out','order_consumption',8000);
  if (select remaining_quantity from public.inventory_stock_lots where id=b)<>0
    or (select remaining_quantity from public.inventory_stock_lots where id=a)<>6000 then
    raise exception 'FEFO/split failed'; end if;
  -- Duplicate insert must not fire an AFTER INSERT trigger.
  insert into public.inventory_stock_movements(warehouse_id,item_id,document_id,document_line_id,
    direction,movement_stage,quantity,unit_cost,occurred_at)
  select warehouse_id,item_id,document_id,document_line_id,direction,movement_stage,quantity,unit_cost,now()
    from public.inventory_stock_movements where id=m on conflict do nothing;
  if (select remaining_quantity from public.inventory_stock_lots where id=a)<>6000 then
    raise exception 'Duplicate consumed twice'; end if;
  select document_id into d from public.inventory_stock_movements where id=m;
  perform pg_temp.lot_test_post(i,w,w,'reversal','in','reversal',8000,null,d);
  if (select sum(remaining_quantity) from public.inventory_stock_lots where id in (a,b))<>14000 then
    raise exception 'Sale reversal failed'; end if;
  -- Waste and count/manual decrease follow the same movement path.
  perform pg_temp.lot_test_post(i,w,w,'waste','out','completion',1000);
  perform pg_temp.lot_test_post(i,w,w,'stock_adjustment','out','adjustment',1000);
  if (select remaining_quantity from public.inventory_stock_lots where id=b)<>5000 then
    raise exception 'Waste/adjustment failed'; end if;

  m := pg_temp.lot_test_post(i,w,w2,'transfer','out','dispatch',8000);
  insert into public.inventory_stock_movements(warehouse_id,item_id,document_id,document_line_id,
    direction,movement_stage,quantity,unit_cost,occurred_at)
  select w2,item_id,document_id,document_line_id,'in','receipt',quantity,unit_cost,now()
    from public.inventory_stock_movements where id=m returning id into m2;
  select count(*),sum(remaining_quantity) into n,q from public.inventory_stock_lots
    where warehouse_id=w2 and item_id=i and remaining_quantity>0;
  if n<>2 or q<>8000 then raise exception 'Transfer multi-lot failed'; end if;
  if exists(select 1 from public.inventory_stock_lots
    where warehouse_id=w2 and item_id=i and remaining_quantity>0 and expires_on is null) then
    raise exception 'Transfer lost expiry'; end if;

  m := pg_temp.lot_test_post(i,w,w2,'transfer','out','dispatch',1000);
  insert into public.inventory_stock_movements(warehouse_id,item_id,document_id,document_line_id,
    direction,movement_stage,quantity,unit_cost,occurred_at)
  select w2,item_id,document_id,document_line_id,'in','receipt',500,unit_cost,now()
    from public.inventory_stock_movements where id=m returning id into m3;
  if not exists(select 1 from public.inventory_stock_lots l
    join private.inventory_lot_allocations x on x.lot_id=l.id where x.movement_id=m3
    and l.expires_on is null and l.metadata->>'lot_identity_unknown'='true') then
    raise exception 'Partial transfer invented expiry'; end if;
  m := pg_temp.lot_test_post(i,w,w,'stock_adjustment','in','adjustment',5800);
  if (select sum(quantity) from private.inventory_lot_allocations where movement_id=m)<>5800 then
    raise exception 'Base-unit adjustment changed quantity'; end if;

  -- Receipt reversal owns its exact lot; generic trigger must not double-consume.
  m := pg_temp.lot_test_post(i,w,w,'purchase_receipt','in','completion',100,current_date+3);
  select document_id into d from public.inventory_stock_movements where id=m;
  select id into a from public.inventory_stock_lots where source_document_id=d;
  perform pg_temp.lot_test_post(i,w,w,'reversal','out','reversal',100,null,d);
  if (select remaining_quantity from public.inventory_stock_lots where id=a)<>100 then
    raise exception 'Receipt reversal double-consumed'; end if;
  -- Rebase allocation only, never consume another time.
  update public.inventory_stock_movements set quantity=quantity*1000 where id=m2;
  if (select sum(quantity) from private.inventory_lot_allocations where movement_id=m2)<>8000000 then
    raise exception 'Rebase allocation failed'; end if;
  select md5(jsonb_agg(to_jsonb(x) order by warehouse_id,item_id)::text)
    into after_balances from public.inventory_stock_balances x;
  if before_balances is distinct from after_balances then raise exception 'Lot code mutated total stock'; end if;
end;
$tests$;
select 'PASS: FEFO, split, retry, sale reversal, waste, adjustment, transfer, partial receipt, units, rebase, unchanged totals' as result;
