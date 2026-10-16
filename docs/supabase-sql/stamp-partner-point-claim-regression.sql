-- Run as a database operator; all point and stamp changes are rolled back.
-- Tests the customer stamp-trigger path using authenticated JWT claims.
-- current_actor() treats the SQL session as a service actor; this is a backend
-- regression, not a browser authentication test.
begin;
do $test$
declare o record; r record; stamps_before jsonb; total integer:=0; blocked boolean;
begin
  for o in
    select distinct on (po.branch_uuid) po.id,po.branch_uuid,po.expected_earn_points,p.auth_user_id,
      public.normalize_vietnam_phone(p.phone) phone
    from public.partner_orders po
    join public.profiles p on p.auth_user_id is not null and p.role='customer' and p.status='active'
      and public.normalize_vietnam_phone(p.phone)=public.normalize_vietnam_phone(coalesce(nullif(po.customer_phone_key,''),po.customer_phone))
    join stamp_private.sources s on s.source='partner_orders' and s.order_id=po.id::text
    where po.order_time>now()-interval '7 days' and po.order_status in ('completed','done')
      and po.expected_earn_points>0 and po.point_status='pending'
      and not exists(select 1 from public.loyalty_ledger l where l.source_type='PARTNER_ORDER'
        and l.source_order_id=po.id::text and l.action='CLAIM_PARTNER_EARN')
    order by po.branch_uuid,po.order_time desc
  loop
    perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',o.auth_user_id)::text,true);
    stamps_before:=public.get_stamp_summary(o.phone);
    select * into r from public.process_order_loyalty('PARTNER_ORDER',o.id::text,'CLAIM_PARTNER_EARN','fix-regression-'||o.id);
    if not r.ok or not r.applied or r.points_delta<>o.expected_earn_points or r.balance_after-r.balance_before<>o.expected_earn_points then
      raise exception 'CLAIM_ASSERTION_FAILED';
    end if;
    if public.get_stamp_summary(o.phone) is distinct from stamps_before then raise exception 'STAMPS_CHANGED'; end if;
    if not exists(select 1 from public.partner_orders where id=o.id and point_status='claimed' and claimed_customer_phone=o.phone) then raise exception 'STATUS_ASSERTION_FAILED'; end if;
    select * into r from public.process_order_loyalty('PARTNER_ORDER',o.id::text,'CLAIM_PARTNER_EARN','fix-regression-retry-'||o.id);
    if not r.ok or r.applied or r.balance_after<>r.balance_before then raise exception 'DUPLICATE_CLAIM_ASSERTION_FAILED'; end if;
    blocked:=false;
    begin update public.partner_orders set total_amount=total_amount+1 where id=o.id;
    exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'AMOUNT_GUARD_FAILED'; end if;
    blocked:=false;
    begin update public.partner_orders set order_status='cancelled' where id=o.id;
    exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'STATUS_GUARD_FAILED'; end if;
    blocked:=false;
    begin update public.partner_orders set claimed_customer_phone='0900000000' where id=o.id;
    exception when insufficient_privilege then blocked:=true; end;
    if not blocked then raise exception 'OWNER_GUARD_FAILED'; end if;
    total:=total+1;
  end loop;
  if total<>4 then raise exception 'EXPECTED_FOUR_BRANCHES_TESTED, actual %',total; end if;
end $test$;
select 'PASS: claims across 4 branches, correct balance, unchanged stamps, duplicate protection, amount/status/owner guards; all data rolled back' as result;
rollback;
