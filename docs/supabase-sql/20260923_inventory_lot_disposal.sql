-- Exact-lot disposal: draft only; completion retains existing authorization and ledger engine.
create or replace function public.inventory_create_lot_disposal_draft(
  p_lot_id uuid, p_quantity numeric, p_reason text, p_request_id uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_lot public.inventory_stock_lots%rowtype;
  v_item public.inventory_items%rowtype;
  v_doc public.inventory_documents%rowtype;
  v_key text := 'lot-disposal:' || p_request_id;
begin
  if auth.uid() is null then raise exception 'Bạn cần đăng nhập.'; end if;
  if p_request_id is null or p_quantity is null or p_quantity::text in ('NaN','Infinity','-Infinity')
    or p_quantity <= 0 or p_quantity <> round(p_quantity,6) then
    raise exception 'Số lượng hủy không hợp lệ.';
  end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'Vui lòng nhập lý do hủy.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_key,0));
  select * into v_doc from public.inventory_documents where idempotency_key=v_key;
  if found then
    if v_doc.created_by is distinct from auth.uid() or v_doc.metadata->>'disposal_lot_id' is distinct from p_lot_id::text
      or (v_doc.metadata->>'disposal_quantity')::numeric is distinct from p_quantity
      or v_doc.metadata->>'disposal_reason' is distinct from btrim(p_reason) then
      raise exception 'Yêu cầu đã được dùng cho một phiếu khác.';
    end if;
    return jsonb_build_object('id',v_doc.id,'documentNo',v_doc.document_no);
  end if;
  -- RLS applies to both lot reads and document writes.
  select * into v_lot from public.inventory_stock_lots where id=p_lot_id;
  if not found then raise exception 'Không tìm thấy lô hoặc bạn không có quyền truy cập.'; end if;
  if v_lot.status <> 'active' or p_quantity > v_lot.remaining_quantity then
    raise exception 'Lô không còn đủ số lượng. Vui lòng tải lại danh sách.';
  end if;
  select * into strict v_item from public.inventory_items where id=v_lot.item_id;
  insert into public.inventory_documents(document_no,idempotency_key,document_type,status,
    source_warehouse_id,notes,metadata,created_by)
  values ('PH-LO-'||to_char(now() at time zone 'Asia/Bangkok','YYYYMMDD-HH24MISS')||'-'||left(p_request_id::text,8),
    v_key,'waste','draft',v_lot.warehouse_id,
    btrim(p_reason)||' — Lô '||v_lot.lot_number||coalesce(' — HSD '||v_lot.expires_on::text,''),
    jsonb_build_object('disposal_reason',btrim(p_reason),'disposal_lot_id',v_lot.id,
      'disposal_quantity',p_quantity,'disposal_lot_number',v_lot.lot_number),auth.uid()) returning * into v_doc;
  insert into public.inventory_document_lines(document_id,item_id,unit_id,conversion_to_base,
    expected_quantity,actual_quantity,lot_number,manufactured_on,expires_on,notes)
  values(v_doc.id,v_item.id,v_item.base_unit_id,1,p_quantity,p_quantity,v_lot.lot_number,
    v_lot.manufactured_on,v_lot.expires_on,btrim(p_reason)||' — Lô '||v_lot.lot_number);
  return jsonb_build_object('id',v_doc.id,'documentNo',v_doc.document_no);
end;
$$;
revoke all on function public.inventory_create_lot_disposal_draft(uuid,numeric,text,uuid) from public,anon;
grant execute on function public.inventory_create_lot_disposal_draft(uuid,numeric,text,uuid) to authenticated;

-- Preserve every other movement path verbatim. Abort if the installed engine differs.
do $patch$
declare v_def text; v_anchor text := E'  if new.direction = ''out'' then\n    for v_lot in';
begin
  select pg_get_functiondef('private.inventory_sync_movement_lots()'::regprocedure) into v_def;
  if position('-- exact-disposal-lot-v1' in v_def)>0 then return; end if;
  if position(v_anchor in v_def)=0 then raise exception 'Lot engine changed; review before applying'; end if;
  v_def := replace(v_def,v_anchor,$block$
  -- exact-disposal-lot-v1: never fall back to another lot, even if total stock is sufficient.
  if new.direction = 'out' and v_document.document_type = 'waste'
    and v_document.metadata ? 'disposal_lot_id' then
    select * into v_lot from public.inventory_stock_lots
      where id=(v_document.metadata->>'disposal_lot_id')::uuid for update;
    if not found then raise exception 'Lô cần hủy không còn tồn tại.'; end if;
    if v_lot.warehouse_id <> new.warehouse_id or v_lot.item_id <> new.item_id then
      raise exception 'Lô cần hủy không khớp kho hoặc nguyên vật liệu.';
    end if;
    if v_lot.status <> 'active' or new.quantity > v_lot.remaining_quantity then
      raise exception 'Lô cần hủy không còn đủ số lượng; chưa ghi giảm tồn. Vui lòng kiểm tra lại.';
    end if;
    update public.inventory_stock_lots set remaining_quantity=remaining_quantity-new.quantity,
      status=case when remaining_quantity=new.quantity then 'depleted' else status end,updated_at=now()
      where id=v_lot.id;
    insert into private.inventory_lot_allocations(movement_id,lot_id,quantity) values(new.id,v_lot.id,new.quantity);
    return new;
  end if;
  if new.direction = 'out' then
    for v_lot in$block$);
  execute v_def;
end;
$patch$;
notify pgrst,'reload schema';
