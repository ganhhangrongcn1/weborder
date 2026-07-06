-- Supabase Disk I/O hot-path indexes.
-- Safe to run in Supabase SQL Editor. These indexes support the read paths used by
-- kitchen board, admin orders, dashboard snapshots, and customer gift lookups.

create index if not exists orders_created_at_desc_idx
on public.orders (created_at desc);

create index if not exists orders_customer_phone_created_at_idx
on public.orders (customer_phone, created_at desc)
where customer_phone is not null and btrim(customer_phone) <> '';

create index if not exists partner_orders_order_time_desc_idx
on public.partner_orders (order_time desc);

create index if not exists partner_orders_customer_phone_key_order_time_idx
on public.partner_orders (customer_phone_key, order_time desc)
where customer_phone_key is not null and btrim(customer_phone_key) <> '';

create index if not exists partner_orders_customer_phone_order_time_idx
on public.partner_orders (customer_phone, order_time desc)
where customer_phone is not null and btrim(customer_phone) <> '';

create index if not exists partner_order_items_partner_order_id_idx
on public.partner_order_items (partner_order_id);
