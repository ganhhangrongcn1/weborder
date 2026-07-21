begin;

-- App release metadata stays publicly readable, but only admins may change it.
drop policy if exists "Authenticated update app download config" on public.app_configs;
drop policy if exists "Authenticated write app download config" on public.app_configs;
drop policy if exists "Public read app download config" on public.app_configs;
drop policy if exists app_configs_write_runtime on public.app_configs;
drop policy if exists catalog_public_write_app_configs on public.app_configs;

revoke insert, update, delete on public.app_configs from anon;

-- Public buckets already support public object URLs without a broad SELECT policy.
drop policy if exists "Public read app downloads" on storage.objects;
drop policy if exists "Authenticated upload app downloads" on storage.objects;
drop policy if exists "Authenticated update app downloads" on storage.objects;
drop policy if exists app_downloads_admin_insert on storage.objects;
drop policy if exists app_downloads_admin_update on storage.objects;
drop policy if exists app_downloads_admin_delete on storage.objects;

create policy app_downloads_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'app-downloads'
  and name like 'pos-printer/%'
  and lower(right(name, 4)) = '.apk'
  and public.has_app_role(array['admin'])
);

create policy app_downloads_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'app-downloads'
  and name like 'pos-printer/%'
  and public.has_app_role(array['admin'])
)
with check (
  bucket_id = 'app-downloads'
  and name like 'pos-printer/%'
  and lower(right(name, 4)) = '.apk'
  and public.has_app_role(array['admin'])
);

create policy app_downloads_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'app-downloads'
  and name like 'pos-printer/%'
  and public.has_app_role(array['admin'])
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'app-downloads',
  'app-downloads',
  true,
  157286400,
  array['application/vnd.android.package-archive']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';

commit;
