begin;

alter table public.checklist_answers drop constraint if exists checklist_answers_responsibility_scope_check;
alter table public.checklist_answers add constraint checklist_answers_responsibility_scope_check
  check (responsibility_scope in ('store', 'shift', 'employees', 'unassigned', 'equipment'));

alter table public.checklist_inspection_confirmations
  add column if not exists employee_comment text not null default '';

create or replace function public.save_checklist_answer_v2(
  p_inspection_id uuid,
  p_item_id uuid,
  p_result text,
  p_note text default '',
  p_responsibility_scope text default 'store',
  p_employee_ids uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_answer_id uuid;
  selected_employee_ids uuid[];
begin
  if p_responsibility_scope not in ('store', 'shift', 'employees') then
    raise exception 'Phạm vi trách nhiệm không hợp lệ.';
  end if;
  if p_responsibility_scope = 'employees' and cardinality(coalesce(p_employee_ids, array[]::uuid[])) = 0 then
    raise exception 'Vui lòng chọn ít nhất một nhân viên chịu trách nhiệm.';
  end if;

  selected_employee_ids := case when p_responsibility_scope = 'employees' then coalesce(p_employee_ids, array[]::uuid[]) else array[]::uuid[] end;
  saved_answer_id := public.save_checklist_answer(
    p_inspection_id, p_item_id, p_result, p_note, selected_employee_ids
  );

  update public.checklist_answers
  set responsibility_scope = case when p_result in ('improve', 'fail') then p_responsibility_scope else 'store' end
  where id = saved_answer_id;

  update public.checklist_answer_employees link
  set base_penalty = (
      case link.penalty_level
        when 'reminder' then 0 when 'minor' then 1 when 'major' then 3
        when 'critical' then 7 when 'severe' then 10 else 1
      end
    ) * case when p_result = 'improve' then 0.5 else 1 end,
    recurrence_multiplier = 1 + least(1, 0.25 * (
      select count(*)
      from public.checklist_answer_employees history_link
      join public.checklist_answers history_answer on history_answer.id = history_link.answer_id
      join public.checklist_inspections history_inspection on history_inspection.id = history_answer.inspection_id
      join public.checklist_inspection_participants history_participant on history_participant.id = history_link.participant_id
      join public.checklist_inspection_participants current_participant on current_participant.id = link.participant_id
      where history_participant.employee_id = current_participant.employee_id
        and history_answer.item_id = p_item_id
        and history_inspection.status = 'submitted'
        and history_inspection.submitted_at >= now() - interval '30 days'
    ))
  where link.answer_id = saved_answer_id;

  return saved_answer_id;
end;
$$;

create or replace function public.save_checklist_inspection_confirmation_v2(
  p_inspection_id uuid,
  p_participant_id uuid,
  p_confirmed boolean,
  p_method text default 'confirmed',
  p_signature_object_path text default null,
  p_employee_comment text default ''
)
returns public.checklist_inspection_confirmations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_confirmation public.checklist_inspection_confirmations;
begin
  saved_confirmation := public.save_checklist_inspection_confirmation(
    p_inspection_id, p_participant_id, p_confirmed, p_method, p_signature_object_path
  );
  if p_confirmed and saved_confirmation.id is not null then
    update public.checklist_inspection_confirmations
    set employee_comment = btrim(coalesce(p_employee_comment, ''))
    where id = saved_confirmation.id
    returning * into saved_confirmation;
  end if;
  return saved_confirmation;
end;
$$;

with ranked_penalties as (
  select link.id,
    answer.result,
    link.penalty_level,
    least(4, row_number() over (
      partition by participant.employee_id, answer.item_id
      order by inspection.submitted_at, answer.id
    ) - 1) as previous_count
  from public.checklist_answer_employees link
  join public.checklist_answers answer on answer.id = link.answer_id
  join public.checklist_inspections inspection on inspection.id = answer.inspection_id
  join public.checklist_inspection_participants participant on participant.id = link.participant_id
  where inspection.status = 'submitted'
)
update public.checklist_answer_employees link
set base_penalty = (
    case ranked.penalty_level
      when 'reminder' then 0 when 'minor' then 1 when 'major' then 3
      when 'critical' then 7 when 'severe' then 10 else 1
    end
  ) * case when ranked.result = 'improve' then 0.5 else 1 end,
  recurrence_multiplier = 1 + least(1, 0.25 * ranked.previous_count)
from ranked_penalties ranked
where ranked.id = link.id;

create or replace function public.get_checklist_employee_monthly_report(
  p_month date,
  p_branch_uuid uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  month_start date;
  month_end date;
  result jsonb;
begin
  if not private.checklist_is_admin() then raise exception 'Bạn không có quyền xem báo cáo nhân sự.'; end if;
  month_start := date_trunc('month', coalesce(p_month, current_date))::date;
  month_end := (month_start + interval '1 month')::date;

  with employee_scope as (
    select employee.id, employee.employee_code, employee.full_name, employee.position_name,
      employee.employment_status,
      coalesce(jsonb_agg(distinct jsonb_build_object('branch_uuid', branch.branch_uuid, 'branch_name', branch.name))
        filter (where branch.branch_uuid is not null), '[]'::jsonb) as branches
    from public.checklist_employees employee
    left join public.checklist_employee_branches assignment on assignment.employee_id = employee.id and assignment.is_active
    left join public.branches branch on branch.branch_uuid = assignment.branch_uuid
    where (p_branch_uuid is null or assignment.branch_uuid = p_branch_uuid)
    group by employee.id
  ),
  appearances as (
    select participant.employee_id, count(distinct inspection.id)::integer as appearance_count
    from public.checklist_inspection_participants participant
    join public.checklist_inspections inspection on inspection.id = participant.inspection_id
    where inspection.status = 'submitted'
      and inspection.submitted_at >= month_start::timestamptz
      and inspection.submitted_at < month_end::timestamptz
      and (p_branch_uuid is null or inspection.branch_uuid = p_branch_uuid)
    group by participant.employee_id
  ),
  penalties as (
    select participant.employee_id,
      count(*)::integer as violation_count,
      round(coalesce(sum(link.final_penalty), 0), 2) as penalty_points,
      count(*) filter (where answer.result = 'fail')::integer as failed_count,
      count(*) filter (where answer.result = 'improve')::integer as improve_count
    from public.checklist_answer_employees link
    join public.checklist_inspection_participants participant on participant.id = link.participant_id
    join public.checklist_answers answer on answer.id = link.answer_id
    join public.checklist_inspections inspection on inspection.id = answer.inspection_id
    where inspection.status = 'submitted'
      and inspection.submitted_at >= month_start::timestamptz
      and inspection.submitted_at < month_end::timestamptz
      and (p_branch_uuid is null or inspection.branch_uuid = p_branch_uuid)
    group by participant.employee_id
  ),
  issue_groups as (
    select participant.employee_id, answer.item_id,
      max(answer.item_code_snapshot) as item_code, max(answer.content_snapshot) as content,
      count(*)::integer as occurrence_count, round(sum(link.final_penalty), 2) as penalty_points,
      max(inspection.submitted_at) as latest_at
    from public.checklist_answer_employees link
    join public.checklist_inspection_participants participant on participant.id = link.participant_id
    join public.checklist_answers answer on answer.id = link.answer_id
    join public.checklist_inspections inspection on inspection.id = answer.inspection_id
    where inspection.status = 'submitted'
      and inspection.submitted_at >= month_start::timestamptz
      and inspection.submitted_at < month_end::timestamptz
      and (p_branch_uuid is null or inspection.branch_uuid = p_branch_uuid)
    group by participant.employee_id, answer.item_id
  ),
  employee_rows as (
    select scope.*,
      coalesce(appearance.appearance_count, 0)::integer as appearance_count,
      coalesce(penalty.violation_count, 0)::integer as violation_count,
      coalesce(penalty.failed_count, 0)::integer as failed_count,
      coalesce(penalty.improve_count, 0)::integer as improve_count,
      coalesce(penalty.penalty_points, 0) as penalty_points,
      case when coalesce(appearance.appearance_count, 0) < 2 then null
        else greatest(0, round(100 - (coalesce(penalty.penalty_points, 0) / appearance.appearance_count) * 5, 2)) end as compliance_score,
      case when coalesce(appearance.appearance_count, 0) = 0 then 'no_data'
        when appearance.appearance_count < 2 then 'insufficient'
        else 'qualified' end as data_status,
      case when coalesce(appearance.appearance_count, 0) < 2 then 'Chưa đủ dữ liệu'
        when coalesce(penalty.violation_count, 0) = 0 then 'Không ghi nhận vi phạm'
        else 'Có vi phạm cá nhân' end as standing_label,
      coalesce((select sum(greatest(issue.occurrence_count - 1, 0))::integer from issue_groups issue where issue.employee_id = scope.id), 0) as repeated_count,
      coalesce((select jsonb_agg(to_jsonb(top_issue) order by top_issue.occurrence_count desc, top_issue.penalty_points desc)
        from (select issue.item_code, issue.content, issue.occurrence_count, issue.penalty_points, issue.latest_at
          from issue_groups issue where issue.employee_id = scope.id
          order by issue.occurrence_count desc, issue.penalty_points desc limit 5) top_issue), '[]'::jsonb) as top_issues
    from employee_scope scope
    left join appearances appearance on appearance.employee_id = scope.id
    left join penalties penalty on penalty.employee_id = scope.id
  ),
  summary as (
    select count(*) filter (where appearance_count > 0)::integer as observed_count,
      count(*) filter (where data_status = 'qualified')::integer as evaluated_count,
      round(coalesce(avg(compliance_score) filter (where data_status = 'qualified'), 0), 2) as average_score,
      coalesce(sum(violation_count), 0)::integer as violation_count,
      coalesce(sum(repeated_count), 0)::integer as repeated_count,
      count(*) filter (where data_status = 'qualified' and violation_count = 0)::integer as no_violation_count
    from employee_rows
  )
  select jsonb_build_object(
    'month_start', month_start, 'month_end', month_end - 1,
    'minimum_appearances', 2,
    'summary', (select to_jsonb(summary) from summary),
    'employees', coalesce((select jsonb_agg(to_jsonb(employee_rows) order by employee_rows.compliance_score asc nulls last, employee_rows.full_name) from employee_rows), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.save_checklist_answer_v2(uuid, uuid, text, text, text, uuid[]) from public, anon;
revoke all on function public.save_checklist_inspection_confirmation_v2(uuid, uuid, boolean, text, text, text) from public, anon;
grant execute on function public.save_checklist_answer_v2(uuid, uuid, text, text, text, uuid[]) to authenticated;
grant execute on function public.save_checklist_inspection_confirmation_v2(uuid, uuid, boolean, text, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
