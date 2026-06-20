-- Profiles / Branches Source Of Truth - Phase 1 Audit
-- Muc tieu: kiem tra contract chi nhanh/profile hien tai tren live Supabase.
-- Script nay chi doc du lieu, khong update/insert/delete.

-- 1) Kiem tra bang/cot lien quan
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'branches',
    'profiles',
    'orders',
    'partner_orders',
    'partner_order_items',
    'print_jobs'
  )
  and column_name in (
    'id',
    'branch_uuid',
    'branch_code',
    'branch_name',
    'pickup_branch_uuid',
    'delivery_branch_uuid',
    'metadata',
    'data',
    'role',
    'status',
    'phone',
    'name'
  )
order by table_name, ordinal_position;

-- 2) Kiem tra unique/index/foreign key co lien quan branch_uuid
select
  con.conname as constraint_name,
  rel.relname as table_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname in (
    'branches',
    'profiles',
    'orders',
    'partner_orders',
    'partner_order_items',
    'print_jobs'
  )
  and pg_get_constraintdef(con.oid) ilike '%branch%'
order by rel.relname, con.conname;

-- 3) Danh sach branch canonical
select
  id,
  branch_uuid,
  branch_code,
  name,
  slug,
  is_open,
  updated_at
from public.branches
order by name;

-- 4) Tim branch_uuid bi thieu hoac trung trong branches
select
  'missing_branch_uuid' as issue,
  count(*) as total
from public.branches
where branch_uuid is null
union all
select
  'duplicate_branch_uuid' as issue,
  count(*) as total
from (
  select branch_uuid
  from public.branches
  where branch_uuid is not null
  group by branch_uuid
  having count(*) > 1
) duplicated;

-- 5) Tim branch_code trung hoac rong trong branches
select
  coalesce(nullif(trim(branch_code), ''), '(empty)') as branch_code,
  count(*) as total,
  string_agg(coalesce(name, id::text), ' | ' order by name) as branch_names
from public.branches
group by coalesce(nullif(trim(branch_code), ''), '(empty)')
having count(*) > 1
   or coalesce(nullif(trim(branch_code), ''), '(empty)') = '(empty)'
order by total desc, branch_code;

-- 6) Staff/kitchen profiles thieu branch_uuid
-- Ghi chu: admin co the la global admin neu branch_uuid null.
select
  id,
  phone,
  name,
  role,
  status,
  branch_uuid,
  metadata ->> 'branch_name' as metadata_branch_name,
  metadata ->> 'branch_alias' as metadata_branch_alias,
  updated_at
from public.profiles
where lower(coalesce(role, '')) in ('staff', 'kitchen')
  and coalesce(status, '') <> 'blocked'
  and branch_uuid is null
order by role, name;

-- 6b) Global admin profiles khong gan chi nhanh
-- Neu day la owner/admin tong thi khong phai loi source of truth.
select
  id,
  phone,
  name,
  role,
  status,
  branch_uuid,
  metadata ->> 'branch_name' as metadata_branch_name,
  metadata ->> 'branch_alias' as metadata_branch_alias,
  updated_at
from public.profiles
where lower(coalesce(role, '')) = 'admin'
  and coalesce(status, '') <> 'blocked'
  and branch_uuid is null
order by name;

-- 7) Profiles co branch_uuid nhung khong match branches.branch_uuid
select
  p.id,
  p.phone,
  p.name,
  p.role,
  p.status,
  p.branch_uuid,
  p.metadata ->> 'branch_name' as metadata_branch_name,
  p.metadata ->> 'branch_alias' as metadata_branch_alias
from public.profiles p
left join public.branches b on b.branch_uuid::text = p.branch_uuid::text
where p.branch_uuid is not null
  and b.branch_uuid is null
order by p.role, p.name;

-- 8) Kitchen profiles: day la scope biep dang dung
select
  p.id,
  p.phone,
  p.name,
  p.role,
  p.status,
  p.branch_uuid,
  b.name as canonical_branch_name,
  b.branch_code as canonical_branch_code,
  p.metadata ->> 'branch_name' as metadata_branch_name,
  p.metadata ->> 'branch_alias' as metadata_branch_alias
from public.profiles p
left join public.branches b on b.branch_uuid::text = p.branch_uuid::text
where lower(coalesce(p.role, '')) = 'kitchen'
order by p.name;

-- 9) Web orders gan chi nhanh trong 30 ngay gan nhat
select
  count(*) as total_orders_30d,
  count(*) filter (where branch_uuid is not null) as has_branch_uuid,
  count(*) filter (where pickup_branch_uuid is not null) as has_pickup_branch_uuid,
  count(*) filter (where delivery_branch_uuid is not null) as has_delivery_branch_uuid,
  count(*) filter (
    where branch_uuid is null
      and pickup_branch_uuid is null
      and delivery_branch_uuid is null
  ) as missing_all_branch_uuid
from public.orders
where created_at >= now() - interval '30 days';

