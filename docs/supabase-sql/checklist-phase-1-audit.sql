-- GHR Checklist Phase 1 - read-only audit

select branch_uuid, branch_code, name, address
from public.branches
order by name;

select
  count(*) as total_branches,
  count(*) filter (where branch_uuid is null) as missing_branch_uuid,
  count(distinct branch_uuid) as distinct_branch_uuid
from public.branches;

select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename like 'checklist_%'
order by tablename;

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where (schemaname = 'public' and tablename like 'checklist_%')
   or (schemaname = 'storage' and tablename = 'objects' and policyname like 'checklist_%')
order by schemaname, tablename, policyname;

select
  v.version_number,
  v.status,
  count(i.id) as item_count,
  sum(i.weight) as item_weight,
  count(*) filter (where i.is_critical) as critical_item_count
from public.checklist_template_versions v
join public.checklist_items i on i.version_id = v.id
where v.template_id = '00000000-0000-4000-8000-000000000001'
group by v.version_number, v.status
order by v.version_number;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'checklist-evidence';

select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename like 'checklist_%'
order by tablename, indexname;
