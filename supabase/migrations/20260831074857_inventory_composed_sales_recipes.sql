-- Allow one sales recipe to be composed from multiple active Menu recipes.
-- Existing direct and shared recipes keep their current behavior.

create table if not exists public.inventory_sales_recipe_sources (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.inventory_sales_recipes(id) on delete cascade,
  menu_entity_type text not null check (menu_entity_type in ('product', 'topping')),
  menu_entity_id text not null,
  menu_entity_name text not null,
  quantity numeric(18,6) not null default 1 check (quantity > 0),
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  updated_by uuid not null default auth.uid(),
  constraint inventory_sales_recipe_sources_entity_unique
    unique (recipe_id, menu_entity_type, menu_entity_id)
);

create index if not exists inventory_sales_recipe_sources_recipe_idx
  on public.inventory_sales_recipe_sources (recipe_id, display_order, menu_entity_id);

create index if not exists inventory_sales_recipe_sources_entity_idx
  on public.inventory_sales_recipe_sources (menu_entity_type, menu_entity_id);

alter table public.inventory_sales_recipe_sources enable row level security;

drop policy if exists inventory_sales_recipe_sources_select on public.inventory_sales_recipe_sources;
create policy inventory_sales_recipe_sources_select on public.inventory_sales_recipe_sources
for select to authenticated
using (exists (
  select 1 from public.inventory_sales_recipes recipe
  where recipe.id = recipe_id
    and (select private.inventory_can_view_sales_branch(recipe.branch_uuid))
));

drop policy if exists inventory_sales_recipe_sources_insert on public.inventory_sales_recipe_sources;
create policy inventory_sales_recipe_sources_insert on public.inventory_sales_recipe_sources
for insert to authenticated
with check ((select private.inventory_can_manage_boms()) and created_by = (select auth.uid()));

drop policy if exists inventory_sales_recipe_sources_update on public.inventory_sales_recipe_sources;
create policy inventory_sales_recipe_sources_update on public.inventory_sales_recipe_sources
for update to authenticated
using ((select private.inventory_can_manage_boms()))
with check ((select private.inventory_can_manage_boms()));

drop policy if exists inventory_sales_recipe_sources_delete on public.inventory_sales_recipe_sources;
create policy inventory_sales_recipe_sources_delete on public.inventory_sales_recipe_sources
for delete to authenticated
using ((select private.inventory_can_manage_boms()));

revoke all on table public.inventory_sales_recipe_sources from anon;
grant select, insert, update, delete on table public.inventory_sales_recipe_sources to authenticated, service_role;

