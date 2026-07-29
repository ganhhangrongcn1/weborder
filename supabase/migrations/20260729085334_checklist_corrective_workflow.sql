begin;

create unique index if not exists checklist_corrective_actions_answer_unique
  on public.checklist_corrective_actions(answer_id)
  where answer_id is not null;

create or replace function public.create_checklist_corrective_actions_on_submit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'submitted' and old.status is distinct from 'submitted' then
    insert into public.checklist_corrective_actions (
      inspection_id,
      answer_id,
      assigned_employee_id,
      title,
      status,
      due_on,
      created_by,
      updated_by
    )
    select
      answer.inspection_id,
      answer.id,
      case when responsible.employee_count = 1 then responsible.employee_id else null end,
      answer.item_code_snapshot || ' - ' || answer.content_snapshot,
      'open',
      current_date + case when answer.result = 'fail' then 1 else 3 end,
      coalesce(new.submitted_by, new.created_by, auth.uid()),
      auth.uid()
    from public.checklist_answers answer
    left join lateral (
      select count(distinct participant.employee_id) as employee_count,
             min(participant.employee_id::text)::uuid as employee_id
      from public.checklist_answer_employees answer_employee
      join public.checklist_inspection_participants participant
        on participant.id = answer_employee.participant_id
      where answer_employee.answer_id = answer.id
        and participant.employee_id is not null
    ) responsible on true
    where answer.inspection_id = new.id
      and answer.result in ('improve', 'fail')
    on conflict (answer_id) where answer_id is not null do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists checklist_create_corrective_actions_on_submit on public.checklist_inspections;
create trigger checklist_create_corrective_actions_on_submit
after update of status on public.checklist_inspections
for each row execute function public.create_checklist_corrective_actions_on_submit();

insert into public.checklist_corrective_actions (
  inspection_id, answer_id, assigned_employee_id, title, status, due_on, created_by, updated_by
)
select
  answer.inspection_id,
  answer.id,
  case when responsible.employee_count = 1 then responsible.employee_id else null end,
  answer.item_code_snapshot || ' - ' || answer.content_snapshot,
  'open',
  current_date + case when answer.result = 'fail' then 1 else 3 end,
  inspection.submitted_by,
  inspection.submitted_by
from public.checklist_answers answer
join public.checklist_inspections inspection on inspection.id = answer.inspection_id and inspection.status = 'submitted'
left join lateral (
  select count(distinct participant.employee_id) as employee_count,
         min(participant.employee_id::text)::uuid as employee_id
  from public.checklist_answer_employees answer_employee
  join public.checklist_inspection_participants participant on participant.id = answer_employee.participant_id
  where answer_employee.answer_id = answer.id and participant.employee_id is not null
) responsible on true
where answer.result in ('improve', 'fail')
on conflict (answer_id) where answer_id is not null do nothing;

grant select, insert, update on public.checklist_corrective_actions to authenticated;
grant all on public.checklist_corrective_actions to service_role;

notify pgrst, 'reload schema';
commit;
