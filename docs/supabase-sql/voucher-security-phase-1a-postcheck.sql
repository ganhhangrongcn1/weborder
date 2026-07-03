-- Read-only postcheck for voucher security phase 1A.

begin transaction read only;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'coupons'
order by policyname;

select
  role_name,
  has_table_privilege(role_name, 'public.coupons', 'SELECT') as can_select,
  has_table_privilege(role_name, 'public.coupons', 'INSERT') as can_insert,
  has_table_privilege(role_name, 'public.coupons', 'UPDATE') as can_update,
  has_table_privilege(role_name, 'public.coupons', 'DELETE') as can_delete
from unnest(array['anon', 'authenticated']) as role_name;

select
  role_name,
  has_function_privilege(
    role_name,
    'public.get_admin_crm_analytics()',
    'EXECUTE'
  ) as can_execute_crm_analytics
from unnest(array['anon', 'authenticated']) as role_name;

select
  role_name,
  has_function_privilege(
    role_name,
    'loyalty_private.is_active_staff(text[])',
    'EXECUTE'
  ) as can_execute_staff_helper
from unnest(array['anon', 'authenticated']) as role_name;

select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer,
  p.proconfig as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname, p.proname) in (
  ('public', 'get_admin_crm_analytics'),
  ('loyalty_private', 'get_admin_crm_analytics_unchecked'),
  ('loyalty_private', 'is_active_staff')
)
order by schema_name, function_name;

rollback;
