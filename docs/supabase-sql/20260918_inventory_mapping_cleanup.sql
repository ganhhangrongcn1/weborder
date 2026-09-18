-- Approved scoped data repair. Backup: .tmp/inventory-mapping-cleanup-20260918-before.json
-- No sales processor calls, stock adjustments, or recipe edits.
begin isolation level repeatable read;
do $repair$
declare
  v_source public.inventory_channel_mappings%rowtype;
  v_row record;
  v_new uuid;
  v_inserted uuid[] := array[]::uuid[];
  v_remove uuid := '128bf3d4-aac8-4fcc-ab8c-fab66f1f4f6e';
  v_keep uuid := '128fe2a1-745a-4d2a-99c3-8d67ddedb8ff';
  v_before text; v_after text;
  v_stock_before text; v_stock_after text;
  v_left jsonb; v_right jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('inventory-mapping-cleanup-20260918'));
  select md5(jsonb_build_array(
    (select jsonb_agg(to_jsonb(m) order by m.id) from public.inventory_channel_mappings m where m.id <> v_remove),
    (select jsonb_agg(to_jsonb(t) order by t.id) from public.inventory_channel_mapping_targets t where t.mapping_id <> v_remove)
  )::text) into v_before;
  select md5(jsonb_build_array(
    (select jsonb_agg(to_jsonb(b) order by b.warehouse_id,b.item_id) from public.inventory_stock_balances b),
    (select jsonb_agg(to_jsonb(m) order by m.id) from public.inventory_stock_movements m),
    (select jsonb_agg(to_jsonb(d) order by d.id) from public.inventory_documents d),
    (select jsonb_agg(to_jsonb(e) order by e.id) from public.inventory_sales_order_events e)
  )::text) into v_stock_before;
  -- Require both duplicates to be active, same scope, same target and quantity.
  assert (select count(*)=2 from public.inventory_channel_mappings m
    where m.id in (v_remove,v_keep) and m.partner_source='grabfood'
      and m.branch_uuid='c0d35bd0-e614-4973-9eb2-17e78fb9a245'
      and m.mapping_kind='item' and m.status='active' and not m.ignore_inventory
      and m.external_item_id='' and private.inventory_sales_full_item_name(m.external_item_name)
        = private.inventory_sales_full_item_name('Trà Sữa Gạo Rang - Size L')), 'Duplicate mappings changed; stop';
  select jsonb_agg(jsonb_build_array(menu_entity_type,menu_entity_id,quantity) order by menu_entity_type,menu_entity_id)
    into v_left from public.inventory_channel_mapping_targets where mapping_id=v_keep;
  select jsonb_agg(jsonb_build_array(menu_entity_type,menu_entity_id,quantity) order by menu_entity_type,menu_entity_id)
    into v_right from public.inventory_channel_mapping_targets where mapping_id=v_remove;
  assert v_left is not null and v_left=v_right, 'Duplicate targets differ; stop';
  delete from public.inventory_channel_mappings where id=v_remove;
  assert private.inventory_resolve_channel_item_mapping('grabfood','c0d35bd0-e614-4973-9eb2-17e78fb9a245','','Trà Sữa Gạo Rang - Size L')=v_keep, 'Duplicate still unresolved';

  for v_row in select * from (values
    ('f8c2f70b-fdc8-44f2-b7a2-4f49b4f91a93','2ae2433d-081e-4a1c-a65f-8b158f48df56','Nexpos1040637_158830320','Bánh Tráng Phơi Sương Mỡ Hành Tóp Mỡ'),
    ('f8c2f70b-fdc8-44f2-b7a2-4f49b4f91a93','c0d35bd0-e614-4973-9eb2-17e78fb9a245','Nexpos1040637_158830320','Bánh Tráng Phơi Sương Mỡ Hành Tóp Mỡ'),
    ('8269b628-dd78-4dea-aebc-3dc97180dbc0','2ae2433d-081e-4a1c-a65f-8b158f48df56','Nexpos_1201999_177817103','Trùm Deal - Bánh Tráng Phơi Sương Cuốn Trộn'),
    ('69273939-ef25-4b58-80b6-a327e6471f88','c0d35bd0-e614-4973-9eb2-17e78fb9a245','Nexpos1040637_288486876','Trứng Cút Lòng Đào Rim Me')
  ) x(source_id,branch_id,external_id,item_name)
  loop
    select * into strict v_source from public.inventory_channel_mappings where id=v_row.source_id::uuid;
    assert v_source.partner_source='shopeefood' and v_source.mapping_kind='item'
      and v_source.status='active' and not v_source.ignore_inventory
      and v_source.external_item_name=v_row.item_name, 'Source mapping changed';
    assert exists(select 1 from public.partner_order_items p join public.partner_orders o on o.id=p.partner_order_id
      where p.partner_source='shopeefood' and p.partner_item_id=v_row.external_id
      and p.partner_item_name=v_row.item_name and o.branch_uuid=v_row.branch_id::uuid), 'No observed order for alias';
    assert private.inventory_resolve_channel_item_mapping('shopeefood',v_row.branch_id::uuid,v_row.external_id,v_row.item_name) is null
      or private.inventory_resolve_channel_item_mapping('shopeefood',v_row.branch_id::uuid,v_row.external_id,v_row.item_name)=any(v_inserted),
      'Alias already resolves outside this repair; re-audit before rerun';
    insert into public.inventory_channel_mappings(
      partner_source,branch_uuid,mapping_kind,external_item_id,external_item_name,ignore_inventory,status,
      notes,metadata,created_by,updated_by)
    values ('shopeefood',v_row.branch_id::uuid,'item',v_row.external_id,v_row.item_name,false,'active',
      'Bổ sung mã món đã xác minh trên đơn; giữ nguyên định lượng và cấu hình cũ.',
      jsonb_build_object('repair','inventory-mapping-cleanup-20260918','source_mapping_id',v_source.id,'approval','user_requested'),
      v_source.created_by,v_source.updated_by)
    returning id into v_new;
    v_inserted := array_append(v_inserted,v_new);
    insert into public.inventory_channel_mapping_targets(
      mapping_id,menu_entity_type,menu_entity_id,menu_entity_name,quantity,display_order,created_by,updated_by)
    select v_new,menu_entity_type,menu_entity_id,menu_entity_name,quantity,display_order,created_by,updated_by
    from public.inventory_channel_mapping_targets where mapping_id=v_source.id;
    assert found, 'Source mapping has no target';
    assert private.inventory_resolve_channel_item_mapping('shopeefood',v_row.branch_id::uuid,v_row.external_id,v_row.item_name)=v_new,
      'Alias did not resolve uniquely';
  end loop;
  assert cardinality(v_inserted)=4, 'Unexpected alias count';
  select md5(jsonb_build_array(
    (select jsonb_agg(to_jsonb(m) order by m.id) from public.inventory_channel_mappings m where m.id<>all(v_inserted)),
    (select jsonb_agg(to_jsonb(t) order by t.id) from public.inventory_channel_mapping_targets t where t.mapping_id<>all(v_inserted))
  )::text) into v_after;
  assert v_before=v_after, 'Unrelated mapping rows changed';
  select md5(jsonb_build_array(
    (select jsonb_agg(to_jsonb(b) order by b.warehouse_id,b.item_id) from public.inventory_stock_balances b),
    (select jsonb_agg(to_jsonb(m) order by m.id) from public.inventory_stock_movements m),
    (select jsonb_agg(to_jsonb(d) order by d.id) from public.inventory_documents d),
    (select jsonb_agg(to_jsonb(e) order by e.id) from public.inventory_sales_order_events e)
  )::text) into v_stock_after;
  assert v_stock_before=v_stock_after, 'Stock or historical documents changed';
end;
$repair$;
commit;
