-- Phase 6A: multi-level BOM definitions only.
-- This migration does not create production orders or change stock balances.

create sequence if not exists public.inventory_bom_code_seq;

create table if not exists public.inventory_boms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  output_item_id uuid not null,
  version integer not null,
  yield_quantity numeric(18,6) not null,
  yield_unit_id uuid not null,
  yield_conversion_to_base numeric(18,6) not null default 1,
  yield_base_quantity numeric(18,6) not null,
  production_scope text not null default 'central',
  default_warehouse_id uuid,
  effective_from date not null default current_date,
  effective_to date,
  status text not null default 'draft',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint inventory_boms_output_item_id_fkey
    foreign key (output_item_id) references public.inventory_items(id),
  constraint inventory_boms_yield_unit_id_fkey
    foreign key (yield_unit_id) references public.inventory_units(id),
  constraint inventory_boms_default_warehouse_id_fkey
    foreign key (default_warehouse_id) references public.inventory_warehouses(id),
  constraint inventory_boms_output_version_unique unique (output_item_id, version),
  constraint inventory_boms_version_check check (version > 0),
  constraint inventory_boms_yield_quantity_check check (yield_quantity > 0),
  constraint inventory_boms_yield_conversion_check check (yield_conversion_to_base > 0),
  constraint inventory_boms_yield_base_quantity_check check (yield_base_quantity > 0),
  constraint inventory_boms_production_scope_check
    check (production_scope in ('central', 'branch', 'department', 'any')),
  constraint inventory_boms_status_check
    check (status in ('draft', 'active', 'inactive')),
  constraint inventory_boms_effective_range_check
    check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.inventory_bom_components (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null,
  component_item_id uuid not null,
  quantity numeric(18,6) not null,
  unit_id uuid not null,
  conversion_to_base numeric(18,6) not null default 1,
  base_quantity numeric(18,6) not null,
  waste_percent numeric(7,4) not null default 0,
  display_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint inventory_bom_components_bom_id_fkey
    foreign key (bom_id) references public.inventory_boms(id) on delete cascade,
  constraint inventory_bom_components_component_item_id_fkey
    foreign key (component_item_id) references public.inventory_items(id),
  constraint inventory_bom_components_unit_id_fkey
    foreign key (unit_id) references public.inventory_units(id),
  constraint inventory_bom_components_item_unique unique (bom_id, component_item_id),
  constraint inventory_bom_components_quantity_check check (quantity > 0),
  constraint inventory_bom_components_conversion_check check (conversion_to_base > 0),
  constraint inventory_bom_components_base_quantity_check check (base_quantity > 0),
  constraint inventory_bom_components_waste_check check (waste_percent >= 0 and waste_percent <= 100),
  constraint inventory_bom_components_display_order_check check (display_order >= 0)
);

create unique index if not exists inventory_boms_one_active_output_idx
  on public.inventory_boms(output_item_id)
  where status = 'active' and deleted_at is null;

create index if not exists inventory_boms_status_effective_idx
  on public.inventory_boms(status, effective_from desc, output_item_id)
  where deleted_at is null;

create index if not exists inventory_boms_default_warehouse_idx
  on public.inventory_boms(default_warehouse_id)
  where default_warehouse_id is not null and deleted_at is null;

create index if not exists inventory_bom_components_bom_order_idx
  on public.inventory_bom_components(bom_id, display_order, created_at);

create index if not exists inventory_bom_components_item_idx
  on public.inventory_bom_components(component_item_id, bom_id);

create or replace function private.inventory_can_view_boms()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.inventory_is_admin())
    or exists (
      select 1
      from public.inventory_user_access access
      where access.auth_user_id = (select auth.uid())
        and access.is_active
    );
$$;

create or replace function private.inventory_can_manage_boms()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.inventory_is_admin())
    or exists (
      select 1
      from public.inventory_user_access access
      where access.auth_user_id = (select auth.uid())
        and access.is_active
        and access.role in ('owner', 'admin', 'central_manager')
    );
$$;

