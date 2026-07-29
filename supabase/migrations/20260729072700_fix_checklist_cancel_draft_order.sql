-- Delete draft children while their parent is still visible to draft-protection triggers.
begin;

create or replace function public.cancel_checklist_template_draft(p_version_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  target_version public.checklist_template_versions;
begin
  if not private.checklist_is_admin() then
    raise exception 'Bạn không có quyền hủy bản nháp checklist.';
  end if;

  select version_row.*
  into target_version
  from public.checklist_template_versions as version_row
  where version_row.id = p_version_id
  for update;

  if target_version.id is null then
    raise exception 'Không tìm thấy bản nháp checklist.';
  end if;

  if target_version.status <> 'draft' then
    raise exception 'Chỉ được hủy phiên bản đang ở trạng thái bản nháp.';
  end if;

  if exists (
    select 1
    from public.checklist_inspections as inspection
    where inspection.template_version_id = target_version.id
  ) then
    raise exception 'Bản nháp đã được dùng trong biên bản nên không thể hủy.';
  end if;

  delete from public.checklist_items
  where version_id = target_version.id;

  delete from public.checklist_sections
  where version_id = target_version.id;

  delete from public.checklist_template_versions
  where id = target_version.id and status = 'draft';

  return target_version.id;
end;
$$;

revoke all on function public.cancel_checklist_template_draft(uuid) from public, anon;
grant execute on function public.cancel_checklist_template_draft(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
