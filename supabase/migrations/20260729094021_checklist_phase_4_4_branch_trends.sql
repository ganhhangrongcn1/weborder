begin;

create or replace function public.get_checklist_branch_trend_report(
  p_date_from date,
  p_date_to date,
  p_branch_uuid uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  period_days integer;
  previous_from date;
  previous_to date;
  result jsonb;
begin
  if not private.checklist_is_admin() then
    raise exception 'Bạn không có quyền xem báo cáo xu hướng chi nhánh.';
  end if;
  if p_date_from is null or p_date_to is null or p_date_from > p_date_to then
    raise exception 'Khoảng ngày báo cáo không hợp lệ.';
  end if;
  if p_date_to - p_date_from > 366 then
    raise exception 'Khoảng báo cáo tối đa là 12 tháng.';
  end if;

  period_days := p_date_to - p_date_from + 1;
  previous_to := p_date_from - 1;
  previous_from := previous_to - period_days + 1;

  with current_inspections as (
    select inspection.*
    from public.checklist_inspections inspection
    where inspection.status = 'submitted'
      and inspection.submitted_at >= p_date_from::timestamptz
      and inspection.submitted_at < (p_date_to + 1)::timestamptz
      and (p_branch_uuid is null or inspection.branch_uuid = p_branch_uuid)
  ),
  previous_inspections as (
    select inspection.*
    from public.checklist_inspections inspection
    where inspection.status = 'submitted'
      and inspection.submitted_at >= previous_from::timestamptz
      and inspection.submitted_at < (previous_to + 1)::timestamptz
      and (p_branch_uuid is null or inspection.branch_uuid = p_branch_uuid)
  ),
  current_issues as (
    select answer.*, inspection.branch_uuid, inspection.branch_name_snapshot,
      inspection.inspection_code, inspection.submitted_at
    from public.checklist_answers answer
    join current_inspections inspection on inspection.id = answer.inspection_id
    where answer.result in ('improve', 'fail')
  ),
  previous_issues as (
    select answer.id
    from public.checklist_answers answer
    join previous_inspections inspection on inspection.id = answer.inspection_id
    where answer.result in ('improve', 'fail')
  ),
  current_summary as (
    select
      count(*)::integer as inspection_count,
      round(coalesce(avg(score), 0), 2) as average_score,
      count(*) filter (where score < 75 or has_critical_failure)::integer as attention_count
    from current_inspections
  ),
  previous_summary as (
    select
      count(*)::integer as inspection_count,
      round(coalesce(avg(score), 0), 2) as average_score
    from previous_inspections
  ),
  trend_rows as (
    select date_trunc('week', inspection.submitted_at)::date as period_start,
      round(avg(inspection.score), 2) as average_score,
      count(*)::integer as inspection_count
    from current_inspections inspection
    group by date_trunc('week', inspection.submitted_at)
  ),
  branch_rows as (
    select inspection.branch_uuid,
      max(inspection.branch_name_snapshot) as branch_name,
      count(distinct inspection.id)::integer as inspection_count,
      round((select avg(scoped.score) from current_inspections scoped where scoped.branch_uuid = inspection.branch_uuid), 2) as average_score,
      round(
        avg(inspection.score) - coalesce((
          select avg(previous.score)
          from previous_inspections previous
          where previous.branch_uuid = inspection.branch_uuid
        ), avg(inspection.score)),
        2
      ) as score_change,
      count(issue.id)::integer as issue_count
    from current_inspections inspection
    left join current_issues issue on issue.inspection_id = inspection.id
    group by inspection.branch_uuid
  ),
  grouped_issues as (
    select issue.branch_uuid,
      max(issue.branch_name_snapshot) as branch_name,
      issue.item_code_snapshot as item_code,
      max(issue.content_snapshot) as content,
      count(*)::integer as occurrence_count,
      count(*) filter (where issue.result = 'fail')::integer as failed_count,
      max(issue.submitted_at) as latest_at
    from current_issues issue
    group by issue.branch_uuid, issue.item_code_snapshot
    having count(*) >= 2
  ),
  repeated_rows as (
    select grouped.*,
      (
        select coalesce(jsonb_agg(jsonb_build_object(
          'answer_id', issue.id,
          'inspection_id', issue.inspection_id,
          'inspection_code', issue.inspection_code,
          'occurred_at', issue.submitted_at,
          'result', issue.result,
          'note', issue.note,
          'evidence_paths', coalesce((
            select jsonb_agg(evidence.object_path order by evidence.created_at)
            from public.checklist_evidence evidence
            where evidence.answer_id = issue.id
          ), '[]'::jsonb)
        ) order by issue.submitted_at desc), '[]'::jsonb)
        from current_issues issue
        where issue.branch_uuid = grouped.branch_uuid
          and issue.item_code_snapshot = grouped.item_code
      ) as occurrences
    from grouped_issues grouped
  )
  select jsonb_build_object(
    'period', jsonb_build_object(
      'date_from', p_date_from,
      'date_to', p_date_to,
      'previous_from', previous_from,
      'previous_to', previous_to
    ),
    'summary', jsonb_build_object(
      'inspection_count', (select inspection_count from current_summary),
      'average_score', (select average_score from current_summary),
      'attention_count', (select attention_count from current_summary),
      'issue_count', (select count(*)::integer from current_issues),
      'repeated_issue_count', (select count(*)::integer from grouped_issues),
      'has_previous_data', (select inspection_count > 0 from previous_summary),
      'inspection_change', (select inspection_count from current_summary) - (select inspection_count from previous_summary),
      'score_change', case
        when (select inspection_count from previous_summary) = 0 then null
        else round((select average_score from current_summary) - (select average_score from previous_summary), 2)
      end,
      'issue_change', (select count(*)::integer from current_issues) - (select count(*)::integer from previous_issues)
    ),
    'trend', coalesce((
      select jsonb_agg(to_jsonb(trend_rows) order by trend_rows.period_start)
      from trend_rows
    ), '[]'::jsonb),
    'branches', coalesce((
      select jsonb_agg(to_jsonb(branch_rows) order by branch_rows.average_score asc)
      from branch_rows
    ), '[]'::jsonb),
    'repeated_issues', coalesce((
      select jsonb_agg(to_jsonb(repeated_rows) order by repeated_rows.occurrence_count desc, repeated_rows.latest_at desc)
      from (select * from repeated_rows order by occurrence_count desc, latest_at desc limit 20) repeated_rows
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_checklist_branch_trend_report(date, date, uuid) from public, anon;
grant execute on function public.get_checklist_branch_trend_report(date, date, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
