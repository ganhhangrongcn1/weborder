-- Filter expired entries before limiting the quote wallet to eight vouchers.
create or replace function pos_checkout_private.pos_qr_voucher_current(p_voucher jsonb,p_at timestamptz)
returns boolean language sql stable set search_path='' as $$
  with d as (select left(coalesce(nullif(p_voucher->>'expiredAt',''),nullif(p_voucher->>'expiry',''),
    nullif(p_voucher->>'endAt',''),p_voucher->>'end_at',''),10) as expiry)
  select case when expiry ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then expiry>=to_char(p_at at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD') else true end from d;
$$;
revoke all on function pos_checkout_private.pos_qr_voucher_current(jsonb,timestamptz) from public,anon,authenticated;
grant execute on function pos_checkout_private.pos_qr_voucher_current(jsonb,timestamptz) to service_role;
do $patch$
declare definition text;
begin
  definition:=pg_get_functiondef('public.create_pos_bank_checkout_v2(uuid,jsonb,jsonb,jsonb,jsonb)'::regprocedure);
  if position('pos_qr_voucher_current' in definition)>0 then return; end if;
  if position('limit 8) active_vouchers)' in definition)=0 or position('if valid then discount:=' in definition)=0 then
    raise exception 'Checkout definition changed; review quote date patch'; end if;
  definition:=replace(definition,'limit 8) active_vouchers)',
    'and pos_checkout_private.pos_qr_voucher_current(value,now()) limit 8) active_vouchers)');
  definition:=replace(definition,'if valid then discount:=',
    'if source=''loyalty'' and not pos_checkout_private.pos_qr_voucher_current(voucher,now()) then valid:=false; reason:=''loyalty_voucher_expired''; end if; if valid then discount:=');
  execute definition;
end $patch$;
notify pgrst,'reload schema';
