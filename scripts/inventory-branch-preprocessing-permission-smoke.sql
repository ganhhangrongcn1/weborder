\set ON_ERROR_STOP on

begin;

do $$
declare
  v_actor uuid;
  v_branch uuid;
  v_other_branch uuid;
  v_central uuid;
begin
  select users.id into v_actor
  from auth.users users
  where not exists (
    select 1
    from public.inventory_user_access access
    where access.auth_user_id = users.id and access.is_active
  )
  order by users.created_at
  limit 1;

  select warehouse.id into v_branch
  from public.inventory_warehouses warehouse
  where warehouse.warehouse_type = 'branch'
    and warehouse.is_active
    and warehouse.deleted_at is null
  order by warehouse.code
  limit 1;

  select warehouse.id into v_other_branch
  from public.inventory_warehouses warehouse
  where warehouse.warehouse_type = 'branch'
    and warehouse.is_active
    and warehouse.deleted_at is null
    and warehouse.id <> v_branch
  order by warehouse.code
  limit 1;

  select warehouse.id into v_central
  from public.inventory_warehouses warehouse
  where warehouse.warehouse_type = 'central'
    and warehouse.is_active
    and warehouse.deleted_at is null
  order by warehouse.code
  limit 1;

  if v_actor is null or v_branch is null or v_other_branch is null or v_central is null then
    raise exception 'Thiếu dữ liệu nền để smoke quyền sơ chế.';
  end if;

  insert into public.inventory_user_access(auth_user_id, warehouse_id, role, is_active)
  values (v_actor, v_branch, 'branch_manager', true);

  perform set_config('request.jwt.claim.sub', v_actor::text, true);

  if not private.inventory_can_manage_bom(v_branch, 'branch') then
    raise exception 'branch_manager không quản lý được công thức sơ chế đúng kho.';
  end if;
  if private.inventory_can_manage_bom(v_branch, 'central') then
    raise exception 'branch_manager vượt quyền sang công thức Kho Tổng.';
  end if;
  if private.inventory_can_manage_bom(v_central, 'central') then
    raise exception 'branch_manager vượt quyền sang Kho Tổng.';
  end if;
  if private.inventory_can_manage_bom(v_other_branch, 'branch') then
    raise exception 'branch_manager vượt quyền sang chi nhánh khác.';
  end if;
  if not private.inventory_can_view_bom(v_branch)
     or private.inventory_can_view_bom(v_other_branch)
     or private.inventory_can_view_bom(v_central) then
    raise exception 'RLS xem công thức không đúng phạm vi kho.';
  end if;
end;
$$;

select 'branch_preprocessing_permission_smoke_ok' as result;

rollback;
