-- Prepare a disabled program. Activate only after Viet Sing installs POS 0.4.23+.
begin;
do $setup$
declare
  target_program jsonb := $program${"id":"promo-flash-sale-vietsing-19k-20261009","type":"flash_sale","icon":"sale","name":"Việt Sing đồng giá 19k 09–11/10/2026","title":"Việt Sing đồng giá 19.000đ","text":"Toàn bộ món tại POS Việt Sing ngày 09–11/10/2026. Topping/phần thêm tính riêng; được sử dụng điểm tích lũy.","active":false,"displayPlaces":["menu"],"salesChannels":["pos"],"startAt":"2026-10-09","endAt":"2026-10-11","priority":1,"condition":{"branchIds":["b108f000-02dc-4f04-8a97-996bbfc27fb8"],"applyScope":"all","productIds":"","categoryIds":"","exactFixedPrice":true,"minSubtotal":0,"customerType":"all","useTimeWindow":false,"startTime":"00:00","endTime":"23:59","weekdays":[],"totalSlots":0,"soldCount":0,"maxPerCustomer":999999,"minDiscountToShow":0,"noStackWithOtherPromotions":false},"reward":{"type":"fixed_price","value":19000,"productId":"","roundMode":"none"}}$program$::jsonb;
  current_config jsonb;
  existing_rows jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('ghr-vietsing-19k-20261009'));
  if not exists (
    select 1 from public.branches
    where branch_uuid = 'b108f000-02dc-4f04-8a97-996bbfc27fb8'::uuid
      and branch_code = 'CN04' and legacy_id = 'viet-sing'
  ) then raise exception 'Target Viet Sing branch does not match'; end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'smart_promotions'
      and policyname = 'smart_promotions_branch_scope_authenticated'
      and permissive = 'RESTRICTIVE'
  ) or not exists (
    select 1 from pg_policies where schemaname = 'public'
      and tablename = 'smart_promotions'
      and policyname = 'smart_promotions_branch_scope_anon'
      and permissive = 'RESTRICTIVE'
  ) then raise exception 'Branch read protection must be applied first'; end if;
  select value into current_config from public.app_configs
    where id = 'ghr_smart_promotions' for update;
  if jsonb_typeof(current_config) is distinct from 'array' then
    raise exception 'Promotion snapshot must be an array';
  end if;
  select coalesce(jsonb_agg(data order by id), '[]'::jsonb) into existing_rows
    from public.smart_promotions where data->>'id' <> target_program->>'id';
  if exists (select 1 from public.smart_promotions where data->>'id' = target_program->>'id')
    or exists (select 1 from jsonb_array_elements(current_config) p where p->>'id' = target_program->>'id')
  then
    if not exists (select 1 from public.smart_promotions where data = target_program)
      or not current_config @> jsonb_build_array(target_program)
    then raise exception 'Existing program differs; preserve it instead of overwriting'; end if;
    return;
  end if;
  insert into public.smart_promotions(data) values (target_program);
  update public.app_configs set value = current_config || jsonb_build_array(target_program),
    updated_at = now() where id = 'ghr_smart_promotions';
  if existing_rows is distinct from (
    select coalesce(jsonb_agg(data order by id), '[]'::jsonb)
    from public.smart_promotions where data->>'id' <> target_program->>'id'
  ) then raise exception 'Other promotions changed unexpectedly'; end if;
end $setup$;
commit;
