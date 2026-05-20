-- Partner order branch fields for NexPOS mapping.
-- Safe to run multiple times.

alter table public.partner_orders
add column if not exists nexpos_order_id text not null default '';

alter table public.partner_orders
add column if not exists nexpos_status text not null default '';

alter table public.partner_orders
add column if not exists nexpos_hub_id text not null default '';

alter table public.partner_orders
add column if not exists nexpos_hub_name text not null default '';

alter table public.partner_orders
add column if not exists nexpos_site_id text not null default '';

alter table public.partner_orders
add column if not exists nexpos_site_name text not null default '';

alter table public.partner_orders
add column if not exists branch_code text not null default '';

alter table public.partner_orders
add column if not exists branch_uuid uuid;

alter table public.partner_order_items
add column if not exists nexpos_hub_id text not null default '';

alter table public.partner_order_items
add column if not exists nexpos_site_id text not null default '';

alter table public.partner_order_items
add column if not exists branch_code text not null default '';

alter table public.partner_order_items
add column if not exists branch_uuid uuid;

create index if not exists partner_orders_nexpos_order_id_idx
on public.partner_orders (nexpos_order_id);

create index if not exists partner_orders_nexpos_status_idx
on public.partner_orders (nexpos_status);

create index if not exists partner_orders_nexpos_hub_id_idx
on public.partner_orders (nexpos_hub_id);

create index if not exists partner_orders_nexpos_site_id_idx
on public.partner_orders (nexpos_site_id);

create index if not exists partner_orders_branch_code_idx
on public.partner_orders (branch_code);

create index if not exists partner_orders_branch_uuid_idx
on public.partner_orders (branch_uuid);

create index if not exists partner_order_items_branch_code_idx
on public.partner_order_items (branch_code);

create index if not exists partner_order_items_branch_uuid_idx
on public.partner_order_items (branch_uuid);
