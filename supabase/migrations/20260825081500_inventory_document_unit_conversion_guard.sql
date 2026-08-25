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

  if v_unit.base_unit_id = v_item.base_unit_id and v_unit.conversion_factor > 0 then
    return v_unit.conversion_factor;
  end if;

  if p_unit_id = v_item.purchase_unit_id and v_item.purchase_to_base_ratio > 0 then
    return v_item.purchase_to_base_ratio;
  end if;

  raise exception 'Đơn vị tính không cùng hệ quy đổi với đơn vị tồn kho của nguyên vật liệu.';
end;
$$;

create or replace function private.inventory_normalize_document_line_unit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_document_type text;
  v_display_unit_id uuid;
begin
  if new.adjustment_direction is not null then
    select document.document_type
    into v_document_type
    from public.inventory_documents document
    where document.id = new.document_id;

    if v_document_type = 'stock_adjustment' then
      select coalesce(
        case
          when coalesce(item.metadata ->> 'display_unit_id', '')
            ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (item.metadata ->> 'display_unit_id')::uuid
        end,
        item.purchase_unit_id,
        item.base_unit_id
      )
      into v_display_unit_id
      from public.inventory_items item
      where item.id = new.item_id;

      new.unit_id := v_display_unit_id;
    end if;
  end if;

  new.conversion_to_base := private.inventory_item_unit_to_base(new.item_id, new.unit_id);
  return new;
end;
$$;

drop trigger if exists inventory_normalize_document_line_unit
on public.inventory_document_lines;

create trigger inventory_normalize_document_line_unit
before insert or update of item_id, unit_id, conversion_to_base, adjustment_direction
on public.inventory_document_lines
for each row
execute function private.inventory_normalize_document_line_unit();

revoke all on function private.inventory_item_unit_to_base(uuid, uuid) from public;
revoke all on function private.inventory_item_unit_to_base(uuid, uuid) from anon;
revoke all on function private.inventory_item_unit_to_base(uuid, uuid) from authenticated;
revoke all on function private.inventory_normalize_document_line_unit() from public;
revoke all on function private.inventory_normalize_document_line_unit() from anon;
revoke all on function private.inventory_normalize_document_line_unit() from authenticated;

grant execute on function private.inventory_item_unit_to_base(uuid, uuid) to authenticated;
grant execute on function private.inventory_normalize_document_line_unit() to authenticated;

notify pgrst, 'reload schema';
