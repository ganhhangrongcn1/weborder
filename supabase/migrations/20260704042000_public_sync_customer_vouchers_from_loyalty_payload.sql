-- Public wrapper to sync loyalty voucher payloads into normalized customer_vouchers.
-- This lets authenticated staff/admin flows keep customer_vouchers as the reporting source.

create or replace function public.sync_customer_vouchers_from_loyalty_payload(
  p_customer_phone text,
  p_vouchers jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not loyalty_private.is_active_staff(array['admin', 'staff', 'crm']::text[]) then
    raise exception 'Không có quyền đồng bộ voucher.' using errcode = '42501';
  end if;

  return loyalty_private.sync_customer_vouchers_from_jsonb(
    p_customer_phone,
    coalesce(p_vouchers, '[]'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.sync_customer_vouchers_from_loyalty_payload(text, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
