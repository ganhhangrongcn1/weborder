begin;

select set_config(
  'request.jwt.claims',
  (select json_build_object('sub', auth_user_id::text, 'role', 'authenticated')::text
   from public.profiles
   where lower(role) = 'admin' and lower(status) = 'active' and auth_user_id is not null
   limit 1),
  true
);

set local role authenticated;

do $$
declare
  draft_participant public.checklist_inspection_participants;
  occurrence_result jsonb;
begin
  select participant.* into draft_participant
  from public.checklist_inspection_participants participant
  join public.checklist_inspections inspection on inspection.id = participant.inspection_id
  where inspection.status = 'draft'
  limit 1;

  if draft_participant.id is not null then
    perform public.save_checklist_inspection_confirmation(
      draft_participant.inspection_id, draft_participant.id, true, 'confirmed', null
    );
    if not exists (
      select 1 from public.checklist_inspection_confirmations
      where inspection_id = draft_participant.inspection_id and participant_id = draft_participant.id
    ) then raise exception 'Không lưu được xác nhận nhân viên.'; end if;
    perform public.save_checklist_inspection_confirmation(
      draft_participant.inspection_id, draft_participant.id, false, 'confirmed', null
    );
  end if;

  select public.get_checklist_employee_issue_occurrences(
    employee.id,
    coalesce((select answer.item_code_snapshot from public.checklist_answers answer limit 1), 'TEST'),
    current_date,
    null
  ) into occurrence_result
  from public.checklist_employees employee
  limit 1;

  if occurrence_result is not null and jsonb_typeof(occurrence_result) <> 'array' then
    raise exception 'Kết quả drill-down lỗi không phải mảng JSON.';
  end if;
end;
$$;

rollback;
