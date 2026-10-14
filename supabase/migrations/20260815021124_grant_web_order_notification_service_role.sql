-- Website Zalo notification delivery is server-only.
-- Keep browser roles locked out while allowing Edge Functions to claim and update events.
alter table public.web_order_notifications enable row level security;

revoke all on table public.web_order_notifications from anon;
revoke all on table public.web_order_notifications from authenticated;

grant select, insert, update on table public.web_order_notifications to service_role;

notify pgrst, 'reload schema';
