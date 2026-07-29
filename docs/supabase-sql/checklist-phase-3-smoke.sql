-- Smoke test có rollback cho luồng tạo biên bản và lưu một câu trả lời.

begin;

select set_config(
  'request.jwt.claim.sub',
  (select auth_user_id::text from public.profiles where lower(role) = 'admin' and lower(status) = 'active' and auth_user_id is not null limit 1),
  true
);

select set_config(
  'request.jwt.claims',
  (select json_build_object('sub', auth_user_id::text, 'role', 'authenticated')::text from public.profiles where lower(role) = 'admin' and lower(status) = 'active' and auth_user_id is not null limit 1),
  true
);

set local role authenticated;

do $$
declare
  test_branch_uuid uuid;
  test_inspection_id uuid;
  test_item_id uuid;
  test_answer_id uuid;
  test_result jsonb;
  test_item record;
begin
  if auth.uid() is null then
    raise exception 'Smoke test không thiết lập được auth.uid().';
  end if;
  select branch_uuid into test_branch_uuid from public.branches where branch_uuid is not null order by name limit 1;
  test_inspection_id := public.start_checklist_inspection(test_branch_uuid, array[]::uuid[]);

  for test_item in
    select item.id, item.evidence_rule
    from public.checklist_items item
    join public.checklist_inspections inspection on inspection.template_version_id = item.version_id
    where inspection.id = test_inspection_id and item.is_active
    order by item.display_order
  loop
    test_answer_id := public.save_checklist_answer(
      test_inspection_id, test_item.id, 'pass', 'Phase 3 smoke test', array[]::uuid[]
    );

    if test_item.evidence_rule = 'always' then
      insert into public.checklist_evidence (
        inspection_id, answer_id, object_path, mime_type, file_size_bytes, created_by
      ) values (
        test_inspection_id, test_answer_id,
        'smoke/' || test_inspection_id::text || '/' || test_answer_id::text || '.jpg',
        'image/jpeg', 1, auth.uid()
      );
    end if;
  end loop;

  test_result := public.submit_checklist_inspection(test_inspection_id, 'Phase 3 smoke test');
  if (test_result ->> 'score')::numeric <> 100 then
    raise exception 'Smoke test tính điểm không đúng: %', test_result;
  end if;
end;
$$;

rollback;
