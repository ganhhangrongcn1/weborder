-- Inventory Phase 3 P0: Techres-style settings forms, backward compatible.
-- Existing columns and write policies remain unchanged.

alter table public.inventory_units
  add column if not exists symbol text,
  add column if not exists base_unit_id uuid,
  add column if not exists conversion_factor numeric(18, 6) not null default 1,
  add column if not exists display_order integer not null default 0;

alter table public.inventory_units
  drop constraint if exists inventory_units_base_unit_id_fkey,
  add constraint inventory_units_base_unit_id_fkey
    foreign key (base_unit_id)
    references public.inventory_units(id)
    on delete restrict;

alter table public.inventory_units
  drop constraint if exists inventory_units_conversion_factor_check,
  add constraint inventory_units_conversion_factor_check
    check (
      (base_unit_id is null and conversion_factor = 1)
      or (base_unit_id is not null and conversion_factor > 0)
    ),
  drop constraint if exists inventory_units_base_unit_not_self_check,
  add constraint inventory_units_base_unit_not_self_check
    check (base_unit_id is null or base_unit_id <> id),
  drop constraint if exists inventory_units_display_order_check,
  add constraint inventory_units_display_order_check
    check (display_order >= 0);

create index if not exists inventory_units_base_unit_idx
  on public.inventory_units(base_unit_id)
  where base_unit_id is not null;

create index if not exists inventory_units_display_order_idx
  on public.inventory_units(display_order, name)
  where is_active and deleted_at is null;

create or replace function private.inventory_validate_unit_conversion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_type text;
  parent_base_unit_id uuid;
begin
  if new.base_unit_id is null then
    if exists (
      select 1
      from public.inventory_units child
      where child.base_unit_id = new.id
        and child.unit_type <> new.unit_type
        and child.deleted_at is null
    ) then
      raise exception 'Không thể đổi loại đo lường vì đang có đơn vị quy đổi liên kết.'
        using errcode = '23514';
    end if;
    return new;
  end if;

  select unit_type, base_unit_id
  into parent_type, parent_base_unit_id
  from public.inventory_units
  where id = new.base_unit_id
    and deleted_at is null;

  if not found then
    raise exception 'Đơn vị gốc không tồn tại hoặc đã ngừng sử dụng.'
      using errcode = '23503';
  end if;

  if parent_base_unit_id is not null then
    raise exception 'Đơn vị quy đổi phải liên kết trực tiếp với một đơn vị gốc.'
      using errcode = '23514';
  end if;

  if new.unit_type <> parent_type then
    raise exception 'Đơn vị quy đổi phải cùng loại đo lường với đơn vị gốc.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.inventory_validate_unit_conversion() from public, anon;
grant execute on function private.inventory_validate_unit_conversion() to authenticated, service_role;

drop trigger if exists inventory_units_validate_conversion on public.inventory_units;
create trigger inventory_units_validate_conversion
before insert or update of base_unit_id, unit_type, deleted_at on public.inventory_units
for each row
execute function private.inventory_validate_unit_conversion();

alter table public.inventory_item_groups
  add column if not exists description text,
  add column if not exists display_order integer not null default 0;

alter table public.inventory_item_groups
  drop constraint if exists inventory_item_groups_display_order_check,
  add constraint inventory_item_groups_display_order_check
    check (display_order >= 0);

create index if not exists inventory_item_groups_display_order_idx
  on public.inventory_item_groups(display_order, name)
  where is_active and deleted_at is null;

alter table public.inventory_items
  drop constraint if exists inventory_items_item_type_check,
  add constraint inventory_items_item_type_check
    check (item_type in (
      'ingredient',
      'semi_finished',
      'finished_good',
      'packaging',
      'consumable',
      'other'
    ));

create sequence if not exists public.inventory_item_code_seq;

revoke all on sequence public.inventory_item_code_seq from public, anon;
grant usage, select on sequence public.inventory_item_code_seq to authenticated, service_role;

create or replace function private.inventory_assign_item_code()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  item_prefix text;
begin
  if nullif(btrim(new.code), '') is not null then
    new.code := upper(btrim(new.code));
    return new;
  end if;

  item_prefix := case new.item_type
    when 'ingredient' then 'NVL'
    when 'semi_finished' then 'BTP'
    when 'finished_good' then 'TP'
    when 'packaging' then 'BB'
    when 'consumable' then 'VT'
    else 'KHAC'
  end;

  new.code := item_prefix || '-' || lpad(
    nextval('public.inventory_item_code_seq')::text,
    6,
    '0'
  );
  return new;
end;
$$;

revoke all on function private.inventory_assign_item_code() from public, anon;
grant execute on function private.inventory_assign_item_code() to authenticated, service_role;

drop trigger if exists inventory_items_assign_code on public.inventory_items;
create trigger inventory_items_assign_code
before insert or update of code on public.inventory_items
for each row
execute function private.inventory_assign_item_code();

notify pgrst, 'reload schema';
