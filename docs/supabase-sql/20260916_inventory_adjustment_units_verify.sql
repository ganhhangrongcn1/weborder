-- Run after the migration. All test writes are rolled back.
begin;
create temp table adjustment_unit_test (like public.inventory_document_lines including defaults including generated);
create trigger test_normalize before insert or update of item_id,unit_id,conversion_to_base,adjustment_direction
on adjustment_unit_test for each row execute function private.inventory_normalize_document_line_unit();
create temp table unit_test_results (checks integer);
do $$
declare i record; u uuid; dir text; factor numeric; r record; checks integer := 0; bad uuid; rejected boolean;
begin
  for i in select * from public.inventory_items where is_active and deleted_at is null loop
    foreach u in array array[i.base_unit_id,i.purchase_unit_id] loop
      if u is null then continue; end if;
      factor := case when u=i.base_unit_id then 1 else i.purchase_to_base_ratio end;
      foreach dir in array array['in','out'] loop
        insert into adjustment_unit_test(document_id,item_id,unit_id,conversion_to_base,actual_quantity,adjustment_direction)
        values(gen_random_uuid(),i.id,u,999999,1,dir) returning * into r;
        if r.unit_id<>u or r.conversion_to_base<>factor or r.actual_quantity<>1 then
          raise exception 'Incorrect insert: %',i.code;
        end if;
        update adjustment_unit_test set conversion_to_base=777777 where id=r.id returning * into r;
        if r.unit_id<>u or r.conversion_to_base<>factor then raise exception 'Incorrect update: %',i.code; end if;
        checks := checks+2;
      end loop;
    end loop;
    select id into bad from public.inventory_units where is_active and id<>i.base_unit_id and id is distinct from i.purchase_unit_id limit 1;
    if bad is not null then
      rejected := false;
      begin
        insert into adjustment_unit_test(document_id,item_id,unit_id,actual_quantity,adjustment_direction)
        values(gen_random_uuid(),i.id,bad,1,'in');
      exception when raise_exception then rejected := true;
      end;
      if not rejected then raise exception 'Invalid unit accepted: %',i.code; end if;
      checks := checks+1;
    end if;
  end loop;
  insert into unit_test_results values(checks);
end $$;
select checks as passed_checks from unit_test_results;
rollback;
