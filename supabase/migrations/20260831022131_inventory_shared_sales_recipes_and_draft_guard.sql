-- Reuse one active sales recipe across duplicate Menu entities and prevent
-- accidental duplicate drafts in the same entity + branch scope.

alter table public.inventory_sales_recipes
  add column if not exists shared_menu_entity_type text,
  add column if not exists shared_menu_entity_id text,
  add column if not exists shared_menu_entity_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'inventory_sales_recipes_shared_entity_shape'
      and conrelid = 'public.inventory_sales_recipes'::regclass
  ) then
    alter table public.inventory_sales_recipes
      add constraint inventory_sales_recipes_shared_entity_shape check (
        (shared_menu_entity_type is null and shared_menu_entity_id is null and shared_menu_entity_name is null)
        or
        (
          shared_menu_entity_type in ('product', 'topping')
          and nullif(btrim(shared_menu_entity_id), '') is not null
          and nullif(btrim(shared_menu_entity_name), '') is not null
          and not (
            shared_menu_entity_type = menu_entity_type
            and shared_menu_entity_id = menu_entity_id
          )
        )
      );
  end if;
end;
$$;

create unique index if not exists inventory_sales_recipes_one_draft_uidx
  on public.inventory_sales_recipes (
    menu_entity_type,
    menu_entity_id,
    coalesce(branch_uuid, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'draft' and deleted_at is null;

create index if not exists inventory_sales_recipes_shared_entity_idx
  on public.inventory_sales_recipes (
    shared_menu_entity_type,
    shared_menu_entity_id,
    branch_uuid,
    status
  )
  where shared_menu_entity_id is not null and deleted_at is null;

create or replace function public.inventory_save_sales_recipe_draft_v2(
  p_recipe_id uuid,
  p_menu_entity_type text,
  p_menu_entity_id text,
  p_menu_entity_name text,
  p_branch_uuid uuid,
  p_yield_quantity numeric,
  p_effective_from date,
  p_notes text,
  p_components jsonb,
  p_shared_menu_entity_type text,
  p_shared_menu_entity_id text,
  p_shared_menu_entity_name text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_recipe_id uuid;
  v_version integer;
  v_component jsonb;
  v_shared_type text := nullif(btrim(coalesce(p_shared_menu_entity_type, '')), '');
  v_shared_id text := nullif(btrim(coalesce(p_shared_menu_entity_id, '')), '');
  v_shared_name text := nullif(btrim(coalesce(p_shared_menu_entity_name, '')), '');
  v_effective_from date := coalesce(p_effective_from, current_date);
begin
  if v_actor is null or not (select private.inventory_can_manage_boms()) then
    raise exception 'Tài khoản chưa có quyền quản lý định lượng món bán.';
  end if;
  if p_menu_entity_type not in ('product', 'topping') or nullif(btrim(p_menu_entity_id), '') is null then
    raise exception 'Vui lòng chọn món hoặc topping trong Menu.';
  end if;
  if coalesce(p_yield_quantity, 0) <= 0 then
    raise exception 'Sản lượng định lượng phải lớn hơn 0.';
  end if;
  if (v_shared_type is null) <> (v_shared_id is null)
    or (v_shared_id is null) <> (v_shared_name is null) then
    raise exception 'Vui lòng chọn đủ định lượng gốc dùng chung.';
  end if;
  if v_shared_type is not null and v_shared_type not in ('product', 'topping') then
    raise exception 'Loại định lượng gốc không hợp lệ.';
  end if;
  if v_shared_type = p_menu_entity_type and v_shared_id = btrim(p_menu_entity_id) then
    raise exception 'Một món không thể dùng chung định lượng với chính nó.';
  end if;
  if jsonb_typeof(coalesce(p_components, '[]'::jsonb)) <> 'array' then
    raise exception 'Danh sách thành phần không hợp lệ.';
  end if;
  if v_shared_id is null then
    if jsonb_array_length(coalesce(p_components, '[]'::jsonb)) = 0 then
      raise exception 'Định lượng món bán phải có ít nhất một thành phần.';
    end if;
  elsif jsonb_array_length(coalesce(p_components, '[]'::jsonb)) > 0 then
    raise exception 'Món dùng chung định lượng không khai báo thêm thành phần riêng.';
  end if;

  if exists (
    select 1
    from public.inventory_sales_recipes recipe
    where recipe.menu_entity_type = p_menu_entity_type
      and recipe.menu_entity_id = btrim(p_menu_entity_id)
      and recipe.branch_uuid is not distinct from p_branch_uuid
      and recipe.status = 'draft'
      and recipe.deleted_at is null
      and (p_recipe_id is null or recipe.id <> p_recipe_id)
  ) then
    raise exception 'Món này đã có bản nháp trong cùng phạm vi. Hãy sửa bản nháp hiện có.';
  end if;

  if v_shared_id is not null and not exists (
    select 1
    from public.inventory_sales_recipes source_recipe
    where source_recipe.menu_entity_type = v_shared_type
      and source_recipe.menu_entity_id = v_shared_id
      and source_recipe.shared_menu_entity_id is null
      and source_recipe.status = 'active'
      and source_recipe.deleted_at is null
      and source_recipe.effective_from <= v_effective_from
      and (source_recipe.effective_to is null or source_recipe.effective_to >= v_effective_from)
      and (
        (p_branch_uuid is null and source_recipe.branch_uuid is null)
        or
        (p_branch_uuid is not null and (source_recipe.branch_uuid = p_branch_uuid or source_recipe.branch_uuid is null))
      )
  ) then
    raise exception 'Định lượng gốc chưa có bản đang áp dụng phù hợp với phạm vi đã chọn.';
  end if;

  if p_recipe_id is null then
    select coalesce(max(recipe.version), 0) + 1
    into v_version
    from public.inventory_sales_recipes recipe
    where recipe.menu_entity_type = p_menu_entity_type
      and recipe.menu_entity_id = btrim(p_menu_entity_id)
      and recipe.branch_uuid is not distinct from p_branch_uuid;

    insert into public.inventory_sales_recipes (
      menu_entity_type, menu_entity_id, menu_entity_name, branch_uuid,
      version, yield_quantity, effective_from, notes,
      shared_menu_entity_type, shared_menu_entity_id, shared_menu_entity_name,
      created_by, updated_by
    ) values (
      p_menu_entity_type, btrim(p_menu_entity_id), btrim(p_menu_entity_name), p_branch_uuid,
      v_version, p_yield_quantity, v_effective_from, nullif(btrim(p_notes), ''),
      v_shared_type, v_shared_id, v_shared_name,
      v_actor, v_actor
    ) returning id into v_recipe_id;
  else
    update public.inventory_sales_recipes
    set menu_entity_type = p_menu_entity_type,
        menu_entity_id = btrim(p_menu_entity_id),
        menu_entity_name = btrim(p_menu_entity_name),
        branch_uuid = p_branch_uuid,
        yield_quantity = p_yield_quantity,
        effective_from = v_effective_from,
        notes = nullif(btrim(p_notes), ''),
        shared_menu_entity_type = v_shared_type,
        shared_menu_entity_id = v_shared_id,
        shared_menu_entity_name = v_shared_name,
        updated_at = now(),
        updated_by = v_actor
    where id = p_recipe_id and status = 'draft' and deleted_at is null
    returning id into v_recipe_id;
    if v_recipe_id is null then
      raise exception 'Chỉ công thức bản nháp mới được chỉnh sửa.';
    end if;
    delete from public.inventory_sales_recipe_components where recipe_id = v_recipe_id;
  end if;

  if v_shared_id is null then
    for v_component in select value from jsonb_array_elements(p_components)
    loop
      insert into public.inventory_sales_recipe_components (
        recipe_id, item_id, quantity, unit_id, waste_percent, display_order, notes,
        created_by, updated_by
      ) values (
        v_recipe_id,
        (v_component ->> 'itemId')::uuid,
        (v_component ->> 'quantity')::numeric,
        (v_component ->> 'unitId')::uuid,
        coalesce((v_component ->> 'wastePercent')::numeric, 0),
        coalesce((v_component ->> 'displayOrder')::integer, 0),
        nullif(btrim(v_component ->> 'notes'), ''),
        v_actor,
        v_actor
      );
    end loop;
  end if;

  return v_recipe_id;
end;
$$;

create or replace function private.inventory_sales_add_recipe_requirements(
  p_event_id uuid,
  p_source_line_key text,
  p_source_line_name text,
  p_menu_entity_type text,
  p_menu_entity_id text,
  p_menu_entity_name text,
  p_sales_quantity numeric,
  p_branch_uuid uuid,
  p_effective_date date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selected_recipe public.inventory_sales_recipes%rowtype;
  v_recipe public.inventory_sales_recipes%rowtype;
begin
  select recipe.* into v_selected_recipe
  from public.inventory_sales_recipes recipe
  where recipe.menu_entity_type = p_menu_entity_type
    and recipe.menu_entity_id = p_menu_entity_id
    and recipe.status = 'active'
    and recipe.deleted_at is null
    and recipe.effective_from <= coalesce(p_effective_date, current_date)
    and (recipe.effective_to is null or recipe.effective_to >= coalesce(p_effective_date, current_date))
    and (recipe.branch_uuid = p_branch_uuid or recipe.branch_uuid is null)
  order by (recipe.branch_uuid = p_branch_uuid) desc, recipe.version desc
  limit 1;

  if not found then
    insert into public.inventory_sales_order_event_lines (
      event_id, source_line_key, source_line_name, menu_entity_type, menu_entity_id,
      menu_entity_name, line_status, issue_code, issue_message
    ) values (
      p_event_id, coalesce(p_source_line_key, ''), coalesce(p_source_line_name, ''),
      p_menu_entity_type, p_menu_entity_id, p_menu_entity_name,
      'blocked', 'missing_recipe', 'Món chưa có định lượng đang áp dụng.'
    );
    return false;
  end if;

  if v_selected_recipe.shared_menu_entity_id is not null then
    select source_recipe.* into v_recipe
    from public.inventory_sales_recipes source_recipe
    where source_recipe.menu_entity_type = v_selected_recipe.shared_menu_entity_type
      and source_recipe.menu_entity_id = v_selected_recipe.shared_menu_entity_id
      and source_recipe.shared_menu_entity_id is null
      and source_recipe.status = 'active'
      and source_recipe.deleted_at is null
      and source_recipe.effective_from <= coalesce(p_effective_date, current_date)
      and (source_recipe.effective_to is null or source_recipe.effective_to >= coalesce(p_effective_date, current_date))
      and (source_recipe.branch_uuid = p_branch_uuid or source_recipe.branch_uuid is null)
    order by (source_recipe.branch_uuid = p_branch_uuid) desc, source_recipe.version desc
    limit 1;

    if not found then
      insert into public.inventory_sales_order_event_lines (
        event_id, source_line_key, source_line_name, menu_entity_type, menu_entity_id,
        menu_entity_name, recipe_id, line_status, issue_code, issue_message
      ) values (
        p_event_id, coalesce(p_source_line_key, ''), coalesce(p_source_line_name, ''),
        p_menu_entity_type, p_menu_entity_id, p_menu_entity_name, v_selected_recipe.id,
        'blocked', 'missing_shared_recipe', 'Định lượng dùng chung chưa có bản gốc đang áp dụng.'
      );
      return false;
    end if;
  else
    v_recipe := v_selected_recipe;
  end if;

  insert into public.inventory_sales_order_event_lines (
    event_id, source_line_key, source_line_name, menu_entity_type, menu_entity_id,
    menu_entity_name, recipe_id, item_id, required_quantity, line_status,
    metadata
  )
  select
    p_event_id, coalesce(p_source_line_key, ''), coalesce(p_source_line_name, ''),
    p_menu_entity_type, p_menu_entity_id, p_menu_entity_name,
    v_recipe.id, component.item_id,
    round(greatest(coalesce(p_sales_quantity, 0), 0) * component.base_quantity / v_recipe.yield_quantity, 6),
    'ready',
    case when v_selected_recipe.shared_menu_entity_id is not null then
      jsonb_build_object(
        'sharedRecipeId', v_selected_recipe.id,
        'sharedRecipeEntityName', v_selected_recipe.menu_entity_name,
        'sourceRecipeEntityName', v_recipe.menu_entity_name
      )
    else '{}'::jsonb end
  from public.inventory_sales_recipe_components component
  where component.recipe_id = v_recipe.id
    and component.base_quantity > 0;

  if not found then
    insert into public.inventory_sales_order_event_lines (
      event_id, source_line_key, source_line_name, menu_entity_type, menu_entity_id,
      menu_entity_name, recipe_id, line_status, issue_code, issue_message
    ) values (
      p_event_id, coalesce(p_source_line_key, ''), coalesce(p_source_line_name, ''),
      p_menu_entity_type, p_menu_entity_id, p_menu_entity_name, v_recipe.id,
      'blocked', 'empty_recipe', 'Định lượng chưa có thành phần hợp lệ.'
    );
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.inventory_save_sales_recipe_draft_v2(uuid,text,text,text,uuid,numeric,date,text,jsonb,text,text,text) from public, anon;
grant execute on function public.inventory_save_sales_recipe_draft_v2(uuid,text,text,text,uuid,numeric,date,text,jsonb,text,text,text) to authenticated, service_role;

notify pgrst, 'reload schema';
