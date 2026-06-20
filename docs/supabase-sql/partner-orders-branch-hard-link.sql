-- Hard link NexPOS partner orders to GHR admin branches.
-- Safe to run multiple times.
--
-- What this does:
-- 1. Ensures every admin branch has a stable branches.branch_uuid.
-- 2. Creates partner_branch_mappings for the 3 NexPOS hubs.
-- 3. Backfills partner_orders.branch_uuid and partner_order_items.branch_uuid.
-- 4. Adds triggers so new n8n upserts are linked automatically.

create extension if not exists pgcrypto;

alter table public.branches
add column if not exists branch_uuid uuid;

alter table public.branches
alter column branch_uuid set default gen_random_uuid();

update public.branches
set branch_uuid = gen_random_uuid()
where branch_uuid is null;

create unique index if not exists branches_branch_uuid_unique
on public.branches (branch_uuid);

alter table public.partner_orders
add column if not exists branch_uuid uuid;

alter table public.partner_order_items
add column if not exists branch_uuid uuid;

create table if not exists public.partner_branch_mappings (
  id uuid primary key default gen_random_uuid(),
  partner_system text not null default 'nexpos',
  branch_code text not null,
  branch_name text not null,
  nexpos_hub_id text not null,
  nexpos_site_id text not null default '',
  web_branch_uuid uuid not null references public.branches(branch_uuid) on update cascade on delete restrict,
  web_branch_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partner_branch_mappings_hub_unique
on public.partner_branch_mappings (partner_system, nexpos_hub_id);

create index if not exists partner_branch_mappings_site_idx
on public.partner_branch_mappings (partner_system, nexpos_site_id);

with nexpos_branches (
  branch_code,
  branch_name,
  nexpos_hub_id,
  nexpos_site_id,
  match_text
) as (
  values
    (
      'TQD',
      'Gánh Hàng Rong - Thích Quảng Đức',
      '69e589d15f07d302954e2f63',
      '69e58ef6162e5233d14e3162',
      'thich quang duc'
    ),
    (
      'LHP',
      'Gánh Hàng Rong - Lê Hồng Phong',
      '69e58a284b940f84934e2f85',
      '69e58f0f42928c0aee4e316f',
      'le hong phong'
    ),
    (
      '304',
      'Gánh Hàng Rong - 30/4',
      '69e18c814673b293b04be1ab',
      '69e194137bb514f91d4beca0',
      '30/4'
    )
),
matched_branches as (
  select
    n.branch_code,
    n.branch_name,
    n.nexpos_hub_id,
    n.nexpos_site_id,
    b.branch_uuid as web_branch_uuid,
    b.name as web_branch_name,
    row_number() over (
      partition by n.branch_code
      order by
        case when upper(coalesce(b.branch_code, '')) = n.branch_code then 0 else 1 end,
        case
          when lower(coalesce(b.name, '')) like '%' || n.match_text || '%'
            or lower(coalesce(b.address, '')) like '%' || n.match_text || '%'
            or lower(coalesce(b.slug, '')) like '%' || replace(n.match_text, ' ', '-') || '%'
          then 0
          else 1
        end,
        b.name
    ) as match_rank
  from nexpos_branches n
  join public.branches b
    on upper(coalesce(b.branch_code, '')) = n.branch_code
    or lower(coalesce(b.name, '')) like '%' || n.match_text || '%'
    or lower(coalesce(b.address, '')) like '%' || n.match_text || '%'
    or lower(coalesce(b.slug, '')) like '%' || replace(n.match_text, ' ', '-') || '%'
)
insert into public.partner_branch_mappings (
  partner_system,
  branch_code,
  branch_name,
  nexpos_hub_id,
  nexpos_site_id,
  web_branch_uuid,
  web_branch_name,
  updated_at
)
select
  'nexpos',
  branch_code,
  branch_name,
  nexpos_hub_id,
  nexpos_site_id,
  web_branch_uuid,
  web_branch_name,
  now()
from matched_branches
where match_rank = 1
on conflict (partner_system, nexpos_hub_id) do update
set
  branch_code = excluded.branch_code,
  branch_name = excluded.branch_name,
  nexpos_site_id = excluded.nexpos_site_id,
  web_branch_uuid = excluded.web_branch_uuid,
  web_branch_name = excluded.web_branch_name,
  updated_at = now();

create or replace function public.apply_partner_order_branch_mapping()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_mapping public.partner_branch_mappings%rowtype;
begin
  select *
  into v_mapping
  from public.partner_branch_mappings
  where partner_system = 'nexpos'
    and (
      (coalesce(new.nexpos_hub_id, '') <> '' and nexpos_hub_id = new.nexpos_hub_id)
      or (coalesce(new.nexpos_site_id, '') <> '' and nexpos_site_id = new.nexpos_site_id)
      or (coalesce(new.branch_code, '') <> '' and branch_code = new.branch_code)
    )
  order by
    case when coalesce(new.nexpos_hub_id, '') <> '' and nexpos_hub_id = new.nexpos_hub_id then 0 else 1 end,
    case when coalesce(new.nexpos_site_id, '') <> '' and nexpos_site_id = new.nexpos_site_id then 0 else 1 end
  limit 1;

  if found then
    new.branch_uuid := v_mapping.web_branch_uuid;
    new.branch_code := v_mapping.branch_code;
    new.branch_name := coalesce(nullif(v_mapping.web_branch_name, ''), v_mapping.branch_name, new.branch_name);
  end if;

  return new;
end;
$$;

create or replace function public.apply_partner_order_item_branch_mapping()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_order record;
  v_mapping public.partner_branch_mappings%rowtype;
begin
  select
    po.branch_uuid,
    po.branch_code,
    po.nexpos_hub_id,
    po.nexpos_site_id
  into v_order
  from public.partner_orders po
  where
    (new.partner_order_id is not null and po.id = new.partner_order_id)
    or (
      new.partner_order_id is null
      and coalesce(new.order_code, '') <> ''
      and po.order_code = new.order_code
    )
  limit 1;

  if found and v_order.branch_uuid is not null then
    new.branch_uuid := v_order.branch_uuid;
    new.branch_code := coalesce(nullif(v_order.branch_code, ''), new.branch_code);
    return new;
  end if;

  select *
  into v_mapping
  from public.partner_branch_mappings
  where partner_system = 'nexpos'
    and (
      (coalesce(new.nexpos_hub_id, '') <> '' and nexpos_hub_id = new.nexpos_hub_id)
      or (coalesce(new.nexpos_site_id, '') <> '' and nexpos_site_id = new.nexpos_site_id)
      or (coalesce(new.branch_code, '') <> '' and branch_code = new.branch_code)
    )
  order by
    case when coalesce(new.nexpos_hub_id, '') <> '' and nexpos_hub_id = new.nexpos_hub_id then 0 else 1 end,
    case when coalesce(new.nexpos_site_id, '') <> '' and nexpos_site_id = new.nexpos_site_id then 0 else 1 end
  limit 1;

  if found then
    new.branch_uuid := v_mapping.web_branch_uuid;
    new.branch_code := v_mapping.branch_code;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_partner_order_branch_mapping on public.partner_orders;
create trigger trg_apply_partner_order_branch_mapping
before insert or update of nexpos_hub_id, nexpos_site_id, branch_code, branch_uuid
on public.partner_orders
for each row
execute function public.apply_partner_order_branch_mapping();

drop trigger if exists trg_apply_partner_order_item_branch_mapping on public.partner_order_items;
create trigger trg_apply_partner_order_item_branch_mapping
before insert or update of partner_order_id, order_code, nexpos_hub_id, nexpos_site_id, branch_code, branch_uuid
on public.partner_order_items
for each row
execute function public.apply_partner_order_item_branch_mapping();

update public.partner_orders po
set
  branch_uuid = m.web_branch_uuid,
  branch_code = m.branch_code,
  branch_name = coalesce(nullif(m.web_branch_name, ''), m.branch_name, po.branch_name),
  updated_at = now()
from public.partner_branch_mappings m
where m.partner_system = 'nexpos'
  and (
    (coalesce(po.nexpos_hub_id, '') <> '' and po.nexpos_hub_id = m.nexpos_hub_id)
    or (coalesce(po.nexpos_site_id, '') <> '' and po.nexpos_site_id = m.nexpos_site_id)
    or (coalesce(po.branch_code, '') <> '' and po.branch_code = m.branch_code)
  );

update public.partner_order_items poi
set
  branch_uuid = po.branch_uuid,
  branch_code = po.branch_code
from public.partner_orders po
where
  (
    poi.partner_order_id = po.id
    or (
      coalesce(poi.order_code, '') <> ''
      and poi.order_code = po.order_code
    )
  )
  and po.branch_uuid is not null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'partner_orders'
      and constraint_name = 'partner_orders_branch_uuid_fkey'
  ) then
    alter table public.partner_orders
    add constraint partner_orders_branch_uuid_fkey
    foreign key (branch_uuid)
    references public.branches(branch_uuid)
    on update cascade
    on delete restrict;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'partner_order_items'
      and constraint_name = 'partner_order_items_branch_uuid_fkey'
  ) then
    alter table public.partner_order_items
    add constraint partner_order_items_branch_uuid_fkey
    foreign key (branch_uuid)
    references public.branches(branch_uuid)
    on update cascade
    on delete restrict;
  end if;
