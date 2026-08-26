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
  with item_candidates as (
    select
      'item'::text as candidate_kind,
      catalog.partner_source,
      (array_agg(catalog.branch_uuid order by catalog.branch_uuid::text))[1] as branch_uuid,
      max(catalog.external_item_id) as external_item_id,
      max(regexp_replace(
        catalog.external_item_name,
        '[[:space:]]*\((tự trộn|trộn đều topping|trộn đều|trộn sẵn|để riêng tự trộn)\)[[:space:]]*$',
        '',
        'i'
      )) as external_item_name,
      ''::text as external_option_group,
      ''::text as external_option_name,
      sum(catalog.occurrences)::bigint as occurrences,
      max(catalog.last_seen) as last_seen
    from public.inventory_channel_catalog catalog
    where catalog.is_active
      and catalog.candidate_kind = 'item'
    group by
      catalog.partner_source,
      case when catalog.partner_source = 'shopeefood' then null::uuid else catalog.branch_uuid end,
      regexp_replace(
        catalog.item_name_key,
        '[[:space:]]*\((tự trộn|trộn đều topping|trộn đều|trộn sẵn|để riêng tự trộn)\)[[:space:]]*$',
        '',
        'i'
      )
  ), option_candidates as (
    select
      'option'::text as candidate_kind,
      catalog.partner_source,
      (array_agg(catalog.branch_uuid order by catalog.branch_uuid::text))[1] as branch_uuid,
      ''::text as external_item_id,
      '*'::text as external_item_name,
      max(catalog.external_option_group) as external_option_group,
      max(catalog.external_option_name) as external_option_name,
      sum(catalog.occurrences)::bigint as occurrences,
      max(catalog.last_seen) as last_seen
    from public.inventory_channel_catalog catalog
    where catalog.is_active
      and catalog.candidate_kind = 'option'
      and catalog.option_group_key not like '%cách chế biến%'
      and catalog.option_group_key not in ('mức độ cay', 'độ cay')
      and catalog.option_name_key not like '%trộn đều topping%'
      and catalog.option_name_key not like '%để riêng tự trộn%'
      and catalog.option_name_key not like '%không cay%'
      and catalog.option_name_key not like '%hơi cay%'
      and catalog.option_name_key not like '%cay vừa%'
      and catalog.option_name_key not like '%cay sấp mặt%'
    group by
      catalog.partner_source,
      case when catalog.partner_source = 'shopeefood' then null::uuid else catalog.branch_uuid end,
      catalog.option_group_key,
      catalog.option_name_key
  ), candidates as (
    select * from item_candidates
    union all
    select * from option_candidates
  )
  select *
  from candidates
  order by last_seen desc, occurrences desc
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
$$;

revoke all on function public.inventory_read_channel_mapping_candidates(integer) from public, anon;
grant execute on function public.inventory_read_channel_mapping_candidates(integer) to authenticated, service_role;

notify pgrst, 'reload schema';
