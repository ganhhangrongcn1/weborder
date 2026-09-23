-- Run after feature SQL inside BEGIN/ROLLBACK. Never commit these test documents.
do $test$
declare l public.inventory_stock_lots%rowtype; actor uuid; key uuid:=gen_random_uuid();
  d jsonb; d2 jsonb; before_balance numeric; other_lots jsonb; after_lots jsonb;
  denied boolean:=false; bad jsonb;
begin
  select * into strict l from public.inventory_stock_lots
    where status='active' and remaining_quantity>=2 order by expires_on desc nulls last limit 1;
  select auth_user_id into strict actor from public.inventory_user_access
    where role in ('owner','admin') and is_active limit 1;
  select quantity into before_balance from public.inventory_stock_balances where warehouse_id=l.warehouse_id and item_id=l.item_id;
  select jsonb_agg(to_jsonb(s) order by id) into other_lots from public.inventory_stock_lots s
    where warehouse_id=l.warehouse_id and item_id=l.item_id and id<>l.id;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  set local role authenticated;
  d := public.inventory_create_lot_disposal_draft(l.id,1,'Kiểm thử hoàn tác',key);
  d2 := public.inventory_create_lot_disposal_draft(l.id,1,'Kiểm thử hoàn tác',key);
  if d<>d2 then raise exception 'Draft retry duplicated'; end if;
  if (select remaining_quantity from public.inventory_stock_lots where id=l.id)<>l.remaining_quantity then
    raise exception 'Draft changed lot'; end if;
  begin
    perform public.inventory_create_lot_disposal_draft(l.id,l.remaining_quantity+1,'test',gen_random_uuid());
  exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'Oversize draft accepted'; end if;
  perform public.inventory_submit_document((d->>'id')::uuid,'test-submit-'||key);
  perform public.inventory_complete_simple_document((d->>'id')::uuid,'test-complete-'||key);
  perform public.inventory_complete_simple_document((d->>'id')::uuid,'test-complete-'||key);
  reset role;
  if (select remaining_quantity from public.inventory_stock_lots where id=l.id)<>l.remaining_quantity-1 then
    raise exception 'Exact lot or completion idempotency failed'; end if;
  if (select quantity from public.inventory_stock_balances where warehouse_id=l.warehouse_id and item_id=l.item_id)<>before_balance-1 then
    raise exception 'Balance not synchronized'; end if;
  select jsonb_agg(to_jsonb(s) order by id) into after_lots from public.inventory_stock_lots s
    where warehouse_id=l.warehouse_id and item_id=l.item_id and id<>l.id;
  if other_lots is distinct from after_lots then raise exception 'Other lot changed'; end if;
  -- Stale draft must fail atomically at completion, even if another lot has stock.
  bad:=public.inventory_create_lot_disposal_draft(l.id,l.remaining_quantity-1,'test-stale',gen_random_uuid());
  update public.inventory_stock_lots set remaining_quantity=0,status='depleted' where id=l.id;
  perform public.inventory_submit_document((bad->>'id')::uuid,'test-stale-submit-'||key);
  denied:=false;
  begin
    perform public.inventory_complete_simple_document((bad->>'id')::uuid,'test-stale-complete-'||key);
  exception when raise_exception then denied:=true; end;
  if not denied or exists(select 1 from public.inventory_stock_movements where document_id=(bad->>'id')::uuid) then
    raise exception 'Stale lot did not roll back'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  denied:=false;
  begin
    perform public.inventory_create_lot_disposal_draft(l.id,1,'test',gen_random_uuid());
  exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'Unauthenticated draft accepted'; end if;
end;
$test$;
select 'PASS: authenticated draft, no draft deduction, retry idempotency, exact lot, balance, other lots unchanged, stale lot rollback, anonymous rejection' result;
