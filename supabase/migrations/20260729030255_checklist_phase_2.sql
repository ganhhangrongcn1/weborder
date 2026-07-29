-- GHR Checklist - Phase 2 admin management
-- Atomic employee assignment and immutable checklist version workflow.

begin;

create or replace function private.checklist_require_draft_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_version_id uuid;
  target_status text;
begin
  target_version_id := case when tg_op = 'DELETE' then old.version_id else new.version_id end;

  select version_row.status
  into target_status
  from public.checklist_template_versions as version_row
  where version_row.id = target_version_id;

  if target_status is distinct from 'draft' then
    raise exception 'Chỉ được thay đổi nội dung của phiên bản checklist đang ở trạng thái bản nháp.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists checklist_sections_require_draft on public.checklist_sections;
create trigger checklist_sections_require_draft
before insert or update or delete on public.checklist_sections
for each row execute function private.checklist_require_draft_version();

drop trigger if exists checklist_items_require_draft on public.checklist_items;
create trigger checklist_items_require_draft
before insert or update or delete on public.checklist_items
for each row execute function private.checklist_require_draft_version();

create or replace function public.save_checklist_employee(
  p_employee_id uuid default null,
  p_employee_code text default '',
  p_full_name text default '',
  p_phone text default null,
  p_position_name text default 'Nhân viên',
  p_employment_status text default 'active',
  p_started_on date default null,
  p_branch_uuids uuid[] default array[]::uuid[]
)
returns public.checklist_employees
language plpgsql
set search_path = ''
as $$
declare
  saved_employee public.checklist_employees;
  normalized_branches uuid[];
begin
  if not private.checklist_is_admin() then
    raise exception 'Bạn không có quyền quản lý nhân sự.';
  end if;

  if btrim(coalesce(p_employee_code, '')) = '' or btrim(coalesce(p_full_name, '')) = '' then
    raise exception 'Mã nhân viên và họ tên là bắt buộc.';
  end if;

  if p_employment_status not in ('active', 'inactive', 'left') then
    raise exception 'Trạng thái nhân viên không hợp lệ.';
  end if;

  select coalesce(array_agg(branch_uuid order by first_position), array[]::uuid[])
  into normalized_branches
  from (
    select branch_uuid, min(position) as first_position
    from unnest(coalesce(p_branch_uuids, array[]::uuid[])) with ordinality as selected(branch_uuid, position)
    where branch_uuid is not null
    group by branch_uuid
  ) as unique_branches;

  if exists (
    select 1
    from unnest(normalized_branches) as selected(branch_uuid)
    where not exists (
      select 1 from public.branches as branch where branch.branch_uuid = selected.branch_uuid
    )
  ) then
    raise exception 'Có chi nhánh không tồn tại trong hệ thống.';
  end if;

  if p_employee_id is null then
    insert into public.checklist_employees (
      employee_code, full_name, phone, position_name, employment_status,
      started_on, created_by, updated_by
    ) values (
      upper(btrim(p_employee_code)), btrim(p_full_name), nullif(btrim(coalesce(p_phone, '')), ''),
      coalesce(nullif(btrim(p_position_name), ''), 'Nhân viên'), p_employment_status,
      p_started_on, auth.uid(), auth.uid()
    ) returning * into saved_employee;
  else
    update public.checklist_employees
    set employee_code = upper(btrim(p_employee_code)),
        full_name = btrim(p_full_name),
        phone = nullif(btrim(coalesce(p_phone, '')), ''),
        position_name = coalesce(nullif(btrim(p_position_name), ''), 'Nhân viên'),
        employment_status = p_employment_status,
        started_on = p_started_on,
        updated_at = now(),
        updated_by = auth.uid()
    where id = p_employee_id
    returning * into saved_employee;

    if saved_employee.id is null then
      raise exception 'Không tìm thấy nhân viên cần cập nhật.';
    end if;
  end if;

  delete from public.checklist_employee_branches where employee_id = saved_employee.id;

  insert into public.checklist_employee_branches (
    employee_id, branch_uuid, is_primary, is_active, created_by
  )
  select saved_employee.id, selected.branch_uuid, selected.position = 1, true, auth.uid()
  from unnest(normalized_branches) with ordinality as selected(branch_uuid, position);

  return saved_employee;
end;
$$;

create or replace function public.create_checklist_template_draft(p_template_id uuid)
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
    raise exception 'Bạn không có quyền chỉnh sửa checklist.';
  end if;

  select version_row.* into source_version
  from public.checklist_template_versions as version_row
  where version_row.template_id = p_template_id and version_row.status = 'published'
  order by version_row.version_number desc
  limit 1;

  if source_version.id is null then
    raise exception 'Chưa có phiên bản checklist đã công bố để tạo bản nháp.';
  end if;

  select version_row.id into draft_version_id
  from public.checklist_template_versions as version_row
  where version_row.template_id = p_template_id and version_row.status = 'draft'
  order by version_row.version_number desc
  limit 1;

  if draft_version_id is not null then
    return draft_version_id;
  end if;

  select coalesce(max(version_number), 0) + 1 into next_version_number
  from public.checklist_template_versions
  where template_id = p_template_id;

  insert into public.checklist_template_versions (
    template_id, version_number, status, total_weight,
    employee_score_multiplier, recurrence_window_days, created_by
  ) values (
    p_template_id, next_version_number, 'draft', source_version.total_weight,
    source_version.employee_score_multiplier, source_version.recurrence_window_days, auth.uid()
  ) returning id into draft_version_id;

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

create or replace function public.publish_checklist_template_version(p_version_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  target_version public.checklist_template_versions;
  active_weight numeric(10,2);
begin
  if not private.checklist_is_admin() then
    raise exception 'Bạn không có quyền công bố checklist.';
  end if;

  select version_row.* into target_version
  from public.checklist_template_versions as version_row
  where version_row.id = p_version_id
  for update;

  if target_version.id is null or target_version.status <> 'draft' then
    raise exception 'Chỉ có thể công bố phiên bản checklist đang ở trạng thái bản nháp.';
  end if;

  if exists (
    select 1
    from public.checklist_sections as section_row
    where section_row.version_id = p_version_id
      and section_row.is_active
      and not exists (
        select 1 from public.checklist_items as item_row
        where item_row.section_id = section_row.id and item_row.is_active
      )
  ) then
    raise exception 'Mỗi nhóm đang hoạt động phải có ít nhất một tiêu chí.';
  end if;

  select coalesce(sum(weight), 0) into active_weight
  from public.checklist_items
  where version_id = p_version_id and is_active;

  if active_weight <> target_version.total_weight then
    raise exception 'Tổng trọng số tiêu chí phải bằng %.', target_version.total_weight;
  end if;

  update public.checklist_template_versions
  set status = 'archived'
  where template_id = target_version.template_id and status = 'published';

  update public.checklist_template_versions
  set status = 'published', published_at = now(), published_by = auth.uid()
  where id = p_version_id;

  return p_version_id;
end;
$$;

revoke all on function public.save_checklist_employee(uuid, text, text, text, text, text, date, uuid[]) from public, anon;
revoke all on function public.create_checklist_template_draft(uuid) from public, anon;
revoke all on function public.publish_checklist_template_version(uuid) from public, anon;
grant execute on function public.save_checklist_employee(uuid, text, text, text, text, text, date, uuid[]) to authenticated;
grant execute on function public.create_checklist_template_draft(uuid) to authenticated;
grant execute on function public.publish_checklist_template_version(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
