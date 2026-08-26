-- Bound partner history and evaluate inventory access once per request.
-- This keeps the mapping screen responsive while preserving branch isolation.
create index if not exists partner_order_items_created_at_desc_idx
  on public.partner_order_items (created_at desc);

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
security definer
set search_path = ''
as $$
  with access_context as materialized (
    select private.inventory_can_manage_boms() as can_manage
  ), allowed_branches as materialized (
    select distinct warehouse.branch_uuid
    from public.inventory_user_access access
    join public.inventory_warehouses warehouse on warehouse.id = access.warehouse_id
    where access.auth_user_id = (select auth.uid())
      and access.is_active
      and warehouse.is_active
      and warehouse.deleted_at is null
      and warehouse.branch_uuid is not null
  ), recent_lines as materialized (
    select
      line.partner_source,
      line.branch_uuid,
      line.partner_item_id,
      line.partner_item_name,
      line.options,
      line.created_at
    from public.partner_order_items line
    cross join access_context context
    where line.branch_uuid is not null
      and (
        context.can_manage
        or line.branch_uuid in (select allowed.branch_uuid from allowed_branches allowed)
      )
    order by line.created_at desc
    limit 15000
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
    from recent_lines line
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
    from recent_lines line
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

revoke all on function public.inventory_read_channel_mapping_candidates(integer) from public, anon;
grant execute on function public.inventory_read_channel_mapping_candidates(integer) to authenticated, service_role;

notify pgrst, 'reload schema';
