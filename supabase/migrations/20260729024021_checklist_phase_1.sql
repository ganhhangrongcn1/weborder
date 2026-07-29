-- GHR Checklist - Phase 1 foundation
-- Generated with Supabase CLI. Apply once through the migration workflow.

begin;

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.checklist_user_access (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  branch_uuid uuid references public.branches(branch_uuid) on update cascade on delete restrict,
  role text not null check (role in ('admin', 'supervisor', 'hr', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (auth_user_id, branch_uuid, role)
);

create table if not exists public.checklist_employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique check (btrim(employee_code) <> ''),
  full_name text not null check (btrim(full_name) <> ''),
  phone text,
  position_name text not null default 'Nhân viên',
  employment_status text not null default 'active'
    check (employment_status in ('active', 'inactive', 'left')),
  started_on date,
  auth_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.checklist_employee_branches (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.checklist_employees(id) on delete cascade,
  branch_uuid uuid not null references public.branches(branch_uuid) on update cascade on delete restrict,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  assigned_from date not null default current_date,
  assigned_until date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (employee_id, branch_uuid),
  check (assigned_until is null or assigned_until >= assigned_from)
);

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  template_code text not null unique check (btrim(template_code) <> ''),
  name text not null check (btrim(name) <> ''),
  description text not null default '',
  inspection_interval_days smallint not null default 2 check (inspection_interval_days between 1 and 365),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.checklist_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  total_weight numeric(10,2) not null default 100 check (total_weight > 0),
  employee_score_multiplier numeric(8,2) not null default 5 check (employee_score_multiplier >= 0),
  recurrence_window_days smallint not null default 30 check (recurrence_window_days between 1 and 365),
  published_at timestamptz,
  published_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (template_id, version_number),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create table if not exists public.checklist_sections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.checklist_template_versions(id) on delete cascade,
  section_code text not null,
  name text not null,
  weight numeric(10,2) not null check (weight > 0),
  display_order smallint not null default 0,
  is_active boolean not null default true,
  unique (version_id, section_code)
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.checklist_template_versions(id) on delete cascade,
  section_id uuid not null references public.checklist_sections(id) on delete cascade,
  item_code text not null,
  content text not null check (btrim(content) <> ''),
  guidance text not null default '',
  weight numeric(10,2) not null check (weight > 0),
  is_critical boolean not null default false,
  evidence_rule text not null default 'fail' check (evidence_rule in ('never', 'fail', 'improve_or_fail', 'always')),
  default_penalty_level text not null default 'minor'
    check (default_penalty_level in ('reminder', 'minor', 'major', 'critical', 'severe')),
  display_order smallint not null default 0,
  is_active boolean not null default true,
  unique (version_id, item_code)
);

create table if not exists public.checklist_inspections (
  id uuid primary key default gen_random_uuid(),
  inspection_code text not null unique,
  branch_uuid uuid not null references public.branches(branch_uuid) on update cascade on delete restrict,
  branch_name_snapshot text not null,
  template_version_id uuid not null references public.checklist_template_versions(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'cancelled')),
  scheduled_for date,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  next_inspection_due_on date,
  score numeric(6,2) check (score is null or score between 0 and 100),
  rating text,
  has_critical_failure boolean not null default false,
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  submitted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'submitted' and submitted_at is not null and score is not null) or status <> 'submitted')
);

create table if not exists public.checklist_inspection_participants (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.checklist_inspections(id) on delete cascade,
  employee_id uuid not null references public.checklist_employees(id) on delete restrict,
  employee_code_snapshot text not null,
  employee_name_snapshot text not null,
  position_snapshot text not null default '',
  branch_uuid_snapshot uuid not null,
  created_at timestamptz not null default now(),
  unique (inspection_id, employee_id)
);

create table if not exists public.checklist_answers (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.checklist_inspections(id) on delete cascade,
  item_id uuid not null references public.checklist_items(id) on delete restrict,
  item_code_snapshot text not null,
  content_snapshot text not null,
  weight_snapshot numeric(10,2) not null check (weight_snapshot > 0),
  is_critical_snapshot boolean not null default false,
  result text not null check (result in ('pass', 'improve', 'fail', 'not_applicable')),
  responsibility_scope text not null default 'store'
    check (responsibility_scope in ('store', 'employees', 'unassigned', 'equipment')),
  earned_weight numeric(10,2) not null default 0 check (earned_weight >= 0),
  note text not null default '',
  answered_at timestamptz not null default now(),
  answered_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (inspection_id, item_id)
);

