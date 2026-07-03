-- Read-only postcheck for server-side order voucher validation.

begin transaction read only;

select
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid) as trigger_definition
from pg_trigger t
where t.tgrelid = 'public.orders'::regclass
  and not t.tgisinternal
  and t.tgname = 'orders_00_validate_voucher';

select
  role_name,
  has_function_privilege(
    role_name,
    'public.validate_checkout_voucher(text,text,numeric,text,text,text,timestamptz)',
    'EXECUTE'
  ) as can_preflight_voucher,
  has_function_privilege(
    role_name,
    'loyalty_private.evaluate_order_voucher(text,text,numeric,text,text,text,timestamptz)',
    'EXECUTE'
  ) as can_execute_private_evaluator
from unnest(array['anon', 'authenticated']) as role_name;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'orders_promo_code_usage_idx',
    'orders_promo_voucher_id_idx'
  )
order by indexname;

rollback;