create or replace function private.inventory_prepare_bom()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_item_type text;
begin
  select item.item_type
  into v_item_type
  from public.inventory_items item
  where item.id = new.output_item_id
    and item.is_active
    and item.deleted_at is null;

  if not found or v_item_type <> 'semi_finished' then
    raise exception 'Đầu ra BOM phải là bán thành phẩm đang sử dụng.';
  end if;

  if tg_op = 'INSERT' then
    if nullif(btrim(new.code), '') is null then
      new.code := 'BOM-' || lpad(nextval('public.inventory_bom_code_seq')::text, 6, '0');
    else
      new.code := upper(btrim(new.code));
    end if;

    if new.version is null or new.version < 1 then
      select coalesce(max(bom.version), 0) + 1
      into new.version
      from public.inventory_boms bom
      where bom.output_item_id = new.output_item_id;
    end if;

    if new.status <> 'draft' then
      raise exception 'BOM mới phải bắt đầu ở trạng thái bản nháp.';
    end if;
  else
    if old.status = 'active' and (
      new.output_item_id is distinct from old.output_item_id
      or new.version is distinct from old.version
      or new.yield_quantity is distinct from old.yield_quantity
      or new.yield_unit_id is distinct from old.yield_unit_id
      or new.production_scope is distinct from old.production_scope
      or new.default_warehouse_id is distinct from old.default_warehouse_id
      or new.effective_from is distinct from old.effective_from
    ) then
      raise exception 'Không sửa cấu trúc BOM đang hoạt động. Hãy tạo phiên bản mới.';
    end if;

    new.code := upper(btrim(new.code));
  end if;

  new.yield_conversion_to_base := private.inventory_item_unit_to_base(
    new.output_item_id,
    new.yield_unit_id
  );
  new.yield_base_quantity := new.yield_quantity * new.yield_conversion_to_base;
  new.updated_at := now();

  if new.effective_to is not null and new.effective_to < new.effective_from then
    raise exception 'Ngày hết hiệu lực phải từ ngày bắt đầu hiệu lực trở đi.';
  end if;

  if tg_op = 'UPDATE' and new.status = 'active' and old.status <> 'active' and not exists (
    select 1
    from public.inventory_bom_components component
    where component.bom_id = new.id
  ) then
    raise exception 'BOM phải có ít nhất một thành phần trước khi kích hoạt.';
  end if;

  return new;
end;
$$;

create or replace function private.inventory_prepare_bom_component()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_output_item_id uuid;
  v_bom_status text;
begin
  select bom.output_item_id, bom.status
  into v_output_item_id, v_bom_status
  from public.inventory_boms bom
  where bom.id = new.bom_id
    and bom.deleted_at is null;

  if not found then
    raise exception 'Không tìm thấy BOM đang sử dụng.';
  end if;

  if v_bom_status <> 'draft' then
    raise exception 'Chỉ được sửa thành phần của BOM bản nháp.';
  end if;

  if new.component_item_id = v_output_item_id then
    raise exception 'Bán thành phẩm không thể dùng chính nó làm thành phần.';
  end if;

  perform 1
  from public.inventory_items item
  where item.id = new.component_item_id
    and item.is_active
    and item.deleted_at is null;

  if not found then
    raise exception 'Thành phần BOM không tồn tại hoặc đã ngừng sử dụng.';
  end if;

  if exists (
    with recursive descendants(item_id) as (
      select component.component_item_id
      from public.inventory_boms bom
      join public.inventory_bom_components component on component.bom_id = bom.id
      where bom.output_item_id = new.component_item_id
        and bom.deleted_at is null
        and bom.status in ('draft', 'active')

      union

      select component.component_item_id
      from descendants descendant
      join public.inventory_boms bom on bom.output_item_id = descendant.item_id
      join public.inventory_bom_components component on component.bom_id = bom.id
      where bom.deleted_at is null
        and bom.status in ('draft', 'active')
    )
    select 1
    from descendants
    where item_id = v_output_item_id
  ) then
    raise exception 'BOM tạo vòng lặp giữa các bán thành phẩm.';
  end if;

  new.conversion_to_base := private.inventory_item_unit_to_base(
    new.component_item_id,
    new.unit_id
  );
  new.base_quantity := new.quantity * new.conversion_to_base;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists inventory_boms_prepare on public.inventory_boms;
create trigger inventory_boms_prepare
before insert or update
on public.inventory_boms
for each row execute function private.inventory_prepare_bom();

drop trigger if exists inventory_bom_components_prepare on public.inventory_bom_components;
create trigger inventory_bom_components_prepare
before insert or update
on public.inventory_bom_components
for each row execute function private.inventory_prepare_bom_component();