-- 10) Web orders co branch_uuid khong match branches
select
  o.id,
  o.order_code,
  o.branch_uuid,
  o.pickup_branch_uuid,
  o.delivery_branch_uuid,
  o.branch_name,
  o.pickup_branch_name,
  o.delivery_branch_name,
  o.created_at
from public.orders o
left join public.branches b1 on b1.branch_uuid::text = o.branch_uuid::text
left join public.branches b2 on b2.branch_uuid::text = o.pickup_branch_uuid::text
left join public.branches b3 on b3.branch_uuid::text = o.delivery_branch_uuid::text
where o.created_at >= now() - interval '30 days'
  and (
    (o.branch_uuid is not null and b1.branch_uuid is null)
    or (o.pickup_branch_uuid is not null and b2.branch_uuid is null)
    or (o.delivery_branch_uuid is not null and b3.branch_uuid is null)
  )
order by o.created_at desc
limit 100;

-- 11) Partner orders gan chi nhanh trong 30 ngay gan nhat
select
  count(*) as total_partner_orders_30d,
  count(*) filter (where branch_uuid is not null) as has_branch_uuid,
  count(*) filter (where branch_uuid is null) as missing_branch_uuid
from public.partner_orders
where created_at >= now() - interval '30 days';

-- 12) Partner orders co branch_uuid khong match branches
select
  po.id,
  po.partner_source,
  po.nexpos_order_id,
  po.order_code,
  po.branch_uuid,
  po.branch_code,
  po.branch_name,
  po.nexpos_hub_id,
  po.nexpos_site_id,
  po.created_at
from public.partner_orders po
left join public.branches b on b.branch_uuid::text = po.branch_uuid::text
where po.created_at >= now() - interval '30 days'
  and po.branch_uuid is not null
  and b.branch_uuid is null
order by po.created_at desc
limit 100;

-- 13) Partner order items lech branch_uuid voi parent
select
  poi.id,
  poi.partner_order_id,
  poi.item_key,
  poi.partner_item_name,
  poi.branch_uuid as item_branch_uuid,
  po.branch_uuid as order_branch_uuid,
  po.order_code,
  po.partner_source
from public.partner_order_items poi
join public.partner_orders po on po.id = poi.partner_order_id
where coalesce(poi.branch_uuid::text, '') <> coalesce(po.branch_uuid::text, '')
order by po.created_at desc
limit 100;

-- 14) Print jobs gan chi nhanh trong 30 ngay gan nhat
select
  count(*) as total_print_jobs_30d,
  count(*) filter (where branch_uuid is not null) as has_branch_uuid,
  count(*) filter (where branch_uuid is null) as missing_branch_uuid
from public.print_jobs
where created_at >= now() - interval '30 days';

-- 15) Print jobs co branch_uuid khong match branches
select
  pj.id,
  pj.order_id,
  pj.order_code,
  pj.branch_uuid,
  pj.status,
  pj.created_at
from public.print_jobs pj
left join public.branches b on b.branch_uuid::text = pj.branch_uuid::text
where pj.created_at >= now() - interval '30 days'
  and pj.branch_uuid is not null
  and b.branch_uuid is null
order by pj.created_at desc
limit 100;

-- 16) Tong hop nhanh cac issue can xu ly truoc Phase 2/3
with
branches_missing as (
  select count(*) as total from public.branches where branch_uuid is null
),
profiles_missing as (
  select count(*) as total
  from public.profiles
  where lower(coalesce(role, '')) in ('staff', 'kitchen')
    and coalesce(status, '') <> 'blocked'
    and branch_uuid is null
),
global_admins as (
  select count(*) as total
  from public.profiles
  where lower(coalesce(role, '')) = 'admin'
    and coalesce(status, '') <> 'blocked'
    and branch_uuid is null
),
profiles_orphan as (
  select count(*) as total
  from public.profiles p
  left join public.branches b on b.branch_uuid::text = p.branch_uuid::text
  where p.branch_uuid is not null
    and b.branch_uuid is null
),
orders_missing as (
  select count(*) as total
  from public.orders
  where created_at >= now() - interval '30 days'
    and branch_uuid is null
    and pickup_branch_uuid is null
    and delivery_branch_uuid is null
),
partner_missing as (
  select count(*) as total
  from public.partner_orders
  where created_at >= now() - interval '30 days'
    and branch_uuid is null
),
print_missing as (
  select count(*) as total
  from public.print_jobs
  where created_at >= now() - interval '30 days'
    and branch_uuid is null
)
select 'branches_missing_branch_uuid' as issue, total from branches_missing
union all
select 'staff_kitchen_profiles_missing_branch_uuid', total from profiles_missing
union all
select 'global_admin_profiles_without_branch_uuid', total from global_admins
union all
select 'profiles_branch_uuid_not_in_branches', total from profiles_orphan
union all
select 'orders_30d_missing_all_branch_uuid', total from orders_missing
union all
select 'partner_orders_30d_missing_branch_uuid', total from partner_missing
union all
select 'print_jobs_30d_missing_branch_uuid', total from print_missing
order by issue;
