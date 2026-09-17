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