create or replace function public.inventory_save_bom_draft(
  p_bom_id uuid,
  p_output_item_id uuid,
  p_yield_quantity numeric,
  p_yield_unit_id uuid,
  p_production_scope text,
  p_default_warehouse_id uuid,
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
  v_bom_id uuid;
  v_component jsonb;
begin
  if v_actor is null or not (select private.inventory_can_manage_boms()) then
    raise exception 'Bạn không có quyền quản lý công thức BOM.';
  end if;

  if jsonb_typeof(coalesce(p_components, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_components, '[]'::jsonb)) < 1 then
    raise exception 'BOM phải có ít nhất một thành phần.';
  end if;

  if p_bom_id is null then
    insert into public.inventory_boms (
      code,
      output_item_id,
      version,
      yield_quantity,
      yield_unit_id,
      production_scope,
      default_warehouse_id,
      effective_from,
      notes,
      status,
      created_by,
      updated_by
    ) values (
      '',
      p_output_item_id,
      null,
      p_yield_quantity,
      p_yield_unit_id,
      coalesce(nullif(btrim(p_production_scope), ''), 'central'),
      p_default_warehouse_id,
      coalesce(p_effective_from, current_date),
      nullif(btrim(p_notes), ''),
      'draft',
      v_actor,
      v_actor
    )
    returning id into v_bom_id;
  else
    select bom.id
    into v_bom_id
    from public.inventory_boms bom
    where bom.id = p_bom_id
      and bom.status = 'draft'
      and bom.deleted_at is null
    for update;

    if not found then
      raise exception 'Chỉ được sửa BOM bản nháp.';
    end if;

    update public.inventory_boms
    set output_item_id = p_output_item_id,
        yield_quantity = p_yield_quantity,
        yield_unit_id = p_yield_unit_id,
        production_scope = coalesce(nullif(btrim(p_production_scope), ''), 'central'),
        default_warehouse_id = p_default_warehouse_id,
        effective_from = coalesce(p_effective_from, current_date),
        notes = nullif(btrim(p_notes), ''),
        updated_by = v_actor
    where id = v_bom_id;

    delete from public.inventory_bom_components
    where bom_id = v_bom_id;
  end if;

  for v_component in
    select value from jsonb_array_elements(p_components)
  loop
    insert into public.inventory_bom_components (
      bom_id,
      component_item_id,
      quantity,
      unit_id,
      base_quantity,
      waste_percent,
      display_order,
      notes,
      created_by,
      updated_by
    ) values (
      v_bom_id,
      (v_component ->> 'componentItemId')::uuid,
      (v_component ->> 'quantity')::numeric,
      (v_component ->> 'unitId')::uuid,
      1,
      coalesce((v_component ->> 'wastePercent')::numeric, 0),
      coalesce((v_component ->> 'displayOrder')::integer, 0),
      nullif(btrim(v_component ->> 'notes'), ''),
      v_actor,
      v_actor
    );
  end loop;

  return v_bom_id;
end;
$$;

create or replace function public.inventory_activate_bom(p_bom_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_target public.inventory_boms%rowtype;
begin
  if v_actor is null or not (select private.inventory_can_manage_boms()) then
    raise exception 'Bạn không có quyền kích hoạt công thức BOM.';
  end if;

  select bom.*
  into v_target
  from public.inventory_boms bom
  where bom.id = p_bom_id
    and bom.status = 'draft'
    and bom.deleted_at is null
  for update;

  if not found then
    raise exception 'Không tìm thấy BOM bản nháp để kích hoạt.';
  end if;

  if not exists (
    select 1
    from public.inventory_bom_components component
    where component.bom_id = v_target.id
  ) then
    raise exception 'BOM phải có ít nhất một thành phần trước khi kích hoạt.';
  end if;

  update public.inventory_boms
  set status = 'inactive',
      effective_to = greatest(effective_from, v_target.effective_from - 1),
      updated_at = now(),
      updated_by = v_actor
  where output_item_id = v_target.output_item_id
    and status = 'active'
    and deleted_at is null
    and id <> v_target.id;

  update public.inventory_boms
  set status = 'active',
      effective_from = coalesce(effective_from, current_date),
      effective_to = null,
      updated_at = now(),
      updated_by = v_actor
  where id = v_target.id;

  return v_target.id;
end;
$$;

alter table public.inventory_boms enable row level security;
alter table public.inventory_bom_components enable row level security;

revoke all on table public.inventory_boms from public, anon, authenticated;
revoke all on table public.inventory_bom_components from public, anon, authenticated;
revoke all on sequence public.inventory_bom_code_seq from public, anon;

grant select, insert, update on table public.inventory_boms to authenticated;
grant select, insert, update, delete on table public.inventory_bom_components to authenticated;
grant usage, select on sequence public.inventory_bom_code_seq to authenticated;
grant all on table public.inventory_boms to service_role;
grant all on table public.inventory_bom_components to service_role;
grant usage, select on sequence public.inventory_bom_code_seq to service_role;

drop policy if exists inventory_boms_select on public.inventory_boms;
create policy inventory_boms_select
on public.inventory_boms for select to authenticated
using (
  (select private.inventory_can_view_boms())
  and (deleted_at is null or (select private.inventory_can_manage_boms()))
);

drop policy if exists inventory_boms_insert on public.inventory_boms;
create policy inventory_boms_insert
on public.inventory_boms for insert to authenticated
with check (
  status = 'draft'
  and created_by = (select auth.uid())
  and (select private.inventory_can_manage_boms())
);

drop policy if exists inventory_boms_update on public.inventory_boms;
create policy inventory_boms_update
on public.inventory_boms for update to authenticated
using ((select private.inventory_can_manage_boms()))
with check ((select private.inventory_can_manage_boms()));

drop policy if exists inventory_bom_components_select on public.inventory_bom_components;
create policy inventory_bom_components_select
on public.inventory_bom_components for select to authenticated
using (
  (select private.inventory_can_view_boms())
  and exists (
    select 1
    from public.inventory_boms bom
    where bom.id = bom_id
      and (bom.deleted_at is null or (select private.inventory_can_manage_boms()))
  )
);

drop policy if exists inventory_bom_components_insert on public.inventory_bom_components;
create policy inventory_bom_components_insert
on public.inventory_bom_components for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.inventory_can_manage_boms())
  and exists (
    select 1 from public.inventory_boms bom
    where bom.id = bom_id and bom.status = 'draft' and bom.deleted_at is null
  )
);

