-- Phase 6C foundation: sale recipes and partner-channel mappings.
-- This migration only stores configuration. It does not deduct inventory.

create sequence if not exists public.inventory_sales_recipe_code_seq;

create table if not exists public.inventory_sales_recipes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('DLM-' || lpad(nextval('public.inventory_sales_recipe_code_seq')::text, 6, '0')),
  menu_entity_type text not null default 'product'
    check (menu_entity_type in ('product', 'topping')),
  menu_entity_id text not null,
  menu_entity_name text not null,
  branch_uuid uuid,
  version integer not null default 1 check (version > 0),
  yield_quantity numeric(18,6) not null default 1 check (yield_quantity > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive')),
  effective_from date not null default current_date,
  effective_to date,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  updated_by uuid not null default auth.uid(),
  deleted_at timestamptz,
  constraint inventory_sales_recipes_effective_range
    check (effective_to is null or effective_to >= effective_from)
);

create unique index if not exists inventory_sales_recipes_entity_branch_version_uidx
  on public.inventory_sales_recipes (
    menu_entity_type,
    menu_entity_id,
    coalesce(branch_uuid, '00000000-0000-0000-0000-000000000000'::uuid),
    version
  );

create unique index if not exists inventory_sales_recipes_one_active_uidx
  on public.inventory_sales_recipes (
    menu_entity_type,
    menu_entity_id,
    coalesce(branch_uuid, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'active' and deleted_at is null;

create index if not exists inventory_sales_recipes_branch_status_idx
  on public.inventory_sales_recipes (branch_uuid, status, updated_at desc)
  where deleted_at is null;

create table if not exists public.inventory_sales_recipe_components (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.inventory_sales_recipes(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id),
  quantity numeric(18,6) not null check (quantity > 0),
  unit_id uuid not null references public.inventory_units(id),
  conversion_to_base numeric(18,6) not null default 1 check (conversion_to_base > 0),
  base_quantity numeric(18,6) not null default 0 check (base_quantity > 0),
  waste_percent numeric(8,4) not null default 0 check (waste_percent >= 0 and waste_percent <= 100),
  display_order integer not null default 0 check (display_order >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  updated_by uuid not null default auth.uid(),
  constraint inventory_sales_recipe_components_item_unique unique (recipe_id, item_id)
);

create index if not exists inventory_sales_recipe_components_recipe_idx
  on public.inventory_sales_recipe_components (recipe_id, display_order, item_id);

create table if not exists public.inventory_channel_mappings (
  id uuid primary key default gen_random_uuid(),
  partner_source text not null check (partner_source in ('grabfood', 'shopeefood', 'xanhngon', 'other')),
  branch_uuid uuid not null,
  mapping_kind text not null default 'item' check (mapping_kind in ('item', 'option')),
  external_item_id text not null default '',
  external_item_name text not null,
  external_option_group text not null default '',
  external_option_name text not null default '',
  ignore_inventory boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  updated_by uuid not null default auth.uid(),
  constraint inventory_channel_mappings_option_shape check (
    (mapping_kind = 'item' and external_option_group = '' and external_option_name = '')
    or
    (mapping_kind = 'option' and external_option_group <> '' and external_option_name <> '')
  )
);

create unique index if not exists inventory_channel_mappings_identity_uidx
  on public.inventory_channel_mappings (
    partner_source,
    branch_uuid,
    mapping_kind,
    lower(btrim(external_item_id)),
    lower(btrim(external_item_name)),
    lower(btrim(external_option_group)),
    lower(btrim(external_option_name))
  );

create index if not exists inventory_channel_mappings_branch_source_idx
  on public.inventory_channel_mappings (branch_uuid, partner_source, status, updated_at desc);

create table if not exists public.inventory_channel_mapping_targets (
  id uuid primary key default gen_random_uuid(),
  mapping_id uuid not null references public.inventory_channel_mappings(id) on delete cascade,
  menu_entity_type text not null default 'product'
    check (menu_entity_type in ('product', 'topping')),
  menu_entity_id text not null,
  menu_entity_name text not null,
  quantity numeric(18,6) not null default 1 check (quantity > 0),
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  updated_by uuid not null default auth.uid(),
  constraint inventory_channel_mapping_targets_entity_unique
    unique (mapping_id, menu_entity_type, menu_entity_id)
);

create index if not exists inventory_channel_mapping_targets_mapping_idx
  on public.inventory_channel_mapping_targets (mapping_id, display_order, menu_entity_id);

create or replace function private.inventory_can_view_sales_branch(target_branch_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.inventory_can_manage_boms())
    or exists (
      select 1
      from public.inventory_user_access access
      join public.inventory_warehouses warehouse on warehouse.id = access.warehouse_id
      where access.auth_user_id = (select auth.uid())
        and access.is_active
        and warehouse.is_active
        and warehouse.deleted_at is null
        and (
          target_branch_uuid is null
          or warehouse.branch_uuid = target_branch_uuid
        )
    );
$$;

create or replace function private.inventory_prepare_sales_recipe_component()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.conversion_to_base := private.inventory_item_unit_to_base(new.item_id, new.unit_id);
  new.base_quantity := new.quantity * new.conversion_to_base * (1 + new.waste_percent / 100);
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

drop trigger if exists inventory_prepare_sales_recipe_component
  on public.inventory_sales_recipe_components;
create trigger inventory_prepare_sales_recipe_component
before insert or update of item_id, unit_id, quantity, waste_percent
on public.inventory_sales_recipe_components
for each row execute function private.inventory_prepare_sales_recipe_component();

create or replace function public.inventory_save_sales_recipe_draft(
  p_recipe_id uuid,
  p_menu_entity_type text,
  p_menu_entity_id text,
  p_menu_entity_name text,
  p_branch_uuid uuid,
  p_yield_quantity numeric,
  p_effective_from date,
  p_notes text,
  p_components jsonb
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
  if jsonb_typeof(coalesce(p_components, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_components, '[]'::jsonb)) = 0 then
    raise exception 'Định lượng món bán phải có ít nhất một thành phần.';
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
      version, yield_quantity, effective_from, notes, created_by, updated_by
    ) values (
      p_menu_entity_type, btrim(p_menu_entity_id), btrim(p_menu_entity_name), p_branch_uuid,
      v_version, p_yield_quantity, coalesce(p_effective_from, current_date), nullif(btrim(p_notes), ''), v_actor, v_actor
    ) returning id into v_recipe_id;
  else
    update public.inventory_sales_recipes
    set menu_entity_type = p_menu_entity_type,
        menu_entity_id = btrim(p_menu_entity_id),
        menu_entity_name = btrim(p_menu_entity_name),
        branch_uuid = p_branch_uuid,
        yield_quantity = p_yield_quantity,
        effective_from = coalesce(p_effective_from, current_date),
        notes = nullif(btrim(p_notes), ''),
        updated_at = now(),
        updated_by = v_actor
    where id = p_recipe_id and status = 'draft' and deleted_at is null
    returning id into v_recipe_id;
    if v_recipe_id is null then
      raise exception 'Chỉ công thức bản nháp mới được chỉnh sửa.';
    end if;
    delete from public.inventory_sales_recipe_components where recipe_id = v_recipe_id;
  end if;

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

  return v_recipe_id;
end;
$$;

create or replace function public.inventory_activate_sales_recipe(p_recipe_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_target public.inventory_sales_recipes%rowtype;
begin
  if v_actor is null or not (select private.inventory_can_manage_boms()) then
    raise exception 'Tài khoản chưa có quyền kích hoạt định lượng món bán.';
  end if;
  select * into v_target from public.inventory_sales_recipes
  where id = p_recipe_id and status = 'draft' and deleted_at is null for update;
  if not found then raise exception 'Không tìm thấy công thức bản nháp.'; end if;

  update public.inventory_sales_recipes
  set status = 'inactive', effective_to = current_date, updated_at = now(), updated_by = v_actor
  where menu_entity_type = v_target.menu_entity_type
    and menu_entity_id = v_target.menu_entity_id
    and branch_uuid is not distinct from v_target.branch_uuid
    and status = 'active'
    and deleted_at is null;

  update public.inventory_sales_recipes
  set status = 'active', effective_to = null, updated_at = now(), updated_by = v_actor
  where id = p_recipe_id;
  return p_recipe_id;
end;
$$;

create or replace function public.inventory_delete_sales_recipe_draft(p_recipe_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.inventory_can_manage_boms()) then
    raise exception 'Tài khoản chưa có quyền xóa định lượng món bán.';
  end if;
  delete from public.inventory_sales_recipes
  where id = p_recipe_id and status = 'draft' and deleted_at is null;
  if not found then raise exception 'Chỉ công thức bản nháp mới được xóa.'; end if;
  return true;
end;
$$;

create or replace function public.inventory_save_channel_mapping(
  p_mapping_id uuid,
  p_partner_source text,
  p_branch_uuid uuid,
  p_mapping_kind text,
  p_external_item_id text,
  p_external_item_name text,
  p_external_option_group text,
  p_external_option_name text,
  p_ignore_inventory boolean,
  p_notes text,
  p_targets jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_mapping_id uuid;
  v_target jsonb;
begin
  if v_actor is null or not (select private.inventory_can_manage_boms()) then
    raise exception 'Tài khoản chưa có quyền quản lý ánh xạ kênh bán.';
  end if;
  if p_partner_source not in ('grabfood', 'shopeefood', 'xanhngon', 'other') or p_branch_uuid is null then
    raise exception 'Vui lòng chọn kênh bán và chi nhánh.';
  end if;
  if p_mapping_kind not in ('item', 'option') or nullif(btrim(p_external_item_name), '') is null then
    raise exception 'Thông tin món trên app chưa hợp lệ.';
  end if;
  if p_mapping_kind = 'option' and (
    nullif(btrim(p_external_option_group), '') is null
    or nullif(btrim(p_external_option_name), '') is null
  ) then
    raise exception 'Vui lòng nhập đủ nhóm và lựa chọn của combo.';
  end if;
  if not coalesce(p_ignore_inventory, false) and (
    jsonb_typeof(coalesce(p_targets, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_targets, '[]'::jsonb)) = 0
  ) then
    raise exception 'Vui lòng gán ít nhất một món Menu hoặc chọn Không trừ kho.';
  end if;

  if p_mapping_id is null then
    insert into public.inventory_channel_mappings (
      partner_source, branch_uuid, mapping_kind, external_item_id, external_item_name,
      external_option_group, external_option_name, ignore_inventory, notes,
      created_by, updated_by
    ) values (
      p_partner_source, p_branch_uuid, p_mapping_kind, coalesce(btrim(p_external_item_id), ''),
      btrim(p_external_item_name),
      case when p_mapping_kind = 'option' then btrim(p_external_option_group) else '' end,
      case when p_mapping_kind = 'option' then btrim(p_external_option_name) else '' end,
      coalesce(p_ignore_inventory, false), nullif(btrim(p_notes), ''), v_actor, v_actor
    ) returning id into v_mapping_id;
  else
    update public.inventory_channel_mappings
    set partner_source = p_partner_source,
        branch_uuid = p_branch_uuid,
        mapping_kind = p_mapping_kind,
        external_item_id = coalesce(btrim(p_external_item_id), ''),
        external_item_name = btrim(p_external_item_name),
        external_option_group = case when p_mapping_kind = 'option' then btrim(p_external_option_group) else '' end,
        external_option_name = case when p_mapping_kind = 'option' then btrim(p_external_option_name) else '' end,
        ignore_inventory = coalesce(p_ignore_inventory, false),
        notes = nullif(btrim(p_notes), ''),
        updated_at = now(), updated_by = v_actor
    where id = p_mapping_id
    returning id into v_mapping_id;
    if v_mapping_id is null then raise exception 'Không tìm thấy ánh xạ kênh bán.'; end if;
    delete from public.inventory_channel_mapping_targets where mapping_id = v_mapping_id;
  end if;

  if not coalesce(p_ignore_inventory, false) then
    for v_target in select value from jsonb_array_elements(p_targets)
    loop
      insert into public.inventory_channel_mapping_targets (
        mapping_id, menu_entity_type, menu_entity_id, menu_entity_name,
        quantity, display_order, created_by, updated_by
      ) values (
        v_mapping_id,
        coalesce(nullif(v_target ->> 'menuEntityType', ''), 'product'),
        btrim(v_target ->> 'menuEntityId'),
        btrim(v_target ->> 'menuEntityName'),
        coalesce((v_target ->> 'quantity')::numeric, 1),
        coalesce((v_target ->> 'displayOrder')::integer, 0),
        v_actor,
        v_actor
      );
    end loop;
  end if;
  return v_mapping_id;
end;
$$;

create or replace function public.inventory_delete_channel_mapping(p_mapping_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select private.inventory_can_manage_boms()) then
    raise exception 'Tài khoản chưa có quyền xóa ánh xạ kênh bán.';
  end if;
  delete from public.inventory_channel_mappings where id = p_mapping_id;
  if not found then raise exception 'Không tìm thấy ánh xạ kênh bán.'; end if;
  return true;
end;
$$;

create or replace function public.inventory_read_channel_mapping_candidates(p_limit integer default 300)
returns table (
  candidate_kind text,
  partner_source text,
  branch_uuid uuid,
  external_item_id text,
  external_item_name text,
  external_option_group text,
  external_option_name text,
  occurrences bigint,
  last_seen timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with visible_lines as (
    select line.*
    from public.partner_order_items line
    where line.branch_uuid is not null
      and (select private.inventory_can_view_sales_branch(line.branch_uuid))
  ), item_candidates as (
    select
      'item'::text as candidate_kind,
      line.partner_source,
      line.branch_uuid,
      max(nullif(btrim(line.partner_item_id), '')) as external_item_id,
      line.partner_item_name as external_item_name,
      ''::text as external_option_group,
      ''::text as external_option_name,
      count(*)::bigint as occurrences,
      max(line.created_at) as last_seen
    from visible_lines line
    where nullif(btrim(line.partner_item_name), '') is not null
    group by line.partner_source, line.branch_uuid, line.partner_item_name
  ), option_candidates as (
    select
      'option'::text as candidate_kind,
      line.partner_source,
      line.branch_uuid,
      max(nullif(btrim(line.partner_item_id), '')) as external_item_id,
      line.partner_item_name as external_item_name,
      coalesce(nullif(btrim(option.value ->> 'option_name'), ''), nullif(btrim(option.value ->> 'groupName'), ''), 'Tùy chọn') as external_option_group,
      coalesce(nullif(btrim(option.value ->> 'option_item'), ''), nullif(btrim(option.value ->> 'name'), '')) as external_option_name,
      count(*)::bigint as occurrences,
      max(line.created_at) as last_seen
    from visible_lines line
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(line.options) = 'array' then line.options else '[]'::jsonb end
    ) option(value)
    where coalesce(nullif(btrim(option.value ->> 'option_item'), ''), nullif(btrim(option.value ->> 'name'), '')) is not null
    group by line.partner_source, line.branch_uuid, line.partner_item_name,
      coalesce(nullif(btrim(option.value ->> 'option_name'), ''), nullif(btrim(option.value ->> 'groupName'), ''), 'Tùy chọn'),
      coalesce(nullif(btrim(option.value ->> 'option_item'), ''), nullif(btrim(option.value ->> 'name'), ''))
  )
  select * from (
    select * from item_candidates
    union all
    select * from option_candidates
  ) candidates
  order by last_seen desc, occurrences desc
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
$$;

alter table public.inventory_sales_recipes enable row level security;
alter table public.inventory_sales_recipe_components enable row level security;
alter table public.inventory_channel_mappings enable row level security;
alter table public.inventory_channel_mapping_targets enable row level security;

drop policy if exists inventory_sales_recipes_select on public.inventory_sales_recipes;
create policy inventory_sales_recipes_select on public.inventory_sales_recipes
for select to authenticated
using (
  (select private.inventory_can_view_sales_branch(branch_uuid))
  and (deleted_at is null or (select private.inventory_can_manage_boms()))
);

drop policy if exists inventory_sales_recipes_insert on public.inventory_sales_recipes;
create policy inventory_sales_recipes_insert on public.inventory_sales_recipes
for insert to authenticated
with check ((select private.inventory_can_manage_boms()) and created_by = (select auth.uid()));

drop policy if exists inventory_sales_recipes_update on public.inventory_sales_recipes;
create policy inventory_sales_recipes_update on public.inventory_sales_recipes
for update to authenticated
using ((select private.inventory_can_manage_boms()))
with check ((select private.inventory_can_manage_boms()));

drop policy if exists inventory_sales_recipes_delete on public.inventory_sales_recipes;
create policy inventory_sales_recipes_delete on public.inventory_sales_recipes
for delete to authenticated
using ((select private.inventory_can_manage_boms()) and status = 'draft');

drop policy if exists inventory_sales_recipe_components_select on public.inventory_sales_recipe_components;
create policy inventory_sales_recipe_components_select on public.inventory_sales_recipe_components
for select to authenticated
using (exists (
  select 1 from public.inventory_sales_recipes recipe
  where recipe.id = recipe_id and (select private.inventory_can_view_sales_branch(recipe.branch_uuid))
));

drop policy if exists inventory_sales_recipe_components_write on public.inventory_sales_recipe_components;
drop policy if exists inventory_sales_recipe_components_insert on public.inventory_sales_recipe_components;
drop policy if exists inventory_sales_recipe_components_update on public.inventory_sales_recipe_components;
drop policy if exists inventory_sales_recipe_components_delete on public.inventory_sales_recipe_components;
create policy inventory_sales_recipe_components_insert on public.inventory_sales_recipe_components
for insert to authenticated
with check ((select private.inventory_can_manage_boms()) and created_by = (select auth.uid()));
create policy inventory_sales_recipe_components_update on public.inventory_sales_recipe_components
for update to authenticated
using ((select private.inventory_can_manage_boms()))
with check ((select private.inventory_can_manage_boms()));
create policy inventory_sales_recipe_components_delete on public.inventory_sales_recipe_components
for delete to authenticated
using ((select private.inventory_can_manage_boms()));

drop policy if exists inventory_channel_mappings_select on public.inventory_channel_mappings;
create policy inventory_channel_mappings_select on public.inventory_channel_mappings
for select to authenticated
using ((select private.inventory_can_view_sales_branch(branch_uuid)));

drop policy if exists inventory_channel_mappings_write on public.inventory_channel_mappings;
drop policy if exists inventory_channel_mappings_insert on public.inventory_channel_mappings;
drop policy if exists inventory_channel_mappings_update on public.inventory_channel_mappings;
drop policy if exists inventory_channel_mappings_delete on public.inventory_channel_mappings;
create policy inventory_channel_mappings_insert on public.inventory_channel_mappings
for insert to authenticated
with check ((select private.inventory_can_manage_boms()) and created_by = (select auth.uid()));
create policy inventory_channel_mappings_update on public.inventory_channel_mappings
for update to authenticated
using ((select private.inventory_can_manage_boms()))
with check ((select private.inventory_can_manage_boms()));
create policy inventory_channel_mappings_delete on public.inventory_channel_mappings
for delete to authenticated
using ((select private.inventory_can_manage_boms()));

drop policy if exists inventory_channel_mapping_targets_select on public.inventory_channel_mapping_targets;
create policy inventory_channel_mapping_targets_select on public.inventory_channel_mapping_targets
for select to authenticated
using (exists (
  select 1 from public.inventory_channel_mappings mapping
  where mapping.id = mapping_id and (select private.inventory_can_view_sales_branch(mapping.branch_uuid))
));

drop policy if exists inventory_channel_mapping_targets_write on public.inventory_channel_mapping_targets;
drop policy if exists inventory_channel_mapping_targets_insert on public.inventory_channel_mapping_targets;
drop policy if exists inventory_channel_mapping_targets_update on public.inventory_channel_mapping_targets;
drop policy if exists inventory_channel_mapping_targets_delete on public.inventory_channel_mapping_targets;
create policy inventory_channel_mapping_targets_insert on public.inventory_channel_mapping_targets
for insert to authenticated
with check ((select private.inventory_can_manage_boms()) and created_by = (select auth.uid()));
create policy inventory_channel_mapping_targets_update on public.inventory_channel_mapping_targets
for update to authenticated
using ((select private.inventory_can_manage_boms()))
with check ((select private.inventory_can_manage_boms()));
create policy inventory_channel_mapping_targets_delete on public.inventory_channel_mapping_targets
for delete to authenticated
using ((select private.inventory_can_manage_boms()));

revoke all on table public.inventory_sales_recipes from anon;
revoke all on table public.inventory_sales_recipe_components from anon;
revoke all on table public.inventory_channel_mappings from anon;
revoke all on table public.inventory_channel_mapping_targets from anon;
grant select, insert, update, delete on table public.inventory_sales_recipes to authenticated, service_role;
grant select, insert, update, delete on table public.inventory_sales_recipe_components to authenticated, service_role;
grant select, insert, update, delete on table public.inventory_channel_mappings to authenticated, service_role;
grant select, insert, update, delete on table public.inventory_channel_mapping_targets to authenticated, service_role;
grant usage, select on sequence public.inventory_sales_recipe_code_seq to authenticated, service_role;

revoke all on function private.inventory_can_view_sales_branch(uuid) from public, anon;
grant execute on function private.inventory_can_view_sales_branch(uuid) to authenticated, service_role;
revoke all on function public.inventory_save_sales_recipe_draft(uuid,text,text,text,uuid,numeric,date,text,jsonb) from public, anon;
revoke all on function public.inventory_activate_sales_recipe(uuid) from public, anon;
revoke all on function public.inventory_delete_sales_recipe_draft(uuid) from public, anon;
revoke all on function public.inventory_save_channel_mapping(uuid,text,uuid,text,text,text,text,text,boolean,text,jsonb) from public, anon;
revoke all on function public.inventory_delete_channel_mapping(uuid) from public, anon;
revoke all on function public.inventory_read_channel_mapping_candidates(integer) from public, anon;
grant execute on function public.inventory_save_sales_recipe_draft(uuid,text,text,text,uuid,numeric,date,text,jsonb) to authenticated, service_role;
grant execute on function public.inventory_activate_sales_recipe(uuid) to authenticated, service_role;
grant execute on function public.inventory_delete_sales_recipe_draft(uuid) to authenticated, service_role;
grant execute on function public.inventory_save_channel_mapping(uuid,text,uuid,text,text,text,text,text,boolean,text,jsonb) to authenticated, service_role;
grant execute on function public.inventory_delete_channel_mapping(uuid) to authenticated, service_role;
grant execute on function public.inventory_read_channel_mapping_candidates(integer) to authenticated, service_role;

notify pgrst, 'reload schema';
