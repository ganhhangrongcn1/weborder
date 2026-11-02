-- Service-only entrypoint. The Edge verifies the JWT and selects the bank from
-- server configuration; no authenticated client can supply a receiving account.
grant usage on schema pos_checkout_private to service_role;
grant execute on function pos_checkout_private.save_pos_qr_checkout(uuid,jsonb,jsonb) to service_role;
create or replace function public.create_pos_bank_checkout(p_actor uuid,p_session jsonb,p_order jsonb,p_items jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  s public.pos_payment_sessions; actor public.profiles; result jsonb;
  claims text:=coalesce(current_setting('request.jwt.claims',true),'');
  branch uuid:=(p_session->>'branch_uuid')::uuid;
  reference text:=p_session->>'payment_reference'; checkout_key text:=p_session->>'request_key';
  pager text:=nullif(p_session->>'pager_number','');
  pager_disabled boolean:=coalesce((p_session->'checkout_snapshot'->>'pagerEnabled')::boolean,true)=false;
begin
  if coalesce(auth.role(),'')<>'service_role' and not (session_user in ('postgres','supabase_admin') and coalesce(auth.role(),'')='') then
    raise exception 'Server checkout only' using errcode='42501';
  end if;
  select * into actor from public.profiles where auth_user_id=p_actor
    and role in ('admin','staff','kitchen') and status='active' limit 1;
  if actor.id is null or branch is null or not ((actor.role='admin' and actor.branch_uuid is null) or actor.branch_uuid=branch) then
    raise exception 'Không có quyền tại chi nhánh.' using errcode='42501';
  end if;
  if reference is null or reference !~ '^[A-Z0-9-]{6,80}$' or checkout_key is null or checkout_key !~ '^[A-Za-z0-9:_-]{6,120}$'
    or p_session->>'source' is distinct from 'pos' or p_session->>'provider' not in ('sepay','pay2s')
    or p_session->>'bank_account_snapshot' is distinct from 'true'
    or coalesce((p_session->>'amount_expected')::numeric,0)<=0
    or jsonb_typeof(p_session->'cart_snapshot') is distinct from 'array' or jsonb_array_length(p_session->'cart_snapshot')=0 then
    raise exception 'Dữ liệu tạo phiên QR không hợp lệ.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('pos-bank:'||checkout_key,0));
  perform pg_advisory_xact_lock(hashtextextended('pos-ref:'||reference,0));
  select * into s from public.pos_payment_sessions q
    where q.request_key=checkout_key or q.payment_reference=reference limit 1 for update;
  -- Set verified actor context only inside this transaction, to reuse existing
  -- stamp/voucher/order guards. Restore it before returning to the server role.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'role','authenticated')::text,true);
  if s.id is not null then
    result:=pos_checkout_private.save_pos_qr_checkout(s.id,p_order,p_items);
    perform set_config('request.jwt.claims',claims,true);
    return jsonb_build_object('session',result,'reused',true);
  end if;
  if pager_disabled then
    if pager is not null or not exists(select 1 from public.app_configs where id='ghr_pos_pager_'||branch::text
      and value->>'enabled'='false') then raise exception 'Cấu hình thẻ rung đã thay đổi.'; end if;
  elsif pager is null then raise exception 'Vui lòng chọn thẻ rung.'; end if;
  if pager is not null then
    perform pg_advisory_xact_lock(hashtextextended(branch::text||':'||pager,0));
    if exists(select 1 from public.pos_payment_sessions where branch_uuid=branch and pager_number=pager
      and status in ('draft','pending_payment','paid','converting') and expires_at>now()) then
      raise exception 'Thẻ rung đang có QR chưa hoàn tất.';
    end if;
  end if;
  insert into public.pos_payment_sessions(payment_reference,request_key,provider,source,status,branch_uuid,pos_shift_id,
    branch_name,cashier_name,customer_name,customer_phone,pager_number,currency,amount_expected,amount_paid,
    cart_snapshot,checkout_snapshot,provider_payload,expires_at)
  values(reference,checkout_key,p_session->>'provider','pos','pending_payment',branch,(p_session->>'pos_shift_id')::uuid,
    coalesce(p_session->>'branch_name',''),coalesce(actor.name,actor.email,''),coalesce(p_session->>'customer_name',''),
    nullif(p_session->>'customer_phone',''),pager,'VND',(p_session->>'amount_expected')::numeric,0,
    p_session->'cart_snapshot',coalesce(p_session->'checkout_snapshot','{}')||'{"combinedCheckout":true}'::jsonb,
    coalesce(p_session->'provider_payload','{}'),now()+interval '10 min') returning * into s;
  result:=pos_checkout_private.save_pos_qr_checkout(s.id,p_order,p_items);
  perform set_config('request.jwt.claims',claims,true);
  return jsonb_build_object('session',result,'reused',false);
end $$;
revoke all on function public.create_pos_bank_checkout(uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_pos_bank_checkout(uuid,jsonb,jsonb,jsonb) to service_role;
notify pgrst,'reload schema';

do $patch$
declare definition text;
begin
  definition:=pg_get_functiondef('pos_checkout_private.save_pos_qr_checkout(uuid,jsonb,jsonb)'::regprocedure);
  definition:=replace(definition,$old$(p_order - 'created_at' - 'updated_at')::text$old$,$new$((p_order - 'created_at' - 'updated_at') #- '{metadata,customerLookup}' #- '{metadata,paidAt}')::text$new$);
  execute definition;
end $patch$;
