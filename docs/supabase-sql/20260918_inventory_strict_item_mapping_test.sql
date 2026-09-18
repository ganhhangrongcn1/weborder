-- Synthetic mappings exist only inside a rolled-back subtransaction.
-- Never call the sales processor or replay completed orders in this test.
do $test$
declare
  b uuid := gen_random_uuid(); other_b uuid := gen_random_uuid();
  actor uuid := gen_random_uuid(); a uuid; z uuid; by_id uuid; shared uuid;
  blocked boolean := false;
begin
  begin
    insert into public.inventory_channel_mappings(partner_source,branch_uuid,external_item_name,created_by,updated_by)
    values ('grabfood',b,'Kiểm thử Muối Tắc (Tự Trộn)',actor,actor) returning id into a;
    insert into public.inventory_channel_mappings(partner_source,branch_uuid,external_item_name,created_by,updated_by)
    values ('grabfood',b,'Kiểm thử Muối Tắc (Xé Và Trộn Sẵn)',actor,actor) returning id into z;
    assert private.inventory_resolve_channel_item_mapping('grabfood',b,'','Kiểm thử Muối Tắc (Tự Trộn)') = a, 'self mix';
    assert private.inventory_resolve_channel_item_mapping('grabfood',b,null,'  KIỂM THỬ  Muối Tắc (Xé Và Trộn Sẵn) ') = z, 'prepared full name';
    assert private.inventory_resolve_channel_item_mapping('grabfood',b,'','Kiểm thử Muối Tắc') is null, 'no suffix stripping';
    assert private.inventory_resolve_channel_item_mapping('grabfood',other_b,'','Kiểm thử Muối Tắc (Tự Trộn)') is null, 'branch isolation';
    assert private.inventory_resolve_channel_item_mapping('xanhngon',b,'','Kiểm thử Muối Tắc (Tự Trộn)') is null, 'channel isolation';
    insert into public.inventory_channel_mappings(partner_source,branch_uuid,external_item_id,external_item_name,created_by,updated_by)
    values ('grabfood',b,'exact-id','Kiểm thử tên cũ',actor,actor) returning id into by_id;
    assert private.inventory_resolve_channel_item_mapping('grabfood',b,'exact-id','Kiểm thử Muối Tắc (Tự Trộn)') = by_id, 'id precedes matching name';
    assert private.inventory_resolve_channel_item_mapping('grabfood',b,'other-id','Kiểm thử tên cũ') is null, 'different nonempty ids cannot match by name';
    assert private.inventory_resolve_channel_item_mapping('grabfood',b,'new-id','Kiểm thử Muối Tắc (Tự Trộn)') = a, 'legacy no-id mapping fallback';
    insert into public.inventory_channel_mappings(partner_source,branch_uuid,external_item_name,created_by,updated_by)
    values ('shopeefood',b,'Kiểm thử dùng chung',actor,actor) returning id into shared;
    assert private.inventory_resolve_channel_item_mapping('shopeefood',other_b,'','Kiểm thử dùng chung') = shared, 'preserve shared Shopee';
    -- Exact duplicates can be prevented by an index; whitespace variants still
    -- exercise multiple candidates with identical normalized full names.
    insert into public.inventory_channel_mappings(partner_source,branch_uuid,external_item_name,created_by,updated_by)
    values ('grabfood',b,'Kiểm thử  Muối Tắc (Tự Trộn)',actor,actor);
    begin
      perform private.inventory_resolve_channel_item_mapping('grabfood',b,'','Kiểm thử Muối Tắc (Tự Trộn)');
    exception when sqlstate 'P0001' then
      blocked := position('khớp nhiều' in sqlerrm) > 0;
    end;
    assert blocked, 'ambiguous mappings must block';
    raise exception using errcode = 'ZT001', message = 'rollback fixtures';
  exception when sqlstate 'ZT001' then null;
  end;
  assert not exists(select 1 from public.inventory_channel_mappings where branch_uuid in (b,other_b)), 'fixtures removed';
end;
$test$;
