-- Khóa quyền đọc hàng loạt profiles trên customer runtime.
-- Customer chỉ đọc profile của chính mình sau khi đăng nhập.
-- Tra cứu trước đăng nhập đi qua RPC tối thiểu để giữ luồng đăng nhập bằng số điện thoại.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create schema if not exists loyalty_private;

create or replace function loyalty_private.is_active_staff(
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.auth_user_id = (select auth.uid())
        and lower(coalesce(p.status, '')) = 'active'
        and lower(coalesce(p.role, '')) = any(coalesce(p_roles, array[]::text[]))
    );
$$;

revoke execute on function loyalty_private.is_active_staff(text[])
from public, anon;
grant execute on function loyalty_private.is_active_staff(text[])
to authenticated;

create index if not exists profiles_auth_user_id_idx
on public.profiles (auth_user_id)
where auth_user_id is not null;

create or replace function public.get_customer_profile_login_hint(
  p_phone text
)
returns table (
  phone text,
  email text,
  registered boolean,
  role text,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.phone,
    p.email,
    p.registered,
    p.role,
    p.status
  from public.profiles p
  where p.phone = public.normalize_vietnam_phone(p_phone)
    and p.role = 'customer'
    and p.status <> 'blocked'
    and p.registered = true
    and nullif(trim(p.email), '') is not null
  limit 1;
$$;

revoke all on function public.get_customer_profile_login_hint(text)
from public, anon, authenticated;
grant execute on function public.get_customer_profile_login_hint(text)
to anon, authenticated, service_role;

create or replace function public.sync_own_customer_profile(
  p_phone text,
  p_name text default null,
  p_avatar_url text default null
)
returns table (
  ok boolean,
  profile_id uuid,
  phone text,
  registered boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_auth_email text := lower(trim(coalesce((select auth.jwt() ->> 'email'), '')));
  v_phone text := public.normalize_vietnam_phone(p_phone);
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_avatar_url text := nullif(trim(coalesce(p_avatar_url, '')), '');
  v_profile public.profiles%rowtype;
begin
  if v_auth_user_id is null then
    raise exception 'customer_auth_required'
      using errcode = '42501';
  end if;

  if v_phone = '' then
    raise exception 'customer_phone_invalid'
      using errcode = '22023';
  end if;

  select *
  into v_profile
  from public.profiles p
  where p.auth_user_id = v_auth_user_id
     or p.phone = v_phone
  order by case when p.auth_user_id = v_auth_user_id then 0 else 1 end
  limit 1
  for update;

  if found then
    if lower(coalesce(v_profile.role, 'customer')) <> 'customer'
      or lower(coalesce(v_profile.status, 'active')) = 'blocked'
      or (
        v_profile.auth_user_id is not null
        and v_profile.auth_user_id <> v_auth_user_id
      )
    then
      raise exception 'customer_profile_claim_denied'
        using errcode = '42501';
    end if;

    if v_profile.registered = true
      and v_profile.auth_user_id is null
      and nullif(lower(trim(coalesce(v_profile.email, ''))), '') is not null
      and lower(trim(v_profile.email)) <> v_auth_email
    then
      raise exception 'customer_profile_email_mismatch'
        using errcode = '42501';
    end if;

    update public.profiles p
    set
      auth_user_id = v_auth_user_id,
      name = coalesce(v_name, nullif(trim(p.name), ''), ''),
      email = coalesce(nullif(v_auth_email, ''), p.email),
      avatar_url = coalesce(v_avatar_url, nullif(trim(p.avatar_url), ''), ''),
      registered = true,
      role = 'customer',
      status = 'active',
      updated_at = now()
    where p.id = v_profile.id
    returning * into v_profile;
  else
    insert into public.profiles (
      auth_user_id,
      phone,
      name,
      email,
      avatar_url,
      registered,
      role,
      status,
      metadata,
      created_at,
      updated_at
    )
    values (
      v_auth_user_id,
      v_phone,
      coalesce(v_name, ''),
      v_auth_email,
      coalesce(v_avatar_url, ''),
      true,
      'customer',
      'active',
      '{}'::jsonb,
      now(),
      now()
    )
    returning * into v_profile;
  end if;

  return query
  select true, v_profile.id, v_profile.phone, v_profile.registered;
end;
$$;

revoke all on function public.sync_own_customer_profile(text, text, text)
from public, anon, authenticated;
grant execute on function public.sync_own_customer_profile(text, text, text)
to authenticated, service_role;

create or replace function loyalty_private.sync_web_order_customer_stub()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_name text;
begin
  v_phone := public.normalize_vietnam_phone(new.customer_phone);
  v_name := nullif(trim(coalesce(new.customer_name, '')), '');

  if v_phone = '' then
    return new;
  end if;

  insert into public.profiles (
    phone,
    name,
    registered,
    role,
    status,
    metadata,
    created_at,
    updated_at
  )
  values (
    v_phone,
    coalesce(v_name, ''),
    false,
    'customer',
    'active',
    jsonb_build_object(
      'source_table', 'orders',
      'lastOrderAt', coalesce(new.created_at, now()),
      'profileAutoSyncedAt', now()
    ),
    now(),
    now()
  )
  on conflict (phone) do update
  set
    name = case
      when nullif(trim(public.profiles.name), '') is null
        then coalesce(excluded.name, public.profiles.name)
      else public.profiles.name
    end,
    metadata = coalesce(public.profiles.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'source_table', 'orders',
        'lastOrderAt', coalesce(new.created_at, now()),
        'profileAutoSyncedAt', now()
      ),
    updated_at = now()
  where public.profiles.role = 'customer';

  return new;
end;
$$;

revoke all on function loyalty_private.sync_web_order_customer_stub()
from public, anon, authenticated, service_role;

drop trigger if exists trg_sync_customer_profile_from_orders
on public.orders;
drop trigger if exists trg_sync_web_order_customer_stub
on public.orders;

create trigger trg_sync_web_order_customer_stub
after insert or update of customer_phone, customer_name
on public.orders
for each row
execute function loyalty_private.sync_web_order_customer_stub();

comment on function public.get_customer_profile_login_hint(text) is
  'Tra cứu tối thiểu một profile đã đăng ký để giữ luồng đăng nhập bằng số điện thoại; không trả metadata, auth_user_id hoặc password_demo.';
comment on function public.sync_own_customer_profile(text, text, text) is
  'Đồng bộ profile customer của chính auth user hiện tại và không cho ghi profile vận hành.';
comment on function loyalty_private.sync_web_order_customer_stub() is
  'Tạo/cập nhật customer stub sau khi website order được ghi, thay cho quyền ghi profiles trực tiếp của anon.';

notify pgrst, 'reload schema';

commit;
