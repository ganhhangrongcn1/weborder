\set ON_ERROR_STOP on

begin;

create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists private;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$$;

create table if not exists auth.users (
  id uuid primary key
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table public.inventory_units (
  id uuid primary key,
  code text not null,
  name text not null,
  base_unit_id uuid,
  conversion_factor numeric(18,6) not null default 1,
  is_active boolean not null default true
);

create table public.inventory_items (
  id uuid primary key,
  code text not null,
  name text not null,
  item_type text not null,
  base_unit_id uuid not null references public.inventory_units(id),
  purchase_unit_id uuid references public.inventory_units(id),
  purchase_to_base_ratio numeric(18,6) not null default 1,
  is_active boolean not null default true,
  deleted_at timestamptz
);

create table public.inventory_warehouses (
  id uuid primary key,
  code text not null,
  name text not null,
  is_active boolean not null default true
);

create table public.inventory_user_access (
  auth_user_id uuid not null,
  role text not null,
  is_active boolean not null default true
);

create or replace function private.inventory_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select true $$;

create or replace function private.inventory_item_unit_to_base(p_item_id uuid, p_unit_id uuid)
returns numeric
language plpgsql
stable
set search_path = ''
as $$
declare
  v_item public.inventory_items%rowtype;
  v_unit public.inventory_units%rowtype;
begin
  select * into v_item from public.inventory_items where id = p_item_id;
  select * into v_unit from public.inventory_units where id = p_unit_id;
  if not found then raise exception 'Đơn vị không tồn tại.'; end if;
  if p_unit_id = v_item.base_unit_id then return 1; end if;
  if v_unit.base_unit_id = v_item.base_unit_id and v_unit.conversion_factor > 0 then
    return v_unit.conversion_factor;
  end if;
  if p_unit_id = v_item.purchase_unit_id and v_item.purchase_to_base_ratio > 0 then
    return v_item.purchase_to_base_ratio;
  end if;
  raise exception 'Đơn vị không cùng hệ quy đổi.';
end;
$$;

grant usage on schema private to authenticated;

\ir ../supabase/migrations/20260825085405_inventory_phase6a_multilevel_boms.sql

insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001');
insert into public.inventory_units(id, code, name) values
  ('00000000-0000-0000-0000-000000000010', 'GRAM', 'Gram');
insert into public.inventory_units(id, code, name, base_unit_id, conversion_factor) values
  ('00000000-0000-0000-0000-000000000011', 'KG', 'Kilôgam', '00000000-0000-0000-0000-000000000010', 1000);
insert into public.inventory_items(id, code, name, item_type, base_unit_id, purchase_unit_id, purchase_to_base_ratio) values
  ('00000000-0000-0000-0000-000000000020', 'NVL_1', 'Gia vị', 'raw_material', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000011', 1000),
  ('00000000-0000-0000-0000-000000000021', 'BTP_1', 'Gói bánh tráng gia vị', 'semi_finished', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000011', 1000),
  ('00000000-0000-0000-0000-000000000022', 'BTP_2', 'Bộ bánh tráng trộn', 'semi_finished', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000011', 1000);
insert into public.inventory_warehouses(id, code, name) values
  ('00000000-0000-0000-0000-000000000030', 'WH_CTR', 'Kho Tổng');
insert into public.inventory_user_access(auth_user_id, role) values
  ('00000000-0000-0000-0000-000000000001', 'admin');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

select public.inventory_save_bom_draft(
  null,
  '00000000-0000-0000-0000-000000000021',
  1,
  '00000000-0000-0000-0000-000000000011',
  'central',
  '00000000-0000-0000-0000-000000000030',
  current_date,
  'BOM đóng gói thử nghiệm',
  jsonb_build_array(jsonb_build_object(
    'componentItemId', '00000000-0000-0000-0000-000000000020',
    'quantity', 0.5,
    'unitId', '00000000-0000-0000-0000-000000000011',
    'wastePercent', 10,
    'displayOrder', 0
  ))
) as first_bom_id \gset

select public.inventory_activate_bom(:'first_bom_id'::uuid);

select public.inventory_save_bom_draft(
  null,
  '00000000-0000-0000-0000-000000000022',
  1,
  '00000000-0000-0000-0000-000000000011',
  'branch',
  null,
  current_date,
  'BOM nhiều cấp thử nghiệm',
  jsonb_build_array(jsonb_build_object(
    'componentItemId', '00000000-0000-0000-0000-000000000021',
    'quantity', 0.4,
    'unitId', '00000000-0000-0000-0000-000000000011',
    'wastePercent', 2,
    'displayOrder', 0
  ))
) as second_bom_id \gset

select public.inventory_activate_bom(:'second_bom_id'::uuid);

do $$
declare
  v_failed boolean := false;
begin
  begin
    perform public.inventory_save_bom_draft(
      null,
      '00000000-0000-0000-0000-000000000021',
      1,
      '00000000-0000-0000-0000-000000000011',
      'central',
      null,
      current_date,
      'BOM vòng lặp phải bị chặn',
      jsonb_build_array(jsonb_build_object(
        'componentItemId', '00000000-0000-0000-0000-000000000022',
        'quantity', 1,
        'unitId', '00000000-0000-0000-0000-000000000011',
        'wastePercent', 0,
        'displayOrder', 0
      ))
    );
  exception when others then
    if sqlerrm like '%vòng lặp%' then v_failed := true; else raise; end if;
  end;
  if not v_failed then raise exception 'BOM vòng lặp không bị chặn.'; end if;
end;
$$;

do $$
begin
  if (select count(*) from public.inventory_boms where status = 'active') <> 2 then
    raise exception 'Sai số BOM đang hoạt động.';
  end if;
  if (select yield_base_quantity from public.inventory_boms where output_item_id = '00000000-0000-0000-0000-000000000021' and status = 'active') <> 1000 then
    raise exception 'Sai quy đổi sản lượng BOM.';
  end if;
  if (
    select component.base_quantity
    from public.inventory_bom_components component
    join public.inventory_boms bom on bom.id = component.bom_id
    where bom.output_item_id = '00000000-0000-0000-0000-000000000021'
      and bom.status = 'active'
  ) <> 500 then
    raise exception 'Sai quy đổi thành phần BOM.';
  end if;
end;
$$;

reset role;
select 'inventory_bom_migration_smoke_ok' as result;
rollback;