drop policy if exists inventory_bom_components_update on public.inventory_bom_components;
create policy inventory_bom_components_update
on public.inventory_bom_components for update to authenticated
using (
  (select private.inventory_can_manage_boms())
  and exists (
    select 1 from public.inventory_boms bom
    where bom.id = bom_id and bom.status = 'draft' and bom.deleted_at is null
  )
)
with check (
  (select private.inventory_can_manage_boms())
  and exists (
    select 1 from public.inventory_boms bom
    where bom.id = bom_id and bom.status = 'draft' and bom.deleted_at is null
  )
);

drop policy if exists inventory_bom_components_delete on public.inventory_bom_components;
create policy inventory_bom_components_delete
on public.inventory_bom_components for delete to authenticated
using (
  (select private.inventory_can_manage_boms())
  and exists (
    select 1 from public.inventory_boms bom
    where bom.id = bom_id and bom.status = 'draft' and bom.deleted_at is null
  )
);

revoke all on function private.inventory_can_view_boms() from public, anon;
revoke all on function private.inventory_can_manage_boms() from public, anon;
revoke all on function private.inventory_prepare_bom() from public, anon, authenticated;
revoke all on function private.inventory_prepare_bom_component() from public, anon, authenticated;
grant execute on function private.inventory_can_view_boms() to authenticated;
grant execute on function private.inventory_can_manage_boms() to authenticated;
grant execute on function private.inventory_can_view_boms() to service_role;
grant execute on function private.inventory_can_manage_boms() to service_role;

revoke all on function public.inventory_save_bom_draft(uuid, uuid, numeric, uuid, text, uuid, date, text, jsonb) from public, anon;
revoke all on function public.inventory_activate_bom(uuid) from public, anon;
grant execute on function public.inventory_save_bom_draft(uuid, uuid, numeric, uuid, text, uuid, date, text, jsonb) to authenticated;
grant execute on function public.inventory_activate_bom(uuid) to authenticated;
grant execute on function public.inventory_save_bom_draft(uuid, uuid, numeric, uuid, text, uuid, date, text, jsonb) to service_role;
grant execute on function public.inventory_activate_bom(uuid) to service_role;

notify pgrst, 'reload schema';
