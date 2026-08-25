-- Inventory Phase 3 foundation behavior test.
-- Run only against a disposable/local database after Phase 1 and Phase 3 migrations.

begin;

do $$
declare
  v_branch_id bigint;
  v_branch_uuid uuid := gen_random_uuid();
  v_branch_warehouse_id uuid := gen_random_uuid();
  v_department_warehouse_id uuid := gen_random_uuid();
  v_unit_id uuid := gen_random_uuid();
  v_group_id uuid := gen_random_uuid();
  v_item_id uuid := gen_random_uuid();
  v_actor_id uuid := '00000000-0000-0000-0000-000000000123';
  v_profile_admin_id uuid := '00000000-0000-0000-0000-000000000124';
  v_failed boolean;
begin
  insert into public.branches (branch_uuid, name)
  values (v_branch_uuid, 'Chi nhánh kiểm thử Phase 3')
  returning id into v_branch_id;

  insert into public.inventory_warehouses (
    id, code, name, warehouse_type, branch_uuid, is_default_for_branch
  )
  values (
    v_branch_warehouse_id,
    'P3-BRANCH',
    'Kho chi nhánh kiểm thử',
    'branch',
    v_branch_uuid,
    true
  );

  if not exists (
    select 1
    from public.inventory_warehouses warehouse
    where warehouse.id = v_branch_warehouse_id
      and warehouse.branch_id = v_branch_id
      and warehouse.branch_uuid = v_branch_uuid
  ) then
    raise exception 'Không tự đồng bộ branch_id từ branch_uuid.';
  end if;

  insert into public.inventory_warehouses (
    id, code, name, warehouse_type, branch_id, department_code, department_name, supply_warehouse_id
  )
  values (
    v_department_warehouse_id,
    'P3-DEPARTMENT',
    'Kho bếp kiểm thử',
    'department',
    v_branch_id,
    'bep nong',
    'Bếp',
    v_branch_warehouse_id
  );

  if not exists (
    select 1
    from public.inventory_warehouses warehouse
    where warehouse.id = v_department_warehouse_id
      and warehouse.department_code = 'BEP_NONG'
  ) then
    raise exception 'Mã khu chưa được chuẩn hoá để BOM định tuyến.';
  end if;

  v_failed := false;
  begin
    insert into public.inventory_warehouses (
      code, name, warehouse_type, branch_uuid, department_name
    )
    values ('P3-DEPARTMENT-NO-CODE', 'Kho bộ phận thiếu mã khu', 'department', v_branch_uuid, 'Bếp lạnh');
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Kho bộ phận thiếu mã khu vẫn được tạo.';
  end if;

  v_failed := false;
  begin
    insert into public.inventory_warehouses (
      code, name, warehouse_type, branch_uuid, is_default_for_branch
    )
    values ('P3-SECOND-DEFAULT', 'Kho mặc định trùng', 'branch', v_branch_uuid, true);
  exception when unique_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Một chi nhánh vẫn tạo được hai kho mặc định.';
  end if;

  insert into public.inventory_units (id, code, name, unit_type)
  values (v_unit_id, 'P3-KG', 'Kilôgam', 'weight');

  insert into public.inventory_item_groups (id, code, name)
  values (v_group_id, 'P3-SEMI', 'Bán thành phẩm');

  insert into public.inventory_items (
    id,
    code,
    name,
    item_type,
    group_id,
    base_unit_id,
    purchase_unit_id,
    purchase_to_base_ratio,
    reorder_point
  )
  values (
    v_item_id,
    'P3-ITEM',
    'Bán thành phẩm kiểm thử',
    'semi_finished',
    v_group_id,
    v_unit_id,
    v_unit_id,
    1,
    5
  );

  v_failed := false;
  begin
    insert into public.inventory_items (
      code, name, base_unit_id, purchase_to_base_ratio
    )
    values ('P3-RATIO-ZERO', 'Quy đổi bằng không', v_unit_id, 0);
  exception when check_violation then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'Tỷ lệ quy đổi bằng 0 vẫn được chấp nhận.';
  end if;

  update public.inventory_items
  set deleted_at = now()
  where id = v_item_id;

  if exists (
    select 1
    from public.inventory_items item
    where item.id = v_item_id
      and item.is_active
  ) then
    raise exception 'Lưu trữ mềm không tự tắt trạng thái hoạt động.';
  end if;

  if has_table_privilege('authenticated', 'public.inventory_items', 'DELETE') then
    raise exception 'Authenticated vẫn còn quyền xóa vật lý inventory_items.';
  end if;

  insert into auth.users (id) values (v_actor_id);
  perform set_config('request.jwt.claim.sub', v_actor_id::text, true);

  insert into public.inventory_user_access (
    auth_user_id, warehouse_id, role, is_active
  )
  values (v_actor_id, v_branch_warehouse_id, 'admin', true);

  if private.inventory_is_admin() then
    raise exception 'Admin theo một kho bị nâng thành admin toàn hệ thống.';
  end if;

  insert into auth.users (id) values (v_profile_admin_id);
  insert into public.profiles (
    auth_user_id, phone, role, status, registered
  )
  values (
    v_profile_admin_id, '0900000124', 'admin', 'active', true
  );
  perform set_config('request.jwt.claim.sub', v_profile_admin_id::text, true);

  if not private.inventory_is_admin() then
    raise exception 'Admin đang hoạt động của hệ thống không khởi tạo được quyền quản trị Kho.';
  end if;

end;
$$;

insert into public.inventory_user_access (
  auth_user_id, warehouse_id, role, is_active
)
values ('00000000-0000-0000-0000-000000000123', null, 'owner', true);

do $$
declare
  v_actor_id uuid := '00000000-0000-0000-0000-000000000123';
begin
  perform set_config('request.jwt.claim.sub', v_actor_id::text, true);

  if not private.inventory_is_admin() then
    raise exception 'Owner toàn hệ thống không được nhận diện.';
  end if;
end;
$$;

insert into auth.users (id)
values ('00000000-0000-0000-0000-000000000125');

insert into public.profiles (auth_user_id, phone, role, status, registered)
values (
  '00000000-0000-0000-0000-000000000125',
  '0900000125',
  'admin',
  'active',
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000125', true);

insert into public.inventory_units (
  code, name, unit_type, decimal_places, created_by, updated_by
)
values (
  'P3-API-UNIT',
  'Đơn vị kiểm thử Data API',
  'count',
  0,
  '00000000-0000-0000-0000-000000000125',
  '00000000-0000-0000-0000-000000000125'
);

update public.inventory_units
set
  deleted_at = now(),
  deleted_by = '00000000-0000-0000-0000-000000000125',
  updated_by = '00000000-0000-0000-0000-000000000125'
where code = 'P3-API-UNIT';

do $$
declare
  v_delete_blocked boolean := false;
begin
  if not exists (
    select 1
    from public.inventory_units unit
    where unit.code = 'P3-API-UNIT'
      and unit.deleted_at is not null
      and not unit.is_active
  ) then
    raise exception 'Data API Admin không tạo/cập nhật/lưu trữ mềm được đơn vị tính.';
  end if;

  begin
    delete from public.inventory_units where code = 'P3-API-UNIT';
  exception when insufficient_privilege then
    v_delete_blocked := true;
  end;

  if not v_delete_blocked then
    raise exception 'Data API vẫn xóa vật lý được dữ liệu nền.';
  end if;
end;
$$;

reset role;

rollback;

select 'inventory_phase3_foundation_test_passed' as result;
