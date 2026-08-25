-- Transactional behavior test. Always rolls back.

begin;

do $$
declare
  actor_id uuid := null;
  gram_id uuid;
  kilogram_id uuid;
  group_id uuid;
  item_code text;
begin
  insert into public.inventory_units (
    code, name, symbol, unit_type, decimal_places,
    base_unit_id, conversion_factor, display_order,
    created_by, updated_by
  ) values (
    'TEST_GRAM', 'Gram test', 'g', 'weight', 3,
    null, 1, 1,
    actor_id, actor_id
  ) returning id into gram_id;

  insert into public.inventory_units (
    code, name, symbol, unit_type, decimal_places,
    base_unit_id, conversion_factor, display_order,
    created_by, updated_by
  ) values (
    'TEST_KG', 'Kg test', 'kg', 'weight', 3,
    gram_id, 1000, 2,
    actor_id, actor_id
  ) returning id into kilogram_id;

  insert into public.inventory_item_groups (
    code, name, description, display_order, created_by, updated_by
  ) values (
    'TEST_GIA_VI', 'Gia vị test', 'Nhóm kiểm thử P0', 3, actor_id, actor_id
  ) returning id into group_id;

  insert into public.inventory_items (
    code, name, item_type, group_id, base_unit_id,
    purchase_unit_id, purchase_to_base_ratio,
    created_by, updated_by
  ) values (
    '', 'Muối test', 'ingredient', group_id, gram_id,
    kilogram_id, 1000,
    actor_id, actor_id
  ) returning code into item_code;

  if item_code !~ '^NVL-[0-9]{6}$' then
    raise exception 'Mã NVL tự sinh không đúng: %', item_code;
  end if;

  begin
    update public.inventory_units
    set unit_type = 'volume'
    where id = kilogram_id;
    raise exception 'Ràng buộc cùng loại đo lường đã không chạy';
  exception
    when check_violation then null;
  end;

  begin
    update public.inventory_units
    set base_unit_id = kilogram_id
    where id = kilogram_id;
    raise exception 'Ràng buộc không cho đơn vị tự quy đổi đã không chạy';
  exception
    when check_violation then null;
  end;
end;
$$;

rollback;
