-- Integration checks, all test data/configuration is ROLLED BACK.
-- Uses an existing order read-only. Never inserts/updates orders or partner orders.
begin;
set local statement_timeout = '25s';
create temporary table deduction_test_results(name text primary key, passed boolean) on commit drop;
do $$
declare
  v_admin uuid;
  v_central uuid;
  v_branch_user uuid;
  v_branch uuid;
  v_warehouse uuid;
  v_order public.orders%rowtype;
  v_partner public.partner_orders%rowtype;
  v_partner_event uuid;
  v_queued uuid;
  v_line public.order_items%rowtype;
  v_item public.inventory_items%rowtype;
  v_recipe uuid;
  v_event uuid;
  v_other uuid;
  v_reversal uuid;
  v_key text := 'switch-test:' || gen_random_uuid()::text;
  v_setting jsonb;
  v_result jsonb;
  v_time timestamptz;
  v_quantity numeric;
  v_denied boolean;
begin
  select auth_user_id into v_admin from public.profiles
  where role='admin' and branch_uuid is null and auth_user_id is not null and coalesce(status,'active')='active' limit 1;
  select p.auth_user_id into v_central from public.profiles p join public.inventory_user_access a using(auth_user_id)
  where p.branch_uuid is null and p.role='staff' and a.is_active and a.role='central_manager' limit 1;
  select auth_user_id into v_branch_user from public.profiles where branch_uuid is not null and auth_user_id is not null limit 1;
  if v_admin is null or v_central is null or v_branch_user is null then raise exception 'Missing permission fixtures'; end if;
  select o.* into v_order from public.orders o
  where o.status='done' and o.created_at is not null
    and exists(select 1 from public.inventory_warehouses w where w.branch_uuid=coalesce(o.branch_uuid,o.pickup_branch_uuid,o.delivery_branch_uuid,o.branch_id,o.pickup_branch_id,o.delivery_branch_id)
      and w.is_active and w.deleted_at is null and w.is_default_for_branch)
    and (select count(*) from public.order_items l where l.order_id=o.id)=1
    and exists(select 1 from public.order_items l where l.order_id=o.id and nullif(l.product_id,'') is not null and l.quantity>0 and l.quantity<50)
  order by o.created_at desc limit 1;
  if not found then raise exception 'Missing single-line order fixture'; end if;
  select * into v_line from public.order_items where order_id=v_order.id;
  v_branch:=coalesce(v_order.branch_uuid,v_order.pickup_branch_uuid,v_order.delivery_branch_uuid,v_order.branch_id,v_order.pickup_branch_id,v_order.delivery_branch_id);
  select id into v_warehouse from public.inventory_warehouses where branch_uuid=v_branch and is_active and deleted_at is null and is_default_for_branch limit 1;
  select * into v_item from public.inventory_items where is_active and deleted_at is null and base_unit_id is not null limit 1;

  perform set_config('request.jwt.claim.sub','',true);
  v_denied:=false;
  begin perform public.inventory_set_sales_deduction(v_branch,true,null); exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'Anonymous setter allowed'; end if;
  insert into deduction_test_results values('anonymous denied',true);

  perform set_config('request.jwt.claim.sub',v_branch_user::text,true);
  v_denied:=false;
  begin perform public.inventory_set_sales_deduction(v_branch,true,null); exception when insufficient_privilege then v_denied:=true; end;
  if not v_denied then raise exception 'Branch setter allowed'; end if;
  v_result:=public.inventory_read_sales_deduction_settings();
  if (v_result->>'can_manage')::boolean or exists(select 1 from jsonb_array_elements(v_result->'rows') r
    where (r->>'branch_uuid')::uuid<>(select branch_uuid from public.profiles where auth_user_id=v_branch_user limit 1)) then raise exception 'Branch scope leaked'; end if;
  insert into deduction_test_results values('branch cannot change or see other branches',true);

  perform set_config('request.jwt.claim.sub',v_central::text,true);
  if not private.inventory_can_manage_sales_deduction() then raise exception 'Central denied'; end if;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  if not private.inventory_can_manage_sales_deduction() then raise exception 'Admin denied'; end if;
  insert into deduction_test_results values('central and admin management permitted',true);

  -- All settings start off. New queue events are excluded without stock writes.
  v_event:=private.inventory_queue_sales_event('order',v_key,v_order.id,'sale','done',v_branch,now());
  v_result:=private.inventory_process_sales_event(v_event);
  if v_result->>'status'<>'ignored' or exists(select 1 from public.inventory_documents where metadata->>'sales_event_id'=v_event::text) then raise exception 'Disabled event deducted'; end if;
  insert into deduction_test_results values('off: queue and worker do not create stock document',true);
  select * into v_partner from public.partner_orders where branch_uuid=v_branch and order_status='completed' order by created_at desc limit 1;
  if not found then raise exception 'Missing partner order fixture'; end if;
  v_partner_event:=private.inventory_queue_sales_event('partner_order',v_key||':partner',v_partner.id::text,'sale','completed',v_branch,now());
  if (private.inventory_process_sales_event(v_partner_event)->>'status')<>'ignored' then raise exception 'Partner off sale deducted'; end if;
  insert into deduction_test_results values('partner completed order stays excluded while off',true);

  select updated_at into v_time from private.inventory_sales_deduction_settings where branch_uuid=v_branch;
  v_setting:=public.inventory_set_sales_deduction(v_branch,true,v_time);
  v_time:=(v_setting->>'updated_at')::timestamptz;
  if not (v_setting->>'enabled')::boolean or v_setting->>'enabled_from' is null then raise exception 'Enable save failed'; end if;
  v_result:=public.inventory_set_sales_deduction(v_branch,true,v_time);
  if v_result->>'enabled_from' is distinct from v_setting->>'enabled_from' then raise exception 'Repeated save moved cutoff'; end if;
  insert into deduction_test_results values('enable persists and same-state save keeps cutoff',true);
  if exists(select 1 from private.inventory_sales_deduction_settings where branch_uuid<>v_branch and enabled) then raise exception 'Other branch enabled'; end if;
  insert into deduction_test_results values('enabling one branch does not enable others',true);
  v_denied:=false;
  begin perform public.inventory_set_sales_deduction(v_branch,false,v_time-interval '1 second'); exception when raise_exception then v_denied:=true; end;
  if not v_denied then raise exception 'Stale edit accepted'; end if;
  insert into deduction_test_results values('stale settings overwrite denied',true);

  perform private.inventory_retry_sales_order_event(v_event);
  if not (select processing_status='ignored' and metadata ? 'sales_deduction_excluded' from public.inventory_sales_order_events where id=v_event) then raise exception 'Retry lost exclusion'; end if;
  perform private.inventory_queue_sales_event('order',v_key,v_order.id,'sale','done',v_branch,now());
  if not private.inventory_exclude_disabled_sale(v_event) then raise exception 'Replay lost exclusion'; end if;
  insert into deduction_test_results values('enable/retry/re-enqueue never backfill excluded sale',true);
  v_other:=private.inventory_queue_sales_event('order',v_key||':late',v_order.id,'sale','done',v_branch,now());
  if (select issue_code from public.inventory_sales_order_events where id=v_other)<>'sales_before_activation' then raise exception 'Late old order allowed'; end if;
  insert into deduction_test_results values('late imported old order excluded by original creation time',true);
  perform private.inventory_queue_sales_event('partner_order',v_key||':partner',v_partner.id::text,'sale','completed',v_branch,now());
  if not private.inventory_exclude_disabled_sale(v_partner_event) then raise exception 'Partner replay lost exclusion'; end if;
  v_partner_event:=private.inventory_queue_sales_event('partner_order',v_key||':partner-late',v_partner.id::text,'sale','completed',v_branch,now());
  if (select issue_code from public.inventory_sales_order_events where id=v_partner_event)<>'sales_before_activation' then raise exception 'Late partner order allowed'; end if;
  insert into deduction_test_results values('partner late sync and replay do not backfill old orders',true);

  -- Eligible-order fixture: move ONLY the test setting cutoff, not the original order.
  update private.inventory_sales_deduction_settings set enabled_from=v_order.created_at-interval '1 day' where branch_uuid=v_branch;
  v_other:=private.inventory_queue_sales_event('order',v_key||':eligible',v_order.id,'sale','done',v_branch,now());
  if private.inventory_exclude_disabled_sale(v_other) then raise exception 'Eligible enabled sale excluded'; end if;
  v_result:=private.inventory_process_sales_event(v_other);
  if v_result->>'status'<>'blocked' then raise exception 'Missing recipe did not block: %',v_result; end if;
  insert into deduction_test_results values('enabled missing-recipe sale still blocked without partial deduction',true);

  insert into public.inventory_sales_recipes(code,menu_entity_type,menu_entity_id,menu_entity_name,branch_uuid,status,effective_from)
  values(v_key,'product',v_line.product_id,v_line.product_name,v_branch,'active',v_order.created_at::date-1) returning id into v_recipe;
  insert into public.inventory_sales_recipe_components(recipe_id,item_id,quantity,unit_id)
  values(v_recipe,v_item.id,1,v_item.base_unit_id);
  insert into public.inventory_stock_balances(warehouse_id,item_id,quantity,average_cost)
  values(v_warehouse,v_item.id,100,1000) on conflict(warehouse_id,item_id) do update set quantity=100,average_cost=1000;
  v_result:=private.inventory_process_sales_event(v_other);
  if v_result->>'status'<>'completed' then raise exception 'Enabled sale failed: %',v_result; end if;
  select quantity into v_quantity from public.inventory_stock_balances where warehouse_id=v_warehouse and item_id=v_item.id;
  if v_quantity<>100-v_line.quantity then raise exception 'Wrong deduction: %',v_quantity; end if;
  perform private.inventory_process_sales_event(v_other);
  if (select quantity from public.inventory_stock_balances where warehouse_id=v_warehouse and item_id=v_item.id)<>v_quantity then raise exception 'Duplicate deduction'; end if;
  insert into deduction_test_results values('enabled sale deducts recipe once; worker replay idempotent',true);
  v_queued:=private.inventory_queue_sales_event('order',v_key||':waiting',v_order.id,'sale','done',v_branch,now());

  select updated_at into v_time from private.inventory_sales_deduction_settings where branch_uuid=v_branch;
  perform public.inventory_set_sales_deduction(v_branch,false,v_time);
  v_reversal:=private.inventory_queue_sales_event('order',v_key||':eligible',v_order.id,'reversal','cancelled',v_branch,now());
  v_result:=private.inventory_process_sales_event(v_reversal);
  if v_result->>'status'<>'completed' or (select quantity from public.inventory_stock_balances where warehouse_id=v_warehouse and item_id=v_item.id)<>100 then raise exception 'Reversal while off failed: %',v_result; end if;
  perform private.inventory_process_sales_event(v_reversal);
  if (select quantity from public.inventory_stock_balances where warehouse_id=v_warehouse and item_id=v_item.id)<>100 then raise exception 'Double reversal'; end if;
  insert into deduction_test_results values('off preserves reversal of posted sale exactly once',true);
  v_reversal:=private.inventory_queue_sales_event('order',v_key,v_order.id,'reversal','cancelled',v_branch,now());
  v_result:=private.inventory_process_sales_event(v_reversal);
  if v_result->>'status'<>'ignored' then raise exception 'Unposted sale reversal created stock'; end if;
  insert into deduction_test_results values('cancel excluded sale never increases stock',true);
  select updated_at into v_time from private.inventory_sales_deduction_settings where branch_uuid=v_branch;
  perform public.inventory_set_sales_deduction(v_branch,true,v_time);
  if not private.inventory_exclude_disabled_sale(v_queued) then raise exception 'Queued event crossed off/on cutoff'; end if;
  insert into deduction_test_results values('queued event cannot cross a later off/on cutoff',true);
end;
$$;
select * from deduction_test_results order by name;
rollback;
