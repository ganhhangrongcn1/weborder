-- Profile / Branch RPC - Phase 3
-- Muc tieu: tao write contract chuan cho profiles branch assignment.

create or replace function public.assign_operational_profile_branch(
  p_profile_id uuid,
  p_branch_uuid uuid default null,
  p_allow_global_admin boolean default false
)
returns table (
  ok boolean,
  message text,
  profile_id uuid,
  phone text,
  role text,
  status text,
  branch_uuid uuid,
  branch_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_branch public.branches%rowtype;
  v_role text;
  v_status text;
  v_metadata jsonb;
begin
  if p_profile_id is null then
    return query select false, 'Thiếu profile_id.', null::uuid, ''::text, ''::text, ''::text, null::uuid, ''::text;
    return;
  end if;

  select *
  into v_profile
  from public.profiles
  where id = p_profile_id
  for update;

  if not found then
    return query select false, 'Không tìm thấy profile.', null::uuid, ''::text, ''::text, ''::text, null::uuid, ''::text;
    return;
  end if;

  v_role := lower(trim(coalesce(v_profile.role, '')));
  v_status := lower(trim(coalesce(v_profile.status, 'active')));
  v_metadata := case
    when jsonb_typeof(v_profile.metadata) = 'object' then v_profile.metadata
    else '{}'::jsonb
  end;

  if p_branch_uuid is null then
    if v_role = 'admin' and p_allow_global_admin then
      v_metadata := v_metadata
        - 'branch_uuid'
        - 'branchUuid'
        - 'branch_name'
        - 'branchName'
        - 'branch_alias'
        - 'branchAlias';

      update public.profiles
      set
        branch_uuid = null,
        metadata = v_metadata,
        updated_at = now()
      where id = v_profile.id
      returning * into v_profile;

      return query
      select
        true,
        'Đã chuyển profile sang global admin.',
        v_profile.id,
        coalesce(v_profile.phone, ''),
        coalesce(v_profile.role, ''),
        coalesce(v_profile.status, ''),
        v_profile.branch_uuid,
        ''::text;
      return;
    end if;

    return query
    select
      false,
      'Staff/kitchen phải có branch_uuid. Chỉ admin global mới được để trống.',
      v_profile.id,
      coalesce(v_profile.phone, ''),
      coalesce(v_profile.role, ''),
      coalesce(v_profile.status, ''),
      v_profile.branch_uuid,
      ''::text;
    return;
  end if;

  select *
  into v_branch
  from public.branches
  where public.branches.branch_uuid = p_branch_uuid;

  if not found then
    return query
    select
      false,
      'branch_uuid không tồn tại trong bảng branches.',
      v_profile.id,
      coalesce(v_profile.phone, ''),
      coalesce(v_profile.role, ''),
      coalesce(v_profile.status, ''),
      v_profile.branch_uuid,
      ''::text;
    return;
  end if;

  v_metadata := jsonb_set(v_metadata, '{branch_uuid}', to_jsonb(v_branch.branch_uuid::text), true);
  v_metadata := jsonb_set(v_metadata, '{branch_name}', to_jsonb(coalesce(v_branch.name, '')), true);
  v_metadata := jsonb_set(v_metadata, '{branch_alias}', to_jsonb(lower(coalesce(v_branch.branch_code, ''))), true);

  update public.profiles
  set
    branch_uuid = v_branch.branch_uuid,
    metadata = v_metadata,
    updated_at = now()
  where id = v_profile.id
  returning * into v_profile;

  return query
  select
    true,
    'Đã cập nhật chi nhánh cho profile.',
    v_profile.id,
    coalesce(v_profile.phone, ''),
    coalesce(v_profile.role, ''),
    coalesce(v_profile.status, ''),
    v_profile.branch_uuid,
    coalesce(v_branch.name, '');
end;
$$;

create or replace function public.upsert_operational_profile(
  p_phone text,
  p_name text,
  p_role text,
  p_status text default 'active',
  p_branch_uuid uuid default null,
  p_email text default null,
  p_auth_user_id uuid default null,
  p_allow_global_admin boolean default false
)
returns table (
  ok boolean,
  message text,
  profile_id uuid,
  phone text,
  role text,
  status text,
  branch_uuid uuid,
  branch_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_name text;
  v_role text;
  v_status text;
  v_email text;
  v_profile public.profiles%rowtype;
  v_branch public.branches%rowtype;
  v_metadata jsonb := '{}'::jsonb;
begin
  v_phone := trim(coalesce(p_phone, ''));
  v_name := trim(coalesce(p_name, ''));
  v_role := lower(trim(coalesce(p_role, '')));
  v_status := lower(trim(coalesce(p_status, 'active')));
  v_email := nullif(lower(trim(coalesce(p_email, ''))), '');

  if v_phone = '' then
    return query select false, 'Thiếu số điện thoại profile.', null::uuid, ''::text, ''::text, ''::text, null::uuid, ''::text;
    return;
  end if;

  if v_role not in ('admin', 'staff', 'kitchen') then
    return query select false, 'Role không hợp lệ. Chỉ hỗ trợ admin/staff/kitchen.', null::uuid, v_phone, v_role, v_status, null::uuid, ''::text;
    return;
  end if;

  if v_status = '' then
    v_status := 'active';
  end if;

  if p_branch_uuid is null and not (v_role = 'admin' and p_allow_global_admin) then
    return query select false, 'Staff/kitchen phải có branch_uuid. Admin global mới được để trống.', null::uuid, v_phone, v_role, v_status, null::uuid, ''::text;
    return;
  end if;

  if p_branch_uuid is not null then
    select *
    into v_branch
    from public.branches
    where public.branches.branch_uuid = p_branch_uuid;

    if not found then
      return query select false, 'branch_uuid không tồn tại trong bảng branches.', null::uuid, v_phone, v_role, v_status, null::uuid, ''::text;
      return;
    end if;

    v_metadata := jsonb_set(v_metadata, '{branch_uuid}', to_jsonb(v_branch.branch_uuid::text), true);
    v_metadata := jsonb_set(v_metadata, '{branch_name}', to_jsonb(coalesce(v_branch.name, '')), true);
    v_metadata := jsonb_set(v_metadata, '{branch_alias}', to_jsonb(lower(coalesce(v_branch.branch_code, ''))), true);
  end if;

  insert into public.profiles (
    phone,
    name,
    email,
    auth_user_id,
    role,
    status,
    registered,
    branch_uuid,
    metadata,
    updated_at
  )
  values (
    v_phone,
    nullif(v_name, ''),
    v_email,
    p_auth_user_id,
    v_role,
    v_status,
    true,
    p_branch_uuid,
    v_metadata,
    now()
  )
  on conflict (phone) do update
  set
    name = coalesce(excluded.name, public.profiles.name),
    email = coalesce(excluded.email, public.profiles.email),
    auth_user_id = coalesce(excluded.auth_user_id, public.profiles.auth_user_id),
    role = excluded.role,
    status = excluded.status,
    registered = true,
    branch_uuid = excluded.branch_uuid,
    metadata = case
      when excluded.branch_uuid is null and excluded.role = 'admin' and p_allow_global_admin
        then coalesce(public.profiles.metadata, '{}'::jsonb)
          - 'branch_uuid'
          - 'branchUuid'
          - 'branch_name'
          - 'branchName'
          - 'branch_alias'
          - 'branchAlias'
      else coalesce(public.profiles.metadata, '{}'::jsonb) || excluded.metadata
    end,
    updated_at = now()
  returning * into v_profile;

  return query
  select
    true,
    'Đã lưu profile vận hành.',
    v_profile.id,
    coalesce(v_profile.phone, ''),
    coalesce(v_profile.role, ''),
    coalesce(v_profile.status, ''),
    v_profile.branch_uuid,
    coalesce(v_branch.name, '');
end;
$$;

grant execute on function public.assign_operational_profile_branch(uuid, uuid, boolean) to authenticated;
grant execute on function public.upsert_operational_profile(text, text, text, text, uuid, text, uuid, boolean) to authenticated;
