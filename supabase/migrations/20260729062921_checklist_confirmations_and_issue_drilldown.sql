begin;

create table if not exists public.checklist_inspection_confirmations (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.checklist_inspections(id) on delete cascade,
  participant_id uuid not null references public.checklist_inspection_participants(id) on delete cascade,
  confirmation_method text not null default 'confirmed' check (confirmation_method in ('confirmed', 'signature')),
  signature_object_path text,
  confirmed_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id),
  unique (inspection_id, participant_id),
  check ((confirmation_method = 'signature' and signature_object_path is not null) or confirmation_method = 'confirmed')
);

create index if not exists checklist_confirmations_inspection_idx
  on public.checklist_inspection_confirmations (inspection_id, confirmed_at);

alter table public.checklist_inspection_confirmations enable row level security;
grant select, insert, update, delete on public.checklist_inspection_confirmations to authenticated;

drop policy if exists checklist_confirmations_read on public.checklist_inspection_confirmations;
create policy checklist_confirmations_read on public.checklist_inspection_confirmations for select to authenticated
using (exists (
  select 1 from public.checklist_inspections inspection
  where inspection.id = inspection_id and (select private.checklist_can_access_branch(inspection.branch_uuid))
));
drop policy if exists checklist_confirmations_insert on public.checklist_inspection_confirmations;
create policy checklist_confirmations_insert on public.checklist_inspection_confirmations for insert to authenticated
with check (recorded_by = (select auth.uid()) and exists (
  select 1 from public.checklist_inspections inspection
  where inspection.id = inspection_id and inspection.status = 'draft'
    and (select private.checklist_can_access_branch(inspection.branch_uuid))
));
drop policy if exists checklist_confirmations_update on public.checklist_inspection_confirmations;
create policy checklist_confirmations_update on public.checklist_inspection_confirmations for update to authenticated
using (exists (
  select 1 from public.checklist_inspections inspection
  where inspection.id = inspection_id and inspection.status = 'draft'
    and (select private.checklist_can_access_branch(inspection.branch_uuid))
)) with check (recorded_by = (select auth.uid()));
drop policy if exists checklist_confirmations_delete on public.checklist_inspection_confirmations;
create policy checklist_confirmations_delete on public.checklist_inspection_confirmations for delete to authenticated
using (exists (
  select 1 from public.checklist_inspections inspection
  where inspection.id = inspection_id and inspection.status = 'draft'
    and (select private.checklist_can_access_branch(inspection.branch_uuid))
));

create or replace function public.save_checklist_inspection_confirmation(
  p_inspection_id uuid,
  p_participant_id uuid,
  p_confirmed boolean,
  p_method text default 'confirmed',
  p_signature_object_path text default null
)
returns public.checklist_inspection_confirmations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved_confirmation public.checklist_inspection_confirmations;
begin
  if not exists (
    select 1 from public.checklist_inspection_participants participant
    join public.checklist_inspections inspection on inspection.id = participant.inspection_id
    where participant.id = p_participant_id and participant.inspection_id = p_inspection_id
      and inspection.status = 'draft' and private.checklist_can_access_branch(inspection.branch_uuid)
  ) then raise exception 'Không thể xác nhận nhân viên cho biên bản này.'; end if;

  if not p_confirmed then
    delete from public.checklist_inspection_confirmations
    where inspection_id = p_inspection_id and participant_id = p_participant_id
    returning * into saved_confirmation;
    return saved_confirmation;
  end if;

  if p_method not in ('confirmed', 'signature') then raise exception 'Hình thức xác nhận không hợp lệ.'; end if;
  if p_method = 'signature' and nullif(btrim(coalesce(p_signature_object_path, '')), '') is null then
    raise exception 'Chưa có dữ liệu chữ ký.';
  end if;

  insert into public.checklist_inspection_confirmations (
    inspection_id, participant_id, confirmation_method, signature_object_path, confirmed_at, recorded_by
  ) values (
    p_inspection_id, p_participant_id, p_method,
    nullif(btrim(coalesce(p_signature_object_path, '')), ''), now(), auth.uid()
  )
  on conflict (inspection_id, participant_id) do update set
    confirmation_method = excluded.confirmation_method,
    signature_object_path = excluded.signature_object_path,
    confirmed_at = now(),
    recorded_by = auth.uid()
  returning * into saved_confirmation;
  return saved_confirmation;
end;
$$;

create or replace function public.submit_checklist_inspection_v2(
  p_inspection_id uuid,
  p_notes text default ''
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.checklist_inspection_participants participant
    where participant.inspection_id = p_inspection_id
      and not exists (
        select 1 from public.checklist_inspection_confirmations confirmation
        where confirmation.inspection_id = p_inspection_id and confirmation.participant_id = participant.id
      )
  ) then raise exception 'Vui lòng xác nhận đầy đủ nhân viên có mặt trước khi hoàn tất biên bản.'; end if;

  return public.submit_checklist_inspection(p_inspection_id, p_notes);
end;
$$;

create or replace function public.get_checklist_employee_issue_occurrences(
  p_employee_id uuid,
  p_item_code text,
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
  month_start date := date_trunc('month', coalesce(p_month, current_date))::date;
  month_end date := (date_trunc('month', coalesce(p_month, current_date)) + interval '1 month')::date;
  result jsonb;
begin
  if not private.checklist_is_admin() then raise exception 'Bạn không có quyền xem chi tiết lỗi nhân viên.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'answer_id', answer.id,
    'inspection_id', inspection.id,
    'inspection_code', inspection.inspection_code,
    'branch_name', inspection.branch_name_snapshot,
    'occurred_at', inspection.submitted_at,
    'result', answer.result,
    'note', answer.note,
    'penalty_points', link.final_penalty,
    'evidence_paths', coalesce((
      select jsonb_agg(evidence.object_path order by evidence.created_at)
      from public.checklist_evidence evidence where evidence.answer_id = answer.id
    ), '[]'::jsonb)
  ) order by inspection.submitted_at desc), '[]'::jsonb)
  into result
  from public.checklist_answer_employees link
  join public.checklist_inspection_participants participant on participant.id = link.participant_id
  join public.checklist_answers answer on answer.id = link.answer_id
  join public.checklist_inspections inspection on inspection.id = answer.inspection_id
  where participant.employee_id = p_employee_id
    and answer.item_code_snapshot = p_item_code
    and inspection.status = 'submitted'
    and inspection.submitted_at >= month_start::timestamptz
    and inspection.submitted_at < month_end::timestamptz
    and (p_branch_uuid is null or inspection.branch_uuid = p_branch_uuid);
  return result;
end;
$$;

revoke all on function public.save_checklist_inspection_confirmation(uuid, uuid, boolean, text, text) from public, anon;
revoke all on function public.submit_checklist_inspection_v2(uuid, text) from public, anon;
revoke all on function public.get_checklist_employee_issue_occurrences(uuid, text, date, uuid) from public, anon;
grant execute on function public.save_checklist_inspection_confirmation(uuid, uuid, boolean, text, text) to authenticated;
grant execute on function public.submit_checklist_inspection_v2(uuid, text) to authenticated;
grant execute on function public.get_checklist_employee_issue_occurrences(uuid, text, date, uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