create table if not exists public.checklist_answer_employees (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.checklist_answers(id) on delete cascade,
  participant_id uuid not null references public.checklist_inspection_participants(id) on delete restrict,
  penalty_level text not null check (penalty_level in ('reminder', 'minor', 'major', 'critical', 'severe')),
  base_penalty numeric(8,2) not null check (base_penalty >= 0),
  recurrence_multiplier numeric(5,2) not null default 1 check (recurrence_multiplier >= 1),
  final_penalty numeric(8,2) generated always as (base_penalty * recurrence_multiplier) stored,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (answer_id, participant_id)
);

create table if not exists public.checklist_evidence (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.checklist_inspections(id) on delete cascade,
  answer_id uuid references public.checklist_answers(id) on delete cascade,
  object_path text not null unique,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 6291456),
  caption text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

create table if not exists public.checklist_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.checklist_inspections(id) on delete cascade,
  answer_id uuid references public.checklist_answers(id) on delete set null,
  assigned_employee_id uuid references public.checklist_employees(id) on delete set null,
  title text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'verified', 'cancelled')),
  due_on date,
  resolved_at timestamptz,
  resolution_note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.checklist_audit_logs (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  actor_auth_user_id uuid references auth.users(id),
  branch_uuid uuid,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists checklist_user_access_auth_idx on public.checklist_user_access (auth_user_id, is_active);
create index if not exists checklist_employee_branches_branch_idx on public.checklist_employee_branches (branch_uuid, is_active, employee_id);
create index if not exists checklist_employees_status_name_idx on public.checklist_employees (employment_status, full_name);
create index if not exists checklist_inspections_branch_date_idx on public.checklist_inspections (branch_uuid, started_at desc);
create index if not exists checklist_inspections_status_due_idx on public.checklist_inspections (status, next_inspection_due_on);
create index if not exists checklist_participants_employee_idx on public.checklist_inspection_participants (employee_id, inspection_id);
create index if not exists checklist_answers_inspection_result_idx on public.checklist_answers (inspection_id, result);
create index if not exists checklist_answer_employees_participant_idx on public.checklist_answer_employees (participant_id, created_at desc);
create index if not exists checklist_corrective_status_due_idx on public.checklist_corrective_actions (status, due_on);
create index if not exists checklist_audit_entity_idx on public.checklist_audit_logs (entity_type, entity_id, created_at desc);

create or replace function private.checklist_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_user_id = (select auth.uid())
      and lower(coalesce(p.status, '')) = 'active'
      and lower(coalesce(p.role, '')) = 'admin'
  );
$$;

create or replace function private.checklist_can_use_app()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.checklist_is_admin()) or exists (
    select 1 from public.checklist_user_access a
    where a.auth_user_id = (select auth.uid()) and a.is_active
  );
$$;

create or replace function private.checklist_can_access_branch(target_branch_uuid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select private.checklist_is_admin()) or exists (
    select 1 from public.checklist_user_access a
    where a.auth_user_id = (select auth.uid())
      and a.is_active
      and (a.branch_uuid is null or a.branch_uuid = target_branch_uuid)
  );
$$;

revoke all on function private.checklist_is_admin() from public;
revoke all on function private.checklist_can_use_app() from public;
revoke all on function private.checklist_can_access_branch(uuid) from public;
grant execute on function private.checklist_is_admin() to authenticated;
grant execute on function private.checklist_can_use_app() to authenticated;
grant execute on function private.checklist_can_access_branch(uuid) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'checklist_user_access','checklist_employees','checklist_employee_branches','checklist_templates',
    'checklist_template_versions','checklist_sections','checklist_items','checklist_inspections',
    'checklist_inspection_participants','checklist_answers','checklist_answer_employees','checklist_evidence',
    'checklist_corrective_actions','checklist_audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
  end loop;
end $$;

grant usage, select on sequence public.checklist_audit_logs_id_seq to authenticated;

