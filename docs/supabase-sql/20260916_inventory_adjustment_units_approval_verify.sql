begin;
do $$
declare actor uuid; wh uuid; item public.inventory_items%rowtype; doc uuid; line public.inventory_document_lines%rowtype;
  initial numeric; current_qty numeric; dir text; key text;
begin
  select auth_user_id into actor from public.inventory_user_access where is_active and role in ('owner','admin') limit 1;
  select id into wh from public.inventory_warehouses where is_active limit 1;
  select * into item from public.inventory_items where code='NVL_000054' and is_active;
  if actor is null or wh is null or item.id is null then raise exception 'Fixture unavailable'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  select coalesce(quantity,0) into initial from public.inventory_stock_balances where warehouse_id=wh and item_id=item.id;
  initial := coalesce(initial,0);
  foreach dir in array array['in','out'] loop
    key := 'unit-regression-'||gen_random_uuid()::text;
    insert into public.inventory_documents(document_no,idempotency_key,document_type,status,source_warehouse_id,notes)
    values(key,key,'stock_adjustment','submitted',wh,'Rollback-only unit regression') returning id into doc;
    insert into public.inventory_document_lines(document_id,item_id,unit_id,conversion_to_base,expected_quantity,actual_quantity,adjustment_direction)
    values(doc,item.id,item.purchase_unit_id,1,1,1,dir) returning * into line;
    if line.unit_id<>item.purchase_unit_id or line.conversion_to_base<>1000 then raise exception 'Wrong unit or factor'; end if;
    perform public.inventory_approve_stock_adjustment(doc,key);
    perform public.inventory_approve_stock_adjustment(doc,key);
    select quantity into current_qty from public.inventory_stock_balances where warehouse_id=wh and item_id=item.id;
    if current_qty <> initial + (case when dir='in' then 1000 else 0 end) then raise exception 'Wrong balance'; end if;
    if (select count(*) from public.inventory_stock_movements where document_id=doc)<>1 then raise exception 'Duplicate movement'; end if;
    if (select quantity from public.inventory_stock_movements where document_id=doc)<>1000 then raise exception 'Wrong movement quantity'; end if;
  end loop;
end $$;
select 'PASS: +1 Kg / -1 Kg, 1000 base units, approval replay does not duplicate' as result;
rollback;
