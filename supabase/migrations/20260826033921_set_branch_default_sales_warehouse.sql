-- Phase 6C: choose one sales-deduction warehouse per branch atomically.
-- This reuses inventory_warehouses.is_default_for_branch and does not change stock.

create or replace function public.inventory_set_branch_default_warehouse(
  p_branch_uuid uuid,
  p_warehouse_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_target_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Phiên đăng nhập đã hết hạn.' using errcode = '28000';
  end if;

  if not (select private.inventory_is_admin()) then
    raise exception 'Chỉ Admin được đổi kho trừ mặc định của chi nhánh.' using errcode = '42501';
  end if;

  select warehouse.id
  into v_target_id
  from public.inventory_warehouses warehouse
  where warehouse.id = p_warehouse_id
    and warehouse.branch_uuid = p_branch_uuid
    and warehouse.warehouse_type = 'branch'
    and warehouse.is_active
    and warehouse.deleted_at is null
  for update;

  if v_target_id is null then
    raise exception 'Kho được chọn không thuộc chi nhánh hoặc không còn hoạt động.' using errcode = '22023';
  end if;

  update public.inventory_warehouses warehouse
  set is_default_for_branch = false,
      updated_at = now(),
      updated_by = v_actor_id
  where warehouse.branch_uuid = p_branch_uuid
    and warehouse.is_default_for_branch
    and warehouse.id <> v_target_id;

  update public.inventory_warehouses warehouse
  set is_default_for_branch = true,
      updated_at = now(),
      updated_by = v_actor_id
  where warehouse.id = v_target_id;

  return v_target_id;
end;
$$;

revoke all on function public.inventory_set_branch_default_warehouse(uuid, uuid) from public, anon;
grant execute on function public.inventory_set_branch_default_warehouse(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