create policy checklist_access_admin_all on public.checklist_user_access for all to authenticated
using ((select private.checklist_is_admin())) with check ((select private.checklist_is_admin()));
create policy checklist_employees_read on public.checklist_employees for select to authenticated
using ((select private.checklist_can_use_app()));
create policy checklist_employees_admin_insert on public.checklist_employees for insert to authenticated
with check ((select private.checklist_is_admin()));
create policy checklist_employees_admin_update on public.checklist_employees for update to authenticated
using ((select private.checklist_is_admin())) with check ((select private.checklist_is_admin()));
create policy checklist_employees_admin_delete on public.checklist_employees for delete to authenticated
using ((select private.checklist_is_admin()));
create policy checklist_employee_branches_read on public.checklist_employee_branches for select to authenticated
using ((select private.checklist_can_access_branch(branch_uuid)));
create policy checklist_employee_branches_admin_insert on public.checklist_employee_branches for insert to authenticated
with check ((select private.checklist_is_admin()));
create policy checklist_employee_branches_admin_update on public.checklist_employee_branches for update to authenticated
using ((select private.checklist_is_admin())) with check ((select private.checklist_is_admin()));
create policy checklist_employee_branches_admin_delete on public.checklist_employee_branches for delete to authenticated
using ((select private.checklist_is_admin()));

create policy checklist_templates_read on public.checklist_templates for select to authenticated
using ((select private.checklist_can_use_app()));
create policy checklist_templates_admin_insert on public.checklist_templates for insert to authenticated
with check ((select private.checklist_is_admin()));
create policy checklist_templates_admin_update on public.checklist_templates for update to authenticated
using ((select private.checklist_is_admin())) with check ((select private.checklist_is_admin()));
create policy checklist_templates_admin_delete on public.checklist_templates for delete to authenticated
using ((select private.checklist_is_admin()));
create policy checklist_versions_read on public.checklist_template_versions for select to authenticated
using ((select private.checklist_can_use_app()));
create policy checklist_versions_admin_insert on public.checklist_template_versions for insert to authenticated
with check ((select private.checklist_is_admin()));
create policy checklist_versions_admin_update on public.checklist_template_versions for update to authenticated
using ((select private.checklist_is_admin())) with check ((select private.checklist_is_admin()));
create policy checklist_versions_admin_delete on public.checklist_template_versions for delete to authenticated
using ((select private.checklist_is_admin()));
create policy checklist_sections_read on public.checklist_sections for select to authenticated
using ((select private.checklist_can_use_app()));
create policy checklist_sections_admin_insert on public.checklist_sections for insert to authenticated
with check ((select private.checklist_is_admin()));
create policy checklist_sections_admin_update on public.checklist_sections for update to authenticated
using ((select private.checklist_is_admin())) with check ((select private.checklist_is_admin()));
create policy checklist_sections_admin_delete on public.checklist_sections for delete to authenticated
using ((select private.checklist_is_admin()));
create policy checklist_items_read on public.checklist_items for select to authenticated
using ((select private.checklist_can_use_app()));
create policy checklist_items_admin_insert on public.checklist_items for insert to authenticated
with check ((select private.checklist_is_admin()));
create policy checklist_items_admin_update on public.checklist_items for update to authenticated
using ((select private.checklist_is_admin())) with check ((select private.checklist_is_admin()));
create policy checklist_items_admin_delete on public.checklist_items for delete to authenticated
using ((select private.checklist_is_admin()));

create policy checklist_inspections_read on public.checklist_inspections for select to authenticated
using ((select private.checklist_can_access_branch(branch_uuid)));
create policy checklist_inspections_insert on public.checklist_inspections for insert to authenticated
with check (created_by = (select auth.uid()) and (select private.checklist_can_access_branch(branch_uuid)));
create policy checklist_inspections_update on public.checklist_inspections for update to authenticated
using ((select private.checklist_can_access_branch(branch_uuid)) and (status = 'draft' or (select private.checklist_is_admin())))
with check ((select private.checklist_can_access_branch(branch_uuid)));
create policy checklist_inspections_admin_delete on public.checklist_inspections for delete to authenticated
using ((select private.checklist_is_admin()));

