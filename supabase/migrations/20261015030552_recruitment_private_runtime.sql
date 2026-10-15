-- Private server configuration; no browser or authenticated user access.
create schema if not exists recruitment_private;
revoke all on schema recruitment_private from public, anon, authenticated;
grant usage on schema recruitment_private to service_role;
create table if not exists recruitment_private.runtime_config (
  id boolean primary key default true check(id),
  config jsonb not null
);
alter table recruitment_private.runtime_config enable row level security;
revoke all on recruitment_private.runtime_config from public, anon, authenticated;
grant select on recruitment_private.runtime_config to service_role;
insert into recruitment_private.runtime_config(id, config) values(true, jsonb_build_object(
  'RECRUITMENT_HASH_SECRET', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'RECRUITMENT_N8N_WEBHOOK_SECRET', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'RECRUITMENT_DISPATCH_SECRET', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  'RECRUITMENT_INTAKE_ENABLED', 'false',
  'RECRUITMENT_NOTIFICATIONS_ENABLED', 'false',
  'RECRUITMENT_N8N_WEBHOOK_URL', 'https://n8nhosting-13007771.phoai.vn/webhook/ghr-recruitment-5f4ff68e-39e2-45bc-a80b-f53a4bd401b8',
  'RECRUITMENT_ALLOWED_ORIGINS', 'https://ganhhangrong.vn,https://www.ganhhangrong.vn,https://weborder-git-feat-recrui-acee8f-ganhhangrong1992-3578s-projects.vercel.app'
)) on conflict(id) do nothing;
create or replace function public.get_recruitment_runtime_config()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select config from recruitment_private.runtime_config where id = true $$;
revoke all on function public.get_recruitment_runtime_config() from public, anon, authenticated;
grant execute on function public.get_recruitment_runtime_config() to service_role;
notify pgrst, 'reload schema';
