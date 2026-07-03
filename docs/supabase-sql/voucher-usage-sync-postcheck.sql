-- Read-only postcheck for loyalty voucher usage sync.

select
  p.proname,
  n.nspname as schema_name
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname, p.proname) in (
  ('loyalty_private', 'compute_loyalty_voucher_usage_from_orders'),
  ('public', 'sync_loyalty_voucher_usage_from_orders')
)
order by n.nspname, p.proname;

select
  customer_phone,
  vouchers
from public.loyalty_accounts
where customer_phone = '0813105657';