create policy checklist_participants_access on public.checklist_inspection_participants for all to authenticated
using (exists (select 1 from public.checklist_inspections i where i.id = inspection_id and (select private.checklist_can_access_branch(i.branch_uuid))))
with check (exists (select 1 from public.checklist_inspections i where i.id = inspection_id and i.status = 'draft' and (select private.checklist_can_access_branch(i.branch_uuid))));
create policy checklist_answers_access on public.checklist_answers for all to authenticated
using (exists (select 1 from public.checklist_inspections i where i.id = inspection_id and (select private.checklist_can_access_branch(i.branch_uuid))))
with check (exists (select 1 from public.checklist_inspections i where i.id = inspection_id and i.status = 'draft' and (select private.checklist_can_access_branch(i.branch_uuid))));
create policy checklist_answer_employees_access on public.checklist_answer_employees for all to authenticated
using (exists (select 1 from public.checklist_answers a join public.checklist_inspections i on i.id = a.inspection_id where a.id = answer_id and (select private.checklist_can_access_branch(i.branch_uuid))))
with check (exists (select 1 from public.checklist_answers a join public.checklist_inspections i on i.id = a.inspection_id where a.id = answer_id and i.status = 'draft' and (select private.checklist_can_access_branch(i.branch_uuid))));
create policy checklist_evidence_access on public.checklist_evidence for all to authenticated
using (exists (select 1 from public.checklist_inspections i where i.id = inspection_id and (select private.checklist_can_access_branch(i.branch_uuid))))
with check (created_by = (select auth.uid()) and exists (select 1 from public.checklist_inspections i where i.id = inspection_id and i.status = 'draft' and (select private.checklist_can_access_branch(i.branch_uuid))));
create policy checklist_corrective_access on public.checklist_corrective_actions for all to authenticated
using (exists (select 1 from public.checklist_inspections i where i.id = inspection_id and (select private.checklist_can_access_branch(i.branch_uuid))))
with check (exists (select 1 from public.checklist_inspections i where i.id = inspection_id and (select private.checklist_can_access_branch(i.branch_uuid))));
create policy checklist_audit_read on public.checklist_audit_logs for select to authenticated
using ((select private.checklist_is_admin()) or (branch_uuid is not null and (select private.checklist_can_access_branch(branch_uuid))));
create policy checklist_audit_insert on public.checklist_audit_logs for insert to authenticated
with check (actor_auth_user_id = (select auth.uid()) and (select private.checklist_can_use_app()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checklist-evidence', 'checklist-evidence', false, 6291456, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy checklist_storage_select on storage.objects for select to authenticated
using (bucket_id = 'checklist-evidence' and (select private.checklist_can_use_app()));
create policy checklist_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'checklist-evidence' and owner_id = (select auth.uid()::text) and (select private.checklist_can_use_app()));
create policy checklist_storage_update on storage.objects for update to authenticated
using (bucket_id = 'checklist-evidence' and owner_id = (select auth.uid()::text) and (select private.checklist_can_use_app()))
with check (bucket_id = 'checklist-evidence' and owner_id = (select auth.uid()::text) and (select private.checklist_can_use_app()));
create policy checklist_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'checklist-evidence' and (owner_id = (select auth.uid()::text) or (select private.checklist_is_admin())));

insert into public.checklist_templates (id, template_code, name, description, inspection_interval_days)
values ('00000000-0000-4000-8000-000000000001', 'TAKEAWAY-BANH-TRANG', 'Checklist quầy takeaway bánh tráng', 'Mẫu kiểm tra vận hành định kỳ cho cửa hàng Gánh Hàng Rong.', 2)
on conflict (template_code) do nothing;

insert into public.checklist_template_versions (id, template_id, version_number, status, total_weight, published_at)
values ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 1, 'published', 100, now())
on conflict (template_id, version_number) do nothing;

insert into public.checklist_sections (id, version_id, section_code, name, weight, display_order) values
('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','APPEARANCE','Hình ảnh quầy bán',10,1),
('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','HYGIENE','Vệ sinh quầy và dụng cụ',20,2),
('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','FOOD_SAFETY','Nguyên liệu và an toàn thực phẩm',25,3),
('10000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','PRODUCT','Chất lượng sản phẩm',20,4),
('10000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001','SERVICE','Nhân viên và phục vụ',10,5),
('10000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000001','OPERATIONS','Kho, thiết bị và vận hành',10,6),
('10000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000001','FOLLOW_UP','Khắc phục lỗi cũ',5,7)
on conflict (version_id, section_code) do nothing;

