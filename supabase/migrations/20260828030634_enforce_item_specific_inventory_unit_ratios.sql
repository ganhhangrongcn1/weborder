create or replace function private.inventory_item_unit_to_base(
  p_item_id uuid,
  p_unit_id uuid
)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  v_item public.inventory_items%rowtype;
  v_unit public.inventory_units%rowtype;
begin
  select item.*
  into v_item
  from public.inventory_items item
  where item.id = p_item_id
    and item.is_active;

  if not found then
    raise exception 'Nguyên vật liệu không tồn tại hoặc đã ngừng sử dụng.';
  end if;

  if p_unit_id = v_item.base_unit_id then
    return 1;
  end if;

  select unit.*
  into v_unit
  from public.inventory_units unit
  where unit.id = p_unit_id
    and unit.is_active;

  if not found then
    raise exception 'Đơn vị tính không tồn tại hoặc đã ngừng sử dụng.';
  end if;

  if p_unit_id = v_item.purchase_unit_id and v_item.purchase_to_base_ratio > 0 then
    return v_item.purchase_to_base_ratio;
  end if;

  raise exception 'Đơn vị tính chưa được cấu hình là đơn vị sử dụng hoặc mua / nhập của nguyên vật liệu.';
end;
$$;

notify pgrst, 'reload schema';
