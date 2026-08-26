create table if not exists public.inventory_channel_catalog (
  id uuid primary key default gen_random_uuid(),
  partner_source text not null,
  branch_uuid uuid not null,
  candidate_kind text not null check (candidate_kind in ('item', 'option')),
  external_item_id text not null default '',
  external_item_name text not null,
  external_option_group text not null default '',
  external_option_name text not null default '',
  item_name_key text not null,
  option_group_key text not null default '',
  option_name_key text not null default '',
  occurrences bigint not null default 1 check (occurrences > 0),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_partner_order_item_id uuid,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_channel_catalog_identity_unique unique (
    partner_source,
    branch_uuid,
    candidate_kind,
    item_name_key,
    option_group_key,
    option_name_key
  )
);

create index if not exists inventory_channel_catalog_feed_idx
  on public.inventory_channel_catalog (
    branch_uuid,
    is_active,
    last_seen desc,
    occurrences desc
  );

create index if not exists inventory_channel_catalog_source_idx
  on public.inventory_channel_catalog (
    partner_source,
    branch_uuid,
    candidate_kind,
    last_seen desc
  );

alter table public.inventory_channel_catalog enable row level security;

drop policy if exists inventory_channel_catalog_select on public.inventory_channel_catalog;
create policy inventory_channel_catalog_select
on public.inventory_channel_catalog
for select
to authenticated
using ((select private.inventory_can_view_sales_branch(branch_uuid)));

revoke all on table public.inventory_channel_catalog from public, anon, authenticated;
grant select on table public.inventory_channel_catalog to authenticated, service_role;
grant insert, update, delete on table public.inventory_channel_catalog to service_role;

