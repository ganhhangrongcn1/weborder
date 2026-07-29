-- GHR Checklist - Phase 3 inspection flow

begin;

grant usage on schema private to authenticated;

create or replace function public.start_checklist_inspection(
  p_branch_uuid uuid,
  p_employee_ids uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  target_branch public.branches;
  target_template public.checklist_templates;
  target_version public.checklist_template_versions;
  inspection_id uuid;
  employee_count integer;
  inspection_code text;
begin
  if not private.checklist_can_access_branch(p_branch_uuid) then
    raise exception 'Bạn không có quyền kiểm tra chi nhánh này.';
  end if;

  select branch.* into target_branch from public.branches branch where branch.branch_uuid = p_branch_uuid;
  if target_branch.branch_uuid is null then raise exception 'Không tìm thấy chi nhánh.'; end if;

  select template.* into target_template
  from public.checklist_templates template
  where template.is_active
  order by template.created_at
  limit 1;

  select version.* into target_version
  from public.checklist_template_versions version
  where version.template_id = target_template.id and version.status = 'published'
  order by version.version_number desc
  limit 1;

  if target_version.id is null then raise exception 'Chưa có checklist đã công bố.'; end if;

  select count(*) into employee_count
  from unnest(coalesce(p_employee_ids, array[]::uuid[])) selected(employee_id)
  where exists (
    select 1 from public.checklist_employee_branches assignment
    join public.checklist_employees employee on employee.id = assignment.employee_id
    where assignment.employee_id = selected.employee_id
      and assignment.branch_uuid = p_branch_uuid
      and assignment.is_active and employee.employment_status = 'active'
  );

  if employee_count <> cardinality(coalesce(p_employee_ids, array[]::uuid[])) then
    raise exception 'Danh sách nhân viên không hợp lệ với chi nhánh đã chọn.';
  end if;

  inspection_code := 'KT-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || upper(substr(gen_random_uuid()::text, 1, 4));
  insert into public.checklist_inspections (
    inspection_code, branch_uuid, branch_name_snapshot, template_version_id,
    status, scheduled_for, created_by
  ) values (
    inspection_code, p_branch_uuid, target_branch.name, target_version.id,
    'draft', current_date, auth.uid()
  ) returning id into inspection_id;

  insert into public.checklist_inspection_participants (
    inspection_id, employee_id, employee_code_snapshot, employee_name_snapshot,
    position_snapshot, branch_uuid_snapshot
  )
  select inspection_id, employee.id, employee.employee_code, employee.full_name,
         employee.position_name, p_branch_uuid
  from public.checklist_employees employee
  where employee.id = any(coalesce(p_employee_ids, array[]::uuid[]));

  return inspection_id;
end;
$$;

create or replace function public.save_checklist_answer(
  p_inspection_id uuid,
  p_item_id uuid,
  p_result text,
  p_note text default '',
  p_employee_ids uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  inspection_row public.checklist_inspections;
  item_row public.checklist_items;
  saved_answer_id uuid;
  penalty_base numeric(8,2);
begin
  if p_result not in ('pass', 'improve', 'fail', 'not_applicable') then raise exception 'Kết quả không hợp lệ.'; end if;

  select inspection.* into inspection_row
  from public.checklist_inspections inspection
  where inspection.id = p_inspection_id and inspection.status = 'draft';
  if inspection_row.id is null or not private.checklist_can_access_branch(inspection_row.branch_uuid) then
    raise exception 'Không tìm thấy biên bản nháp hoặc bạn không có quyền cập nhật.';
  end if;

  select item.* into item_row
  from public.checklist_items item
  where item.id = p_item_id and item.version_id = inspection_row.template_version_id and item.is_active;
  if item_row.id is null then raise exception 'Tiêu chí không thuộc checklist của biên bản.'; end if;

  insert into public.checklist_answers (
    inspection_id, item_id, item_code_snapshot, content_snapshot, weight_snapshot,
    is_critical_snapshot, result, responsibility_scope, earned_weight, note,
    answered_by, answered_at, updated_at
  ) values (
    p_inspection_id, p_item_id, item_row.item_code, item_row.content, item_row.weight,
    item_row.is_critical, p_result,
    case when cardinality(coalesce(p_employee_ids, array[]::uuid[])) > 0 then 'employees' else 'store' end,
    case p_result when 'pass' then item_row.weight when 'improve' then item_row.weight * 0.5 else 0 end,
    btrim(coalesce(p_note, '')), auth.uid(), now(), now()
  )
  on conflict (inspection_id, item_id) do update set
    result = excluded.result,
    responsibility_scope = excluded.responsibility_scope,
    earned_weight = excluded.earned_weight,
    note = excluded.note,
    answered_by = auth.uid(),
    answered_at = now(),
    updated_at = now()
  returning id into saved_answer_id;

  delete from public.checklist_answer_employees where checklist_answer_employees.answer_id = saved_answer_id;

  penalty_base := case item_row.default_penalty_level
    when 'reminder' then 1 when 'minor' then 2 when 'major' then 4
    when 'critical' then 7 when 'severe' then 10 else 2 end;

  if p_result in ('improve', 'fail') then
    insert into public.checklist_answer_employees (
      answer_id, participant_id, penalty_level, base_penalty,
      recurrence_multiplier, created_by
    )
    select saved_answer_id, participant.id, item_row.default_penalty_level,
           case when p_result = 'improve' then penalty_base * 0.5 else penalty_base end,
           1 + least(1.5, 0.25 * (
             select count(*) from public.checklist_answer_employees history_link
             join public.checklist_answers history_answer on history_answer.id = history_link.answer_id
             join public.checklist_inspections history_inspection on history_inspection.id = history_answer.inspection_id
             join public.checklist_inspection_participants history_participant on history_participant.id = history_link.participant_id
             where history_participant.employee_id = participant.employee_id
               and history_answer.item_id = p_item_id
               and history_inspection.status = 'submitted'
               and history_inspection.submitted_at >= now() - interval '30 days'
           )), auth.uid()
    from public.checklist_inspection_participants participant
    where participant.inspection_id = p_inspection_id
      and participant.employee_id = any(coalesce(p_employee_ids, array[]::uuid[]));
  end if;

  return saved_answer_id;
end;
$$;

create or replace function public.submit_checklist_inspection(
  p_inspection_id uuid,
  p_notes text default ''
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  inspection_row public.checklist_inspections;
  template_row public.checklist_templates;
  applicable_weight numeric(10,2);
  earned_weight numeric(10,2);
  final_score numeric(6,2);
  critical_failure boolean;
  final_rating text;
begin
  select inspection.* into inspection_row
  from public.checklist_inspections inspection
  where inspection.id = p_inspection_id and inspection.status = 'draft'
  for update;
  if inspection_row.id is null or not private.checklist_can_access_branch(inspection_row.branch_uuid) then
    raise exception 'Không tìm thấy biên bản nháp hoặc bạn không có quyền hoàn tất.';
  end if;

  if exists (
    select 1 from public.checklist_items item
    where item.version_id = inspection_row.template_version_id and item.is_active
      and not exists (select 1 from public.checklist_answers answer where answer.inspection_id = p_inspection_id and answer.item_id = item.id)
  ) then raise exception 'Vui lòng chấm đủ tất cả tiêu chí trước khi hoàn tất.'; end if;

  if exists (
    select 1 from public.checklist_answers answer
    join public.checklist_items item on item.id = answer.item_id
    where answer.inspection_id = p_inspection_id
      and (
        item.evidence_rule = 'always'
        or (item.evidence_rule = 'fail' and answer.result = 'fail')
        or (item.evidence_rule = 'improve_or_fail' and answer.result in ('improve', 'fail'))
      )
      and not exists (select 1 from public.checklist_evidence evidence where evidence.answer_id = answer.id)
  ) then raise exception 'Một số tiêu chí bắt buộc phải có ảnh bằng chứng.'; end if;

  select coalesce(sum(answer.weight_snapshot) filter (where answer.result <> 'not_applicable'), 0),
         coalesce(sum(answer.earned_weight) filter (where answer.result <> 'not_applicable'), 0),
         coalesce(bool_or(answer.is_critical_snapshot and answer.result = 'fail'), false)
  into applicable_weight, earned_weight, critical_failure
  from public.checklist_answers answer where answer.inspection_id = p_inspection_id;

  final_score := case when applicable_weight > 0 then round(earned_weight / applicable_weight * 100, 2) else 0 end;
  final_rating := case
    when critical_failure then 'Không đạt'
    when final_score >= 90 then 'Tốt'
    when final_score >= 80 then 'Đạt'
    when final_score >= 70 then 'Cần cải thiện'
    else 'Không đạt' end;

  select template.* into template_row
  from public.checklist_templates template
  join public.checklist_template_versions version on version.template_id = template.id
  where version.id = inspection_row.template_version_id;

  update public.checklist_inspections set
    status = 'submitted', submitted_at = now(), submitted_by = auth.uid(),
    next_inspection_due_on = current_date + template_row.inspection_interval_days,
    score = final_score, rating = final_rating,
    has_critical_failure = critical_failure, notes = btrim(coalesce(p_notes, '')),
    updated_at = now()
  where id = p_inspection_id;

  return jsonb_build_object('inspection_id', p_inspection_id, 'score', final_score, 'rating', final_rating, 'has_critical_failure', critical_failure);
end;
$$;

revoke all on function public.start_checklist_inspection(uuid, uuid[]) from public, anon;
revoke all on function public.save_checklist_answer(uuid, uuid, text, text, uuid[]) from public, anon;
revoke all on function public.submit_checklist_inspection(uuid, text) from public, anon;
grant execute on function public.start_checklist_inspection(uuid, uuid[]) to authenticated;
grant execute on function public.save_checklist_answer(uuid, uuid, text, text, uuid[]) to authenticated;
grant execute on function public.submit_checklist_inspection(uuid, text) to authenticated;

notify pgrst, 'reload schema';
commit;
