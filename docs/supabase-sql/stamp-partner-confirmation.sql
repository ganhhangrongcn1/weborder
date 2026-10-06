-- Partner orders earn when accepted by the shop; cancellation/refund still reverses the source.
-- No backfill, no change to point loyalty or daily stamp limit.
create or replace function stamp_private.partner_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare cfg stamp_private.program; phone_key text; eligible boolean; source_time timestamptz; prior stamp_private.sources;
begin
  select * into cfg from stamp_private.program where id;
  select * into prior from stamp_private.sources where source='partner_orders' and order_id=new.id::text;
  if not stamp_private.is_operator(new.branch_uuid) then
    if prior.order_id is not null then raise exception 'Chỉ nhân viên được điều chỉnh đơn đã tích tem.' using errcode='42501'; end if;
    return new;
  end if;
  phone_key:=stamp_private.phone(coalesce(nullif(new.claimed_customer_phone,''),nullif(new.customer_phone_key,''),new.customer_phone));
  source_time:=coalesce(new.order_time,new.created_at);
  if prior.order_id is not null and (phone_key<>prior.phone or (source_time at time zone 'Asia/Ho_Chi_Minh')::date<>prior.business_day) then
    raise exception 'STAMP_ORDER_IDENTITY_CHANGED';
  end if;
  if phone_key !~ '^0[35789][0-9]{8}$' then return new; end if;
  eligible:=(cfg.enabled or prior.active is true) and source_time>=cfg.starts_at and new.total_amount>0
    and lower(coalesce(new.order_status,'')) in ('confirmed','preparing','ready','completed','done');
  if eligible or exists(select 1 from stamp_private.sources where source='partner_orders' and order_id=new.id::text) then
    perform stamp_private.set_source('partner_orders',new.id::text,phone_key,(source_time at time zone 'Asia/Ho_Chi_Minh')::date,eligible);
  end if;
  return new;
end $$;
notify pgrst,'reload schema';
