-- Keep "ngưng bán" separate from "không trừ kho".
-- Inactive mappings hide historical catalog candidates but are not treated as
-- active no-deduction mappings when a new order unexpectedly contains the item.

create or replace function public.inventory_save_channel_mapping_v2(
  p_mapping_id uuid,
  p_partner_source text,
  p_branch_uuid uuid,
  p_mapping_kind text,
  p_external_item_id text,
  p_external_item_name text,
  p_external_option_group text,
  p_external_option_name text,
  p_ignore_inventory boolean,
  p_status text,
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
  v_status text := case when p_status = 'inactive' then 'inactive' else 'active' end;
  v_ignore_inventory boolean;
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
  if jsonb_typeof(coalesce(p_targets, '[]'::jsonb)) <> 'array' then
    raise exception 'Danh sách món Menu không hợp lệ.';
  end if;

  v_ignore_inventory := case
    when v_status = 'inactive' then false
    else coalesce(p_ignore_inventory, false)
  end;

  if v_status = 'active' and not v_ignore_inventory
    and jsonb_array_length(coalesce(p_targets, '[]'::jsonb)) = 0 then
    raise exception 'Vui lòng gán ít nhất một món Menu hoặc chọn Không trừ kho.';
  end if;

  if p_mapping_id is null then
    insert into public.inventory_channel_mappings (
      partner_source, branch_uuid, mapping_kind, external_item_id, external_item_name,
      external_option_group, external_option_name, ignore_inventory, status, notes,
      created_by, updated_by
    ) values (
      p_partner_source, p_branch_uuid, p_mapping_kind, coalesce(btrim(p_external_item_id), ''),
      btrim(p_external_item_name),
      case when p_mapping_kind = 'option' then btrim(p_external_option_group) else '' end,
      case when p_mapping_kind = 'option' then btrim(p_external_option_name) else '' end,
      v_ignore_inventory, v_status, nullif(btrim(p_notes), ''), v_actor, v_actor
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
        ignore_inventory = v_ignore_inventory,
        status = v_status,
        notes = nullif(btrim(p_notes), ''),
        updated_at = now(),
        updated_by = v_actor
    where id = p_mapping_id
    returning id into v_mapping_id;
    if v_mapping_id is null then
      raise exception 'Không tìm thấy ánh xạ kênh bán.';
    end if;
    delete from public.inventory_channel_mapping_targets where mapping_id = v_mapping_id;
  end if;

  if v_status = 'active' and not v_ignore_inventory then
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

revoke all on function public.inventory_save_channel_mapping_v2(uuid,text,uuid,text,text,text,text,text,boolean,text,text,jsonb) from public, anon;
grant execute on function public.inventory_save_channel_mapping_v2(uuid,text,uuid,text,text,text,text,text,boolean,text,text,jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
