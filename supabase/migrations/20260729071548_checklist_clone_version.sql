-- Create a new editable checklist draft from any historical version.
begin;

create or replace function public.clone_checklist_template_version(p_source_version_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  source_version public.checklist_template_versions;
  draft_version_id uuid;
  next_version_number integer;
begin
  if not private.checklist_is_admin() then
    raise exception 'Bạn không có quyền sao chép phiên bản checklist.';
  end if;

  select version_row.*
  into source_version
  from public.checklist_template_versions as version_row
  where version_row.id = p_source_version_id;

  if source_version.id is null then
    raise exception 'Không tìm thấy phiên bản checklist cần sao chép.';
  end if;

  if exists (
    select 1
    from public.checklist_template_versions as version_row
    where version_row.template_id = source_version.template_id
      and version_row.status = 'draft'
  ) then
    raise exception 'Checklist đang có một bản nháp. Hãy công bố hoặc xử lý bản nháp trước khi sao chép phiên bản khác.';
  end if;

  select coalesce(max(version_number), 0) + 1
  into next_version_number
  from public.checklist_template_versions
  where template_id = source_version.template_id;

  insert into public.checklist_template_versions (
    template_id, version_number, status, total_weight,
    employee_score_multiplier, recurrence_window_days, created_by
  ) values (
    source_version.template_id, next_version_number, 'draft', source_version.total_weight,
    source_version.employee_score_multiplier, source_version.recurrence_window_days, auth.uid()
  )
  returning id into draft_version_id;

  insert into public.checklist_sections (
    id, version_id, section_code, name, weight, display_order, is_active
  )
  select gen_random_uuid(), draft_version_id, section_code, name, weight, display_order, is_active
  from public.checklist_sections
  where version_id = source_version.id;

  insert into public.checklist_items (
    version_id, section_id, item_code, content, guidance, weight, is_critical,
    evidence_rule, default_penalty_level, display_order, is_active
  )
  select draft_version_id, target_section.id, source_item.item_code, source_item.content,
         source_item.guidance, source_item.weight, source_item.is_critical,
         source_item.evidence_rule, source_item.default_penalty_level,
         source_item.display_order, source_item.is_active
  from public.checklist_items as source_item
  join public.checklist_sections as source_section on source_section.id = source_item.section_id
  join public.checklist_sections as target_section
    on target_section.version_id = draft_version_id
   and target_section.section_code = source_section.section_code
  where source_item.version_id = source_version.id;

  return draft_version_id;
end;
$$;

revoke all on function public.clone_checklist_template_version(uuid) from public, anon;
grant execute on function public.clone_checklist_template_version(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
