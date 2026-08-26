create or replace function private.inventory_capture_channel_catalog_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_option_row jsonb;
  v_item_name text := nullif(btrim(new.partner_item_name), '');
  v_item_name_key text;
  v_option_group text;
  v_option_name text;
  v_option_group_key text;
  v_option_name_key text;
  v_seen_at timestamptz := coalesce(new.created_at, now());
begin
  if new.branch_uuid is null or v_item_name is null then
    return new;
  end if;

  v_item_name_key := private.inventory_normalize_channel_label(v_item_name);

  insert into public.inventory_channel_catalog (
    partner_source,
    branch_uuid,
    candidate_kind,
    external_item_id,
    external_item_name,
    item_name_key,
    occurrences,
    first_seen,
    last_seen,
    last_partner_order_item_id
  ) values (
    new.partner_source,
    new.branch_uuid,
    'item',
    coalesce(nullif(btrim(new.partner_item_id), ''), ''),
    v_item_name,
    v_item_name_key,
    1,
    v_seen_at,
    v_seen_at,
    new.id
  )
  on conflict (
    partner_source,
    branch_uuid,
    candidate_kind,
    item_name_key,
    option_group_key,
    option_name_key
  ) do update set
    external_item_id = coalesce(
      nullif(excluded.external_item_id, ''),
      public.inventory_channel_catalog.external_item_id
    ),
    external_item_name = excluded.external_item_name,
    occurrences = public.inventory_channel_catalog.occurrences + 1,
    first_seen = least(public.inventory_channel_catalog.first_seen, excluded.first_seen),
    last_seen = greatest(public.inventory_channel_catalog.last_seen, excluded.last_seen),
    last_partner_order_item_id = excluded.last_partner_order_item_id,
    is_active = true,
    updated_at = now();

  for v_option_row in
    select value
    from jsonb_array_elements(
      case
        when jsonb_typeof(new.options) = 'array' then new.options
        else '[]'::jsonb
      end
    )
  loop
    v_option_name := coalesce(
      nullif(btrim(v_option_row ->> 'option_item'), ''),
      nullif(btrim(v_option_row ->> 'name'), '')
    );

    if v_option_name is null then
      continue;
    end if;

    v_option_group := coalesce(
      nullif(btrim(v_option_row ->> 'option_name'), ''),
      nullif(btrim(v_option_row ->> 'groupName'), ''),
      'Tùy chọn'
    );
    v_option_group_key := private.inventory_normalize_channel_label(v_option_group);
    v_option_name_key := private.inventory_normalize_channel_label(v_option_name);

    insert into public.inventory_channel_catalog (
      partner_source,
      branch_uuid,
      candidate_kind,
      external_item_id,
      external_item_name,
      external_option_group,
      external_option_name,
      item_name_key,
      option_group_key,
      option_name_key,
      occurrences,
      first_seen,
      last_seen,
      last_partner_order_item_id
    ) values (
      new.partner_source,
      new.branch_uuid,
      'option',
      coalesce(nullif(btrim(new.partner_item_id), ''), ''),
      v_item_name,
      v_option_group,
      v_option_name,
      v_item_name_key,
      v_option_group_key,
      v_option_name_key,
      1,
      v_seen_at,
      v_seen_at,
      new.id
    )
    on conflict (
      partner_source,
      branch_uuid,
      candidate_kind,
      item_name_key,
      option_group_key,
      option_name_key
    ) do update set
      external_item_id = coalesce(
        nullif(excluded.external_item_id, ''),
        public.inventory_channel_catalog.external_item_id
      ),
      external_item_name = excluded.external_item_name,
      external_option_group = excluded.external_option_group,
      external_option_name = excluded.external_option_name,
      occurrences = public.inventory_channel_catalog.occurrences + 1,
      first_seen = least(public.inventory_channel_catalog.first_seen, excluded.first_seen),
      last_seen = greatest(public.inventory_channel_catalog.last_seen, excluded.last_seen),
      last_partner_order_item_id = excluded.last_partner_order_item_id,
      is_active = true,
      updated_at = now();
  end loop;

  return new;
end;
$$;

comment on function private.inventory_capture_channel_catalog_item() is
  'Ghi nhận món và tùy chọn đối tác vào danh mục ánh xạ kho; dùng tên biến riêng để tránh xung đột với tên cột.';
