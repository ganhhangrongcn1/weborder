-- Supabase setup cho trang Admin upload APK và trang /download.
-- Chạy trong Supabase SQL Editor nếu upload/read bị báo RLS hoặc bucket chưa có.

insert into storage.buckets (id, name, public)
values ('app-downloads', 'app-downloads', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read app downloads" on storage.objects;
create policy "Public read app downloads"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'app-downloads');

drop policy if exists "Authenticated upload app downloads" on storage.objects;
create policy "Authenticated upload app downloads"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'app-downloads');

drop policy if exists "Authenticated update app downloads" on storage.objects;
create policy "Authenticated update app downloads"
on storage.objects
for update
to authenticated
using (bucket_id = 'app-downloads')
with check (bucket_id = 'app-downloads');

drop policy if exists "Public read app download config" on public.app_configs;
create policy "Public read app download config"
on public.app_configs
for select
to anon, authenticated
using (id = 'ghr_app_downloads');

drop policy if exists "Authenticated write app download config" on public.app_configs;
create policy "Authenticated write app download config"
on public.app_configs
for insert
to authenticated
with check (id = 'ghr_app_downloads');

drop policy if exists "Authenticated update app download config" on public.app_configs;
create policy "Authenticated update app download config"
on public.app_configs
for update
to authenticated
using (id = 'ghr_app_downloads')
with check (id = 'ghr_app_downloads');
