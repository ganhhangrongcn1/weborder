create or replace function public.inventory_deactivate_sales_recipe(p_recipe_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_recipe_id uuid;
begin
  if v_actor is null or not (select private.inventory_can_manage_boms()) then
    raise exception 'Tài khoản chưa có quyền ngừng áp dụng định lượng món bán.';
  end if;

  update public.inventory_sales_recipes
  set status = 'inactive',
      effective_to = current_date,
      updated_at = now(),
      updated_by = v_actor
  where id = p_recipe_id
    and status = 'active'
    and deleted_at is null
  returning id into v_recipe_id;

  if v_recipe_id is null then
    raise exception 'Chỉ định lượng đang áp dụng mới có thể ngừng.';
  end if;

  return v_recipe_id;
end;
$$;

revoke all on function public.inventory_deactivate_sales_recipe(uuid) from public, anon;
grant execute on function public.inventory_deactivate_sales_recipe(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
