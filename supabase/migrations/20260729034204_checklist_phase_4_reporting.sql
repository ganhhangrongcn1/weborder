-- GHR Checklist - Phase 4 reporting RPCs

begin;

create or replace function public.get_checklist_supervision_report(
  p_date_from date,
  p_date_to date,
  p_branch_uuid uuid default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.checklist_is_admin() then
    raise exception 'Bạn không có quyền xem báo cáo giám sát.';
  end if;

  if p_date_from is null or p_date_to is null or p_date_from > p_date_to then
    raise exception 'Khoảng ngày báo cáo không hợp lệ.';
  end if;

  with filtered_inspections as (
    select inspection.*
    from public.checklist_inspections inspection
    where inspection.status = 'submitted'
      and inspection.submitted_at >= p_date_from::timestamptz
      and inspection.submitted_at < (p_date_to + 1)::timestamptz
      and (p_branch_uuid is null or inspection.branch_uuid = p_branch_uuid)
  ),
  issue_counts as (
    select answer.inspection_id, count(*) filter (where answer.result in ('improve', 'fail')) as issue_count
    from public.checklist_answers answer
    join filtered_inspections inspection on inspection.id = answer.inspection_id
    group by answer.inspection_id
  ),
  latest_by_branch as (
    select distinct on (inspection.branch_uuid)
      inspection.branch_uuid, inspection.id, inspection.submitted_at,
      inspection.next_inspection_due_on, inspection.score, inspection.rating
    from public.checklist_inspections inspection
    where inspection.status = 'submitted'
    order by inspection.branch_uuid, inspection.submitted_at desc
  ),
  summary as (
    select count(*)::integer as inspection_count,
      round(coalesce(avg(score), 0), 2) as average_score,
      count(*) filter (where rating = 'Không đạt')::integer as failed_count,
      count(*) filter (where has_critical_failure)::integer as critical_count
    from filtered_inspections
  ),
  branch_rows as (
    select inspection.branch_uuid, max(inspection.branch_name_snapshot) as branch_name,
      count(*)::integer as inspection_count,
      round(avg(inspection.score), 2) as average_score,
      count(*) filter (where inspection.rating = 'Không đạt')::integer as failed_count,
      max(inspection.submitted_at) as last_inspected_at
    from filtered_inspections inspection
    group by inspection.branch_uuid
  ),
  history_rows as (
    select inspection.id, inspection.inspection_code, inspection.branch_uuid,
      inspection.branch_name_snapshot as branch_name, inspection.submitted_at,
      inspection.score, inspection.rating, inspection.has_critical_failure,
      coalesce(issue.issue_count, 0)::integer as issue_count,
      (select count(*)::integer from public.checklist_evidence evidence where evidence.inspection_id = inspection.id) as evidence_count,
      (select coalesce(jsonb_agg(participant.employee_name_snapshot order by participant.employee_name_snapshot), '[]'::jsonb)
       from public.checklist_inspection_participants participant where participant.inspection_id = inspection.id) as employees
    from filtered_inspections inspection
    left join issue_counts issue on issue.inspection_id = inspection.id
    order by inspection.submitted_at desc
    limit 100
  ),
  due_rows as (
    select branch.branch_uuid, branch.name as branch_name,
      latest.submitted_at as last_inspected_at, latest.score as last_score,
      latest.rating as last_rating, latest.next_inspection_due_on,
      case
        when latest.id is null then 'never_checked'
        when latest.next_inspection_due_on < current_date then 'overdue'
        when latest.next_inspection_due_on = current_date then 'due_today'
        else 'upcoming'
      end as due_status,
      case when latest.next_inspection_due_on is null then null else current_date - latest.next_inspection_due_on end as overdue_days
    from public.branches branch
    left join latest_by_branch latest on latest.branch_uuid = branch.branch_uuid
    where branch.branch_uuid is not null
      and (p_branch_uuid is null or branch.branch_uuid = p_branch_uuid)
    order by
      case when latest.id is null then 0 when latest.next_inspection_due_on < current_date then 1 when latest.next_inspection_due_on = current_date then 2 else 3 end,
      latest.next_inspection_due_on nulls first,
      branch.name
  )
  select jsonb_build_object(
    'summary', (select to_jsonb(summary) from summary),
    'branches', coalesce((select jsonb_agg(to_jsonb(branch_rows) order by branch_rows.average_score asc) from branch_rows), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(to_jsonb(history_rows) order by history_rows.submitted_at desc) from history_rows), '[]'::jsonb),
    'schedule', coalesce((select jsonb_agg(to_jsonb(due_rows)) from due_rows), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create or replace function public.get_checklist_employee_monthly_report(
  p_month date,
  p_branch_uuid uuid default null
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  month_start date;
  month_end date;
  result jsonb;
begin
  if not private.checklist_is_admin() then
    raise exception 'Bạn không có quyền xem báo cáo nhân sự.';
  end if;

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
      max(answer.item_code_snapshot) as item_code,
      max(answer.content_snapshot) as content,
      count(*)::integer as occurrence_count,
      round(sum(link.final_penalty), 2) as penalty_points,
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
      case when coalesce(appearance.appearance_count, 0) = 0 then null
        else greatest(0, round(100 - (coalesce(penalty.penalty_points, 0) / appearance.appearance_count) * 5, 2)) end as compliance_score,
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
    select count(*) filter (where appearance_count > 0)::integer as evaluated_count,
      round(coalesce(avg(compliance_score) filter (where compliance_score is not null), 0), 2) as average_score,
      coalesce(sum(violation_count), 0)::integer as violation_count,
      coalesce(sum(repeated_count), 0)::integer as repeated_count
    from employee_rows
  )
  select jsonb_build_object(
    'month_start', month_start,
    'month_end', month_end - 1,
    'summary', (select to_jsonb(summary) from summary),
    'employees', coalesce((select jsonb_agg(to_jsonb(employee_rows) order by employee_rows.compliance_score asc nulls last, employee_rows.full_name) from employee_rows), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_checklist_supervision_report(date, date, uuid) from public, anon;
revoke all on function public.get_checklist_employee_monthly_report(date, uuid) from public, anon;
grant execute on function public.get_checklist_supervision_report(date, date, uuid) to authenticated;
grant execute on function public.get_checklist_employee_monthly_report(date, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