end $$;

select
  branch_code,
  branch_name,
  nexpos_hub_id,
  nexpos_site_id,
  web_branch_uuid,
  web_branch_name
from public.partner_branch_mappings
order by branch_code;

select
  po.branch_code,
  po.branch_name,
  count(*) as total_orders,
  count(*) filter (where po.branch_uuid is null) as missing_branch_link
from public.partner_orders po
group by po.branch_code, po.branch_name
order by po.branch_code, po.branch_name;

-- If TQD/LHP are still missing after the first run, run this fallback block.
-- It matches Vietnamese branch names with accents, then backfills again.

with fixed_branches (
  branch_code,
  branch_name,
  nexpos_hub_id,
  nexpos_site_id,
  web_branch_uuid,
  web_branch_name
) as (
  select
    'TQD',
    'Gánh Hàng Rong - Thích Quảng Đức',
    '69e589d15f07d302954e2f63',
    '69e58ef6162e5233d14e3162',
    b.branch_uuid,
    b.name
  from public.branches b
  where
    b.name ilike '%Thích Quảng Đức%'
    or b.address ilike '%Thích Quảng Đức%'
    or b.branch_code = 'TQD'
  limit 1
),
fixed_lhp as (
  select
    'LHP'::text as branch_code,
    'Gánh Hàng Rong - Lê Hồng Phong'::text as branch_name,
    '69e58a284b940f84934e2f85'::text as nexpos_hub_id,
    '69e58f0f42928c0aee4e316f'::text as nexpos_site_id,
    b.branch_uuid as web_branch_uuid,
    b.name as web_branch_name
  from public.branches b
  where
    b.name ilike '%Lê Hồng Phong%'
    or b.address ilike '%Lê Hồng Phong%'
    or b.branch_code = 'LHP'
  limit 1
),
all_fixed as (
  select * from fixed_branches
  union all
  select * from fixed_lhp
)
insert into public.partner_branch_mappings (
  partner_system,
  branch_code,
  branch_name,
  nexpos_hub_id,
  nexpos_site_id,
  web_branch_uuid,
  web_branch_name,
  updated_at
)
select
  'nexpos',
  branch_code,
  branch_name,
  nexpos_hub_id,
  nexpos_site_id,
  web_branch_uuid,
  web_branch_name,
  now()
