-- Item identity must retain preparation variants. No historical stock replay.
create or replace function private.inventory_sales_full_item_name(p_value text)
returns text language sql immutable security invoker set search_path = ''
as $function$
  select lower(btrim(regexp_replace(normalize(coalesce(p_value, ''), NFC), '[[:space:]]+', ' ', 'g')));
$function$;
revoke all on function private.inventory_sales_full_item_name(text) from public, anon, authenticated;

create or replace function private.inventory_resolve_channel_item_mapping(
  p_source text, p_branch uuid, p_item_id text, p_item_name text
) returns uuid language plpgsql stable security invoker set search_path = ''
as $function$
declare
  v_ids uuid[];
begin
  -- Shopee mappings are intentionally shared across branches in this application.
  -- Exact branch wins within the same identity tier; no updated_at tie-break.
  with candidates as (
    select m.id,
      case when nullif(btrim(p_item_id), '') is not null
        and nullif(btrim(m.external_item_id), '') = btrim(p_item_id) then 0 else 1 end identity_rank,
      case when m.branch_uuid = p_branch then 0 else 1 end scope_rank
    from public.inventory_channel_mappings m
    where m.status = 'active' and m.mapping_kind = 'item'
      and m.partner_source = lower(btrim(p_source))
      and (m.branch_uuid = p_branch or m.partner_source = 'shopeefood')
      and (
        (nullif(btrim(p_item_id), '') is not null
          and nullif(btrim(m.external_item_id), '') = btrim(p_item_id))
        or (
          (nullif(btrim(p_item_id), '') is null or nullif(btrim(m.external_item_id), '') is null)
          and private.inventory_sales_full_item_name(p_item_name) <> ''
          and private.inventory_sales_full_item_name(m.external_item_name)
            = private.inventory_sales_full_item_name(p_item_name)
        )
      )
  ), ranked as (
    select id, dense_rank() over(order by identity_rank, scope_rank) priority from candidates
  )
  select array_agg(id) into v_ids from ranked where priority = 1;
  if coalesce(cardinality(v_ids), 0) > 1 then
    raise exception using errcode = 'P0001',
      message = 'Món "' || coalesce(p_item_name, '') || '" khớp nhiều cấu hình gán món. Vui lòng kiểm tra; chưa trừ kho.';
  end if;
  return v_ids[1];
end;
$function$;
revoke all on function private.inventory_resolve_channel_item_mapping(text, uuid, text, text) from public, anon, authenticated;

-- Patch only partner main-item matching; preserve the live processor including
-- deduction switches, reversal/idempotency, recipe expansion and lot movements.
do $migration$
declare
  v_definition text;
  v_expected text := $needle$      select mapping.* into v_mapping
      from public.inventory_channel_mappings mapping
      where mapping.partner_source = lower(btrim(v_line.partner_source))
        and mapping.mapping_kind = 'item' and mapping.status = 'active'
        and (mapping.partner_source = 'shopeefood' or mapping.branch_uuid = v_event.branch_uuid)
        and (
          (nullif(btrim(mapping.external_item_id), '') is not null and nullif(btrim(v_line.partner_item_id), '') = btrim(mapping.external_item_id))
          or private.inventory_sales_normalize_text(mapping.external_item_name) = private.inventory_sales_normalize_text(v_line.partner_item_name)
        )
      order by (mapping.branch_uuid = v_event.branch_uuid) desc, mapping.updated_at desc
      limit 1;$needle$;
  v_replacement text := $replacement$      select mapping.* into v_mapping
      from public.inventory_channel_mappings mapping
      where mapping.id = private.inventory_resolve_channel_item_mapping(
        v_line.partner_source, v_event.branch_uuid,
        v_line.partner_item_id, v_line.partner_item_name
      );$replacement$;
begin
  select pg_get_functiondef('private.inventory_process_sales_event(uuid)'::regprocedure) into v_definition;
  if position(v_replacement in v_definition) = 0 then
    if position(v_expected in v_definition) = 0 then
      raise exception 'Unexpected sales processor definition; strict mapping migration stopped.';
    end if;
    execute replace(v_definition, v_expected, v_replacement);
  end if;
end;
$migration$;

-- Keep the mapping picker from merging self-mix with prepared products.
-- The public invoker function uses built-ins, not a newly exposed private helper.
do $migration$
declare
  v_definition text;
  v_expected text := $needle$      regexp_replace(
        catalog.item_name_key,
        '[[:space:]]*\((tự trộn|trộn đều topping|trộn đều|trộn sẵn|để riêng tự trộn)\)[[:space:]]*$',
        '',
        'i'
      )$needle$;
  v_replacement text := $replacement$      nullif(btrim(catalog.external_item_id), ''),
      lower(btrim(regexp_replace(normalize(coalesce(catalog.external_item_name, ''), NFC), '[[:space:]]+', ' ', 'g')))$replacement$;
begin
  select pg_get_functiondef('public.inventory_read_channel_mapping_candidates(integer)'::regprocedure) into v_definition;
  if position(v_replacement in v_definition) = 0 then
    if position(v_expected in v_definition) = 0 then
      raise exception 'Unexpected mapping candidate definition; strict mapping migration stopped.';
    end if;
    execute replace(v_definition, v_expected, v_replacement);
  end if;
end;
$migration$;
notify pgrst, 'reload schema';
