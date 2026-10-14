create table if not exists public.nexpos_shadow_hubs (
  nexpos_hub_id text primary key,
  nexpos_hub_name text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.nexpos_shadow_hubs (nexpos_hub_id, nexpos_hub_name)
select distinct on (nexpos_hub_id)
  nexpos_hub_id,
  nullif(trim(nexpos_hub_name), '')
from public.partner_orders
where nullif(trim(nexpos_hub_id), '') is not null
order by nexpos_hub_id, order_time desc nulls last
on conflict (nexpos_hub_id) do update
set nexpos_hub_name = coalesce(excluded.nexpos_hub_name, nexpos_shadow_hubs.nexpos_hub_name),
    updated_at = now();

alter table public.nexpos_shadow_hubs enable row level security;
revoke all on table public.nexpos_shadow_hubs from anon, authenticated;
grant all on table public.nexpos_shadow_hubs to service_role;

notify pgrst, 'reload schema';