create or replace function private.inventory_normalize_channel_label(raw_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select regexp_replace(lower(btrim(raw_value)), '[[:space:]]+', ' ', 'g');
$$;

create or replace function private.inventory_capture_channel_catalog_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  option_row jsonb;
  item_name text := nullif(btrim(new.partner_item_name), '');
  item_name_key text;
  option_group text;
  option_name text;
  option_group_key text;
  option_name_key text;
  seen_at timestamptz := coalesce(new.created_at, now());
begin
  if new.branch_uuid is null or item_name is null then
    return new;
  end if;

  item_name_key := private.inventory_normalize_channel_label(item_name);

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
    item_name,
    item_name_key,
    1,
    seen_at,
    seen_at,
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

  for option_row in
    select value
    from jsonb_array_elements(
      case
        when jsonb_typeof(new.options) = 'array' then new.options
        else '[]'::jsonb
      end
    )
  loop
    option_name := coalesce(
      nullif(btrim(option_row ->> 'option_item'), ''),
      nullif(btrim(option_row ->> 'name'), '')
    );

    if option_name is null then
      continue;
    end if;

    option_group := coalesce(
      nullif(btrim(option_row ->> 'option_name'), ''),
      nullif(btrim(option_row ->> 'groupName'), ''),
      'Tùy chọn'
    );
    option_group_key := private.inventory_normalize_channel_label(option_group);
    option_name_key := private.inventory_normalize_channel_label(option_name);

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
      item_name,
      option_group,
      option_name,
      item_name_key,
      option_group_key,
      option_name_key,
      1,
      seen_at,
      seen_at,
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

drop trigger if exists inventory_capture_channel_catalog_item
  on public.partner_order_items;
create trigger inventory_capture_channel_catalog_item
after insert on public.partner_order_items
for each row execute function private.inventory_capture_channel_catalog_item();

revoke all on function private.inventory_normalize_channel_label(text) from public, anon, authenticated;
revoke all on function private.inventory_capture_channel_catalog_item() from public, anon, authenticated;
grant execute on function private.inventory_normalize_channel_label(text) to service_role;

with recent_lines as materialized (
  select
    line.id,
    line.partner_source,
    line.branch_uuid,
    line.partner_item_id,
    line.partner_item_name,
    line.options,
    line.created_at
  from public.partner_order_items line
  where line.branch_uuid is not null
    and nullif(btrim(line.partner_item_name), '') is not null
  order by line.created_at desc
  limit 15000
), item_candidates as (
  select
    line.partner_source,
    line.branch_uuid,
    'item'::text as candidate_kind,
    coalesce(max(nullif(btrim(line.partner_item_id), '')), '') as external_item_id,
    max(line.partner_item_name) as external_item_name,
    ''::text as external_option_group,
    ''::text as external_option_name,
    private.inventory_normalize_channel_label(line.partner_item_name) as item_name_key,
    ''::text as option_group_key,
    ''::text as option_name_key,
    count(*)::bigint as occurrences,
    min(line.created_at) as first_seen,
    max(line.created_at) as last_seen,
    (array_agg(line.id order by line.created_at desc))[1] as last_partner_order_item_id
  from recent_lines line
  group by
    line.partner_source,
    line.branch_uuid,
    private.inventory_normalize_channel_label(line.partner_item_name)
), option_candidates as (
  select
    line.partner_source,
    line.branch_uuid,
    'option'::text as candidate_kind,
    coalesce(max(nullif(btrim(line.partner_item_id), '')), '') as external_item_id,
    max(line.partner_item_name) as external_item_name,
    max(option_data.option_group) as external_option_group,
    max(option_data.option_name) as external_option_name,
    private.inventory_normalize_channel_label(line.partner_item_name) as item_name_key,
    private.inventory_normalize_channel_label(option_data.option_group) as option_group_key,
    private.inventory_normalize_channel_label(option_data.option_name) as option_name_key,
    count(*)::bigint as occurrences,
    min(line.created_at) as first_seen,
    max(line.created_at) as last_seen,
    (array_agg(line.id order by line.created_at desc))[1] as last_partner_order_item_id
  from recent_lines line
  cross join lateral (
    select
      coalesce(
        nullif(btrim(option_value ->> 'option_name'), ''),
        nullif(btrim(option_value ->> 'groupName'), ''),
        'Tùy chọn'
      ) as option_group,
      coalesce(
        nullif(btrim(option_value ->> 'option_item'), ''),
        nullif(btrim(option_value ->> 'name'), '')
      ) as option_name
    from jsonb_array_elements(
      case
        when jsonb_typeof(line.options) = 'array' then line.options
        else '[]'::jsonb
      end
    ) option_value
  ) option_data
  where option_data.option_name is not null
  group by
    line.partner_source,
    line.branch_uuid,
    private.inventory_normalize_channel_label(line.partner_item_name),
    private.inventory_normalize_channel_label(option_data.option_group),
    private.inventory_normalize_channel_label(option_data.option_name)
), candidates as (
  select * from item_candidates
  union all
  select * from option_candidates
)
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
)
select
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
from candidates
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
  occurrences = greatest(
    public.inventory_channel_catalog.occurrences,
    excluded.occurrences
  ),
  first_seen = least(
    public.inventory_channel_catalog.first_seen,
    excluded.first_seen
  ),
  last_seen = greatest(
    public.inventory_channel_catalog.last_seen,
    excluded.last_seen
  ),
  last_partner_order_item_id = case
    when excluded.last_seen >= public.inventory_channel_catalog.last_seen
      then excluded.last_partner_order_item_id
    else public.inventory_channel_catalog.last_partner_order_item_id
  end,
  is_active = true,
  updated_at = now();

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
    and (select private.inventory_can_view_sales_branch(catalog.branch_uuid))
  order by catalog.last_seen desc, catalog.occurrences desc
  limit greatest(1, least(coalesce(p_limit, 300), 1000));
$$;

revoke all on function public.inventory_read_channel_mapping_candidates(integer) from public, anon;
grant execute on function public.inventory_read_channel_mapping_candidates(integer) to authenticated, service_role;

notify pgrst, 'reload schema';