insert into public.checklist_items (version_id, section_id, item_code, content, weight, is_critical, evidence_rule, default_penalty_level, display_order) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','AP-01','Bảng hiệu, đèn và nhận diện Gánh Hàng Rong sạch, hoạt động tốt',2,false,'fail','minor',1),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','AP-02','Mặt trước quầy sạch, không bong tróc hoặc hư hỏng',2,false,'fail','minor',2),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','AP-03','Menu và giá bán hiển thị rõ ràng, đúng với hệ thống',2,false,'fail','minor',3),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','AP-04','Khu vực xung quanh quầy không có rác, nước đọng hoặc mùi khó chịu',2,false,'fail','minor',4),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','AP-05','Nguyên liệu và vật dụng được sắp xếp gọn gàng',2,false,'fail','minor',5),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','HY-01','Mặt bàn chế biến sạch, không có thực phẩm cũ hoặc dầu mỡ tích tụ',4,true,'fail','critical',6),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','HY-02','Thau trộn, kéo, muỗng, kẹp và dụng cụ chế biến sạch',4,true,'fail','critical',7),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','HY-03','Hộp đựng nguyên liệu sạch, có nắp đậy phù hợp',3,true,'fail','major',8),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','HY-04','Khăn lau và dụng cụ vệ sinh được phân loại, không dùng lẫn',2,false,'fail','minor',9),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','HY-05','Thùng rác có túi, có nắp và không để rác đầy',3,false,'fail','minor',10),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','HY-06','Không có ruồi, gián, chuột hoặc dấu hiệu côn trùng',4,true,'always','critical',11),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','FS-01','Không có nguyên liệu hết hạn, hư hỏng hoặc có mùi bất thường',5,true,'always','severe',12),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','FS-02','Nguyên liệu có nhãn tên, ngày mở và hạn sử dụng',3,true,'fail','critical',13),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','FS-03','Bánh tráng được bảo quản khô ráo, kín và cách sàn',3,true,'fail','major',14),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','FS-04','Xoài, rau răm và nguyên liệu tươi còn tươi, được sơ chế sạch',4,true,'fail','critical',15),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','FS-05','Trứng, khô bò, khô gà, hành phi và topping được bảo quản đúng cách',4,true,'fail','critical',16),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','FS-06','Sốt, sa tế, dầu và gia vị không biến chất hoặc lẫn dị vật',3,true,'fail','critical',17),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','FS-07','Nguyên liệu được sử dụng theo nguyên tắc nhập trước, xuất trước',2,false,'fail','minor',18),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','FS-08','Nguồn nước và đá sử dụng bảo đảm vệ sinh',1,true,'fail','critical',19),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','PR-01','Bánh tráng được làm đúng công thức của từng sản phẩm',4,true,'fail','major',20),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','PR-02','Nguyên liệu và topping đúng định lượng quy định',4,false,'fail','major',21),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','PR-03','Thành phẩm được trộn đều, không quá khô, quá ướt hoặc vón cục',3,false,'fail','minor',22),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','PR-04','Mùi vị, màu sắc và độ tươi của thành phẩm đạt tiêu chuẩn',4,true,'fail','critical',23),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','PR-05','Thành phẩm không có dị vật, tóc hoặc bao bì lẫn vào',3,true,'always','severe',24),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','PR-06','Hộp, túi, tem nhãn và dụng cụ ăn kèm đầy đủ, sạch',2,false,'fail','minor',25),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','SV-01','Nhân viên mặc đúng đồng phục, đầu tóc và móng tay gọn gàng',2,false,'fail','minor',26),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','SV-02','Nhân viên rửa tay, đeo găng hoặc dùng dụng cụ gắp đúng quy định',3,true,'fail','critical',27),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','SV-03','Nhân viên không sử dụng điện thoại khi đang chế biến',2,false,'fail','minor',28),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','SV-04','Nhân viên chào hỏi, xác nhận món và giao đúng đơn cho khách',2,false,'fail','minor',29),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','SV-05','Nhân viên hiểu menu, giá và chương trình khuyến mãi',1,false,'fail','reminder',30),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000006','OP-01','Tồn kho thực tế không có chênh lệch bất thường',2,false,'fail','major',31),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000006','OP-02','Hàng hóa trong kho được sắp xếp gọn, khô ráo và cách sàn',2,false,'fail','minor',32),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000006','OP-03','Tủ mát, cân, máy in, máy bán hàng và thiết bị hoạt động bình thường',2,false,'fail','minor',33),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000006','OP-04','Đơn hàng được nhập đúng sản phẩm, topping, số lượng và giá',2,false,'fail','minor',34),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000006','OP-05','Tiền mặt, doanh thu và chứng từ không có chênh lệch bất thường',2,true,'fail','critical',35),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000007','FU-01','Các lỗi nghiêm trọng của lần kiểm tra trước đã được khắc phục',3,true,'fail','critical',36),
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000007','FU-02','Các lỗi thông thường của lần kiểm tra trước đã được khắc phục',2,false,'fail','major',37)
on conflict (version_id, item_code) do nothing;

notify pgrst, 'reload schema';
commit;
