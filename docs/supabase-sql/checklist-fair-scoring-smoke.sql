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
  report jsonb;
  draft_answer public.checklist_answers;
  draft_participant public.checklist_inspection_participants;
  saved_confirmation public.checklist_inspection_confirmations;
begin
  report := public.get_checklist_employee_monthly_report(current_date, null);
  if report->>'minimum_appearances' <> '2' then
    raise exception 'Ngưỡng dữ liệu tối thiểu không đúng.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(report->'employees') employee
    where (employee->>'appearance_count')::integer < 2 and employee->'compliance_score' <> 'null'::jsonb
  ) then raise exception 'Nhân viên chưa đủ dữ liệu vẫn bị xếp điểm.'; end if;

  select answer.* into draft_answer
  from public.checklist_answers answer
  join public.checklist_inspections inspection on inspection.id = answer.inspection_id
  where inspection.status = 'draft' and answer.result in ('improve', 'fail')
  limit 1;

  if draft_answer.id is not null then
    perform public.save_checklist_answer_v2(
      draft_answer.inspection_id, draft_answer.item_id, draft_answer.result,
      draft_answer.note, 'shift', array[]::uuid[]
    );
    if (select responsibility_scope from public.checklist_answers where id = draft_answer.id) <> 'shift' then
      raise exception 'Không lưu được lỗi chung trong ca.';
    end if;
    if exists (select 1 from public.checklist_answer_employees where answer_id = draft_answer.id) then
      raise exception 'Lỗi chung trong ca vẫn bị gắn điểm nhân viên.';
    end if;
  end if;

  select participant.* into draft_participant
  from public.checklist_inspection_participants participant
  join public.checklist_inspections inspection on inspection.id = participant.inspection_id
  where inspection.status = 'draft'
  limit 1;

  if draft_participant.id is not null then
    saved_confirmation := public.save_checklist_inspection_confirmation_v2(
      draft_participant.inspection_id, draft_participant.id, true,
      'confirmed', null, 'Tôi đã đọc và có ý kiến kiểm thử.'
    );
    if saved_confirmation.employee_comment <> 'Tôi đã đọc và có ý kiến kiểm thử.' then
      raise exception 'Không lưu được ý kiến nhân viên.';
    end if;
  end if;
end;
$$;

rollback;
