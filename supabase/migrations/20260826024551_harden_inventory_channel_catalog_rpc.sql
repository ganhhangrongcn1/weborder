drop index if exists public.inventory_channel_catalog_source_idx;

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
  select
    catalog.candidate_kind,
    catalog.partner_source,
    catalog.branch_uuid,
    catalog.external_item_id,
    catalog.external_item_name,
    catalog.external_option_group,
    catalog.external_option_name,
    catalog.occurrences,
    catalog.last_seen
  from public.inventory_channel_catalog catalog
  where catalog.is_active
  order by catalog.last_seen desc, catalog.occurrences desc
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
$$;

revoke all on function public.inventory_read_channel_mapping_candidates(integer) from public, anon;
grant execute on function public.inventory_read_channel_mapping_candidates(integer) to authenticated, service_role;

notify pgrst, 'reload schema';
