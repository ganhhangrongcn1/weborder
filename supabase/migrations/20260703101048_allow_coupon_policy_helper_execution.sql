-- Allow authenticated requests to evaluate the private coupon RLS helper.
-- The helper still requires an active Auth-linked admin profile.

begin;

revoke execute on function loyalty_private.is_active_staff(text[])
from public, anon;
grant execute on function loyalty_private.is_active_staff(text[])
to authenticated;

do $$
begin
  if has_function_privilege(
    'anon',
    'loyalty_private.is_active_staff(text[])',
    'EXECUTE'
  ) then
    raise exception 'Anonymous helper execution must stay disabled.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'loyalty_private.is_active_staff(text[])',
    'EXECUTE'
  ) then
    raise exception 'Authenticated coupon policies cannot evaluate the role helper.';
  end if;
end;
$$;

commit;
