grant select on table public.app_configs to service_role;

notify pgrst, 'reload schema';
