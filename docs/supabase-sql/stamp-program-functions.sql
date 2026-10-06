create or replace function public.get_stamp_summary(p_phone text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare phone_key text := stamp_private.phone(p_phone); cfg stamp_private.program; a stamp_private.accounts; gifts jsonb;
begin
  select * into cfg from stamp_private.program where id;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'image',p.image,'price',p.price,'metadata',p.metadata)
    order by array_position(cfg.gift_ids,p.id)),'[]') into gifts
    from public.products p where p.id=any(cfg.gift_ids) and p.active is not false and p.visible is not false;
  if phone_key<>'' then
    perform stamp_private.authorize(phone_key);
    select * into a from stamp_private.accounts where phone=phone_key;
  end if;
  return jsonb_build_object('enabled',cfg.enabled,'startsAt',cfg.starts_at,'required',10,'gifts',gifts,'giftIds',cfg.gift_ids,
    'balance',coalesce(a.balance,0),'held',coalesce(a.held,0),'available',greatest(0,coalesce(a.balance-a.held,0)),
    'earnedToday',exists(select 1 from stamp_private.sources where phone=phone_key and business_day=(now() at time zone 'Asia/Ho_Chi_Minh')::date and active));
end $$;

create or replace function public.get_stamp_history(p_phone text,p_before bigint default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare phone_key text := stamp_private.phone(p_phone); result jsonb;
begin
  perform stamp_private.authorize(phone_key);
  select coalesce(jsonb_agg(to_jsonb(e) order by e.id desc),'[]') into result from (
    select id,kind,delta,source,order_id,created_at from stamp_private.events
      where phone=phone_key and (p_before is null or id<p_before) order by id desc limit 20
  ) e;
  return result;
end $$;

create or replace function public.save_stamp_program(p_enabled boolean,p_gift_ids text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform stamp_private.authorize('',null,true);
  if p_enabled is null or cardinality(p_gift_ids)>3 or (p_enabled and coalesce(cardinality(p_gift_ids),0)<>3)
    or cardinality(p_gift_ids)<>(select count(distinct x) from unnest(p_gift_ids) x)
    or (p_enabled and exists(select 1 from unnest(p_gift_ids) x where not exists(select 1 from public.products p where p.id=x and p.active is not false and p.visible is not false)))
  then raise exception 'Chọn đúng 3 món khác nhau đang bán.'; end if;
  update stamp_private.program set enabled=p_enabled,gift_ids=coalesce(p_gift_ids,'{}'),
    starts_at=case when p_enabled then coalesce(starts_at,now()) else starts_at end,updated_at=now() where id;
  return public.get_stamp_summary('');
end $$;
revoke all on function public.get_stamp_summary(text) from public,anon,authenticated;
revoke all on function public.get_stamp_history(text,bigint) from public,anon,authenticated;
revoke all on function public.save_stamp_program(boolean,text[]) from public,anon,authenticated;
grant execute on function public.get_stamp_summary(text) to anon,authenticated;
grant execute on function public.get_stamp_history(text,bigint) to authenticated;
grant execute on function public.save_stamp_program(boolean,text[]) to authenticated;