create or replace function private.inventory_sales_recipe_depends_on(
  p_menu_entity_type text,
  p_menu_entity_id text,
  p_target_entity_type text,
  p_target_entity_id text,
  p_branch_uuid uuid,
  p_effective_date date,
  p_seen text[] default array[]::text[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_recipe public.inventory_sales_recipes%rowtype;
  v_source record;
  v_key text := coalesce(p_menu_entity_type, '') || ':' || coalesce(p_menu_entity_id, '');
begin
  if p_menu_entity_type = p_target_entity_type and p_menu_entity_id = p_target_entity_id then
    return true;
  end if;
  if v_key = any(coalesce(p_seen, array[]::text[])) then
    return false;
  end if;

  select recipe.* into v_recipe
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

  if not found then return false; end if;

  if v_recipe.shared_menu_entity_id is not null then
    return private.inventory_sales_recipe_depends_on(
      v_recipe.shared_menu_entity_type, v_recipe.shared_menu_entity_id,
      p_target_entity_type, p_target_entity_id, p_branch_uuid, p_effective_date,
      array_append(coalesce(p_seen, array[]::text[]), v_key)
    );
  end if;

  for v_source in
    select source.menu_entity_type, source.menu_entity_id
    from public.inventory_sales_recipe_sources source
    where source.recipe_id = v_recipe.id
    order by source.display_order, source.id
  loop
    if private.inventory_sales_recipe_depends_on(
      v_source.menu_entity_type, v_source.menu_entity_id,
      p_target_entity_type, p_target_entity_id, p_branch_uuid, p_effective_date,
      array_append(coalesce(p_seen, array[]::text[]), v_key)
    ) then return true; end if;
  end loop;

  return false;
end;
$$;

create or replace function public.inventory_save_sales_recipe_draft_v3(
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
  p_shared_menu_entity_name text,
  p_sources jsonb
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
  v_source jsonb;
  v_shared_type text := nullif(btrim(coalesce(p_shared_menu_entity_type, '')), '');
  v_shared_id text := nullif(btrim(coalesce(p_shared_menu_entity_id, '')), '');
  v_shared_name text := nullif(btrim(coalesce(p_shared_menu_entity_name, '')), '');
  v_effective_from date := coalesce(p_effective_from, current_date);
  v_components jsonb := coalesce(p_components, '[]'::jsonb);
  v_sources jsonb := coalesce(p_sources, '[]'::jsonb);
  v_source_type text;
  v_source_id text;
begin
  if v_actor is null or not (select private.inventory_can_manage_boms()) then
    raise exception 'Tài khoản chưa có quyền quản lý định lượng món bán.';
  end if;
  if p_menu_entity_type not in ('product', 'topping') or nullif(btrim(p_menu_entity_id), '') is null then
    raise exception 'Vui lòng chọn món hoặc topping trong Menu.';
  end if;
  if coalesce(p_yield_quantity, 0) <= 0 then
    raise exception 'Số phần chuẩn phải lớn hơn 0.';
  end if;
  if jsonb_typeof(v_components) <> 'array' or jsonb_typeof(v_sources) <> 'array' then
    raise exception 'Danh sách thành phần hoặc món ghép không hợp lệ.';
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

  if v_shared_id is not null then
    if jsonb_array_length(v_components) > 0 or jsonb_array_length(v_sources) > 0 then
      raise exception 'Món dùng chung chỉ được chọn một định lượng gốc.';
    end if;
  elsif jsonb_array_length(v_sources) > 0 then
    if jsonb_array_length(v_components) > 0 then
      raise exception 'Combo ghép từ món gốc không khai báo thêm nguyên liệu trực tiếp.';
    end if;
  elsif jsonb_array_length(v_components) = 0 then
    raise exception 'Định lượng món bán phải có ít nhất một thành phần hoặc món gốc.';
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
    select 1 from public.inventory_sales_recipes source_recipe
    where source_recipe.menu_entity_type = v_shared_type
      and source_recipe.menu_entity_id = v_shared_id
      and source_recipe.status = 'active' and source_recipe.deleted_at is null
      and source_recipe.effective_from <= v_effective_from
      and (source_recipe.effective_to is null or source_recipe.effective_to >= v_effective_from)
      and (source_recipe.branch_uuid = p_branch_uuid or source_recipe.branch_uuid is null)
  ) then
    raise exception 'Định lượng gốc chưa có bản đang áp dụng phù hợp với phạm vi đã chọn.';
  end if;

  for v_source in select value from jsonb_array_elements(v_sources)
  loop
    v_source_type := coalesce(nullif(v_source ->> 'menuEntityType', ''), 'product');
    v_source_id := nullif(btrim(coalesce(v_source ->> 'menuEntityId', '')), '');
    if v_source_type not in ('product', 'topping') or v_source_id is null
      or coalesce((v_source ->> 'quantity')::numeric, 0) <= 0 then
      raise exception 'Món ghép và số lượng phải hợp lệ.';
    end if;
    if v_source_type = p_menu_entity_type and v_source_id = btrim(p_menu_entity_id) then
      raise exception 'Một combo không thể chứa chính nó.';
    end if;
    if not exists (
      select 1 from public.inventory_sales_recipes source_recipe
      where source_recipe.menu_entity_type = v_source_type
        and source_recipe.menu_entity_id = v_source_id
        and source_recipe.status = 'active' and source_recipe.deleted_at is null
        and source_recipe.effective_from <= v_effective_from
        and (source_recipe.effective_to is null or source_recipe.effective_to >= v_effective_from)
        and (source_recipe.branch_uuid = p_branch_uuid or source_recipe.branch_uuid is null)
    ) then
      raise exception 'Một món ghép chưa có định lượng đang áp dụng phù hợp.';
    end if;
    if private.inventory_sales_recipe_depends_on(
      v_source_type, v_source_id, p_menu_entity_type, btrim(p_menu_entity_id),
      p_branch_uuid, v_effective_from
    ) then
      raise exception 'Không thể ghép vì các định lượng sẽ tham chiếu vòng lặp.';
    end if;
  end loop;

  if (
    select count(*) <> count(distinct (value ->> 'menuEntityType', value ->> 'menuEntityId'))
    from jsonb_array_elements(v_sources)
  ) then
    raise exception 'Mỗi món gốc chỉ được thêm một lần trong combo.';
  end if;

  if p_recipe_id is null then
    select coalesce(max(recipe.version), 0) + 1 into v_version
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
      v_shared_type, v_shared_id, v_shared_name, v_actor, v_actor
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
        updated_at = now(), updated_by = v_actor
    where id = p_recipe_id and status = 'draft' and deleted_at is null
    returning id into v_recipe_id;
    if v_recipe_id is null then raise exception 'Chỉ định lượng bản nháp mới được chỉnh sửa.'; end if;
    delete from public.inventory_sales_recipe_components where recipe_id = v_recipe_id;
    delete from public.inventory_sales_recipe_sources where recipe_id = v_recipe_id;
  end if;

  for v_component in select value from jsonb_array_elements(v_components)
  loop
    insert into public.inventory_sales_recipe_components (
      recipe_id, item_id, quantity, unit_id, waste_percent, display_order, notes,
      created_by, updated_by
    ) values (
      v_recipe_id, (v_component ->> 'itemId')::uuid,
      (v_component ->> 'quantity')::numeric, (v_component ->> 'unitId')::uuid,
      coalesce((v_component ->> 'wastePercent')::numeric, 0),
      coalesce((v_component ->> 'displayOrder')::integer, 0),
      nullif(btrim(v_component ->> 'notes'), ''), v_actor, v_actor
    );
  end loop;

  for v_source in select value from jsonb_array_elements(v_sources)
  loop
    insert into public.inventory_sales_recipe_sources (
      recipe_id, menu_entity_type, menu_entity_id, menu_entity_name,
      quantity, display_order, created_by, updated_by
    ) values (
      v_recipe_id, v_source ->> 'menuEntityType', btrim(v_source ->> 'menuEntityId'),
      btrim(v_source ->> 'menuEntityName'), (v_source ->> 'quantity')::numeric,
      coalesce((v_source ->> 'displayOrder')::integer, 0), v_actor, v_actor
    );
  end loop;

  return v_recipe_id;
end;
$$;

create or replace function private.inventory_sales_resolve_recipe_requirements(
  p_recipe_id uuid,
  p_sales_quantity numeric,
  p_branch_uuid uuid,
  p_effective_date date,
  p_path uuid[] default array[]::uuid[]
)
returns table (
  item_id uuid,
  required_quantity numeric,
  resolved_recipe_id uuid,
  issue_code text,
  issue_message text,
  metadata jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_recipe public.inventory_sales_recipes%rowtype;
  v_source record;
  v_source_recipe public.inventory_sales_recipes%rowtype;
  v_source_count integer := 0;
begin
  select recipe.* into v_recipe
  from public.inventory_sales_recipes recipe
  where recipe.id = p_recipe_id;

  if not found then
    return query select null::uuid, null::numeric, p_recipe_id, 'missing_recipe'::text,
      'Không tìm thấy định lượng đang áp dụng.'::text, '{}'::jsonb;
    return;
  end if;
  if v_recipe.id = any(coalesce(p_path, array[]::uuid[])) then
    return query select null::uuid, null::numeric, v_recipe.id, 'circular_recipe'::text,
      'Định lượng đang tham chiếu vòng lặp.'::text, '{}'::jsonb;
    return;
  end if;

  if exists (select 1 from public.inventory_sales_recipe_components component where component.recipe_id = v_recipe.id and component.base_quantity > 0) then
    return query
    select component.item_id,
      round(greatest(coalesce(p_sales_quantity, 0), 0) * component.base_quantity / v_recipe.yield_quantity, 6),
      v_recipe.id, null::text, null::text,
      jsonb_build_object('recipeEntityName', v_recipe.menu_entity_name)
    from public.inventory_sales_recipe_components component
    where component.recipe_id = v_recipe.id and component.base_quantity > 0;
    return;
  end if;

  if v_recipe.shared_menu_entity_id is not null then
    select recipe.* into v_source_recipe
    from public.inventory_sales_recipes recipe
    where recipe.menu_entity_type = v_recipe.shared_menu_entity_type
      and recipe.menu_entity_id = v_recipe.shared_menu_entity_id
      and recipe.status = 'active' and recipe.deleted_at is null
      and recipe.effective_from <= coalesce(p_effective_date, current_date)
      and (recipe.effective_to is null or recipe.effective_to >= coalesce(p_effective_date, current_date))
      and (recipe.branch_uuid = p_branch_uuid or recipe.branch_uuid is null)
    order by (recipe.branch_uuid = p_branch_uuid) desc, recipe.version desc limit 1;
    if not found then
      return query select null::uuid, null::numeric, v_recipe.id, 'missing_shared_recipe'::text,
        'Định lượng dùng chung chưa có bản gốc đang áp dụng.'::text, '{}'::jsonb;
      return;
    end if;
    return query select * from private.inventory_sales_resolve_recipe_requirements(
      v_source_recipe.id, p_sales_quantity, p_branch_uuid, p_effective_date,
      array_append(coalesce(p_path, array[]::uuid[]), v_recipe.id)
    );
    return;
  end if;

  for v_source in
    select source.* from public.inventory_sales_recipe_sources source
    where source.recipe_id = v_recipe.id
    order by source.display_order, source.id
  loop
    v_source_count := v_source_count + 1;
    select recipe.* into v_source_recipe
    from public.inventory_sales_recipes recipe
    where recipe.menu_entity_type = v_source.menu_entity_type
      and recipe.menu_entity_id = v_source.menu_entity_id
      and recipe.status = 'active' and recipe.deleted_at is null
      and recipe.effective_from <= coalesce(p_effective_date, current_date)
      and (recipe.effective_to is null or recipe.effective_to >= coalesce(p_effective_date, current_date))
      and (recipe.branch_uuid = p_branch_uuid or recipe.branch_uuid is null)
    order by (recipe.branch_uuid = p_branch_uuid) desc, recipe.version desc limit 1;

    if not found then
      return query select null::uuid, null::numeric, v_recipe.id, 'missing_composed_recipe'::text,
        ('Món ghép ' || v_source.menu_entity_name || ' chưa có định lượng đang áp dụng.')::text,
        jsonb_build_object('sourceMenuEntityName', v_source.menu_entity_name);
    else
      return query select * from private.inventory_sales_resolve_recipe_requirements(
        v_source_recipe.id,
        greatest(coalesce(p_sales_quantity, 0), 0) * v_source.quantity / v_recipe.yield_quantity,
        p_branch_uuid, p_effective_date,
        array_append(coalesce(p_path, array[]::uuid[]), v_recipe.id)
      );
    end if;
  end loop;

  if v_source_count = 0 then
    return query select null::uuid, null::numeric, v_recipe.id, 'empty_recipe'::text,
      'Định lượng chưa có thành phần hoặc món gốc hợp lệ.'::text, '{}'::jsonb;
  end if;
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
  v_recipe public.inventory_sales_recipes%rowtype;
  v_inserted integer := 0;
begin
  select recipe.* into v_recipe
  from public.inventory_sales_recipes recipe
  where recipe.menu_entity_type = p_menu_entity_type
    and recipe.menu_entity_id = p_menu_entity_id
    and recipe.status = 'active' and recipe.deleted_at is null
    and recipe.effective_from <= coalesce(p_effective_date, current_date)
    and (recipe.effective_to is null or recipe.effective_to >= coalesce(p_effective_date, current_date))
    and (recipe.branch_uuid = p_branch_uuid or recipe.branch_uuid is null)
  order by (recipe.branch_uuid = p_branch_uuid) desc, recipe.version desc limit 1;

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

  insert into public.inventory_sales_order_event_lines (
    event_id, source_line_key, source_line_name, menu_entity_type, menu_entity_id,
    menu_entity_name, recipe_id, item_id, required_quantity, line_status,
    issue_code, issue_message, metadata
  )
  select p_event_id, coalesce(p_source_line_key, ''), coalesce(p_source_line_name, ''),
    p_menu_entity_type, p_menu_entity_id, p_menu_entity_name,
    resolved.resolved_recipe_id, resolved.item_id, resolved.required_quantity,
    case when resolved.issue_code is null then 'ready' else 'blocked' end,
    resolved.issue_code, resolved.issue_message,
    coalesce(resolved.metadata, '{}'::jsonb) || jsonb_build_object('rootRecipeId', v_recipe.id)
  from private.inventory_sales_resolve_recipe_requirements(
    v_recipe.id, p_sales_quantity, p_branch_uuid, p_effective_date
  ) resolved;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
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

  return not exists (
    select 1 from public.inventory_sales_order_event_lines line
    where line.event_id = p_event_id
      and line.source_line_key = coalesce(p_source_line_key, '')
      and line.line_status = 'blocked'
  );
end;
$$;

revoke all on function private.inventory_sales_recipe_depends_on(text,text,text,text,uuid,date,text[]) from public, anon;
revoke all on function private.inventory_sales_resolve_recipe_requirements(uuid,numeric,uuid,date,uuid[]) from public, anon;
revoke all on function public.inventory_save_sales_recipe_draft_v3(uuid,text,text,text,uuid,numeric,date,text,jsonb,text,text,text,jsonb) from public, anon;
grant execute on function public.inventory_save_sales_recipe_draft_v3(uuid,text,text,text,uuid,numeric,date,text,jsonb,text,text,text,jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