from all_fixed
where web_branch_uuid is not null
on conflict (partner_system, nexpos_hub_id) do update
set
  branch_code = excluded.branch_code,
  branch_name = excluded.branch_name,
  nexpos_site_id = excluded.nexpos_site_id,
  web_branch_uuid = excluded.web_branch_uuid,
  web_branch_name = excluded.web_branch_name,
  updated_at = now();

update public.partner_orders po
set
  branch_uuid = m.web_branch_uuid,
  branch_code = m.branch_code,
  branch_name = coalesce(nullif(m.web_branch_name, ''), m.branch_name, po.branch_name),
  updated_at = now()
from public.partner_branch_mappings m
where m.partner_system = 'nexpos'
  and (
    (coalesce(po.nexpos_hub_id, '') <> '' and po.nexpos_hub_id = m.nexpos_hub_id)
    or (coalesce(po.nexpos_site_id, '') <> '' and po.nexpos_site_id = m.nexpos_site_id)
    or (coalesce(po.branch_code, '') <> '' and po.branch_code = m.branch_code)
  );

update public.partner_order_items poi
set
  branch_uuid = po.branch_uuid,
  branch_code = po.branch_code
from public.partner_orders po
where
  (
    poi.partner_order_id = po.id
    or (
      coalesce(poi.order_code, '') <> ''
      and poi.order_code = po.order_code
    )
  )
  and po.branch_uuid is not null;

select
  po.branch_code,
  po.branch_name,
  count(*) as total_orders,
  count(*) filter (where po.branch_uuid is null) as missing_branch_link
from public.partner_orders po
group by po.branch_code, po.branch_name
order by po.branch_code, po.branch_name;
