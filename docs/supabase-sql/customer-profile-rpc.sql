-- Customer Profile RPC - Phase 3A
-- Muc tieu: tao write contract chuan cho customer stub profile.
-- Rule:
-- - Co giao dich that thi co the tao/cap nhat stub profile customer.
-- - Khong duoc tu y set registered = true chi vi co order.
-- - Neu phone da thuoc profile van hanh (admin/staff/kitchen) thi khong hydrate nham sang customer.

create or replace function public.normalize_vietnam_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');

  if v_digits = '' then
    return '';
  end if;

  if v_digits like '0084%' then
    v_digits := '0' || substr(v_digits, 5);
  elsif v_digits like '84%' then
    v_digits := '0' || substr(v_digits, 3);
  elsif length(v_digits) = 9 then
    v_digits := '0' || v_digits;
  end if;

  if v_digits ~ '^0[0-9]{9}$' then
    return v_digits;
  end if;

  return '';
end;
$$;

create or replace function public.upsert_customer_stub_profile(
  p_phone text,
  p_name text default null,
  p_source text default null,
  p_source_ref text default null
)
returns table (
  ok boolean,
  message text,
  profile_id uuid,
  phone text,
  role text,
  registered boolean,
  created_new boolean,
  source_tag text,
  hydrated_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_name text;
  v_source text;
  v_source_ref text;
  v_profile public.profiles%rowtype;
  v_metadata jsonb;
  v_existing_role text;
  v_safe_name text;
  v_created_new boolean := false;
begin
  v_phone := public.normalize_vietnam_phone(p_phone);
  v_name := nullif(trim(coalesce(p_name, '')), '');
  v_source := nullif(lower(trim(coalesce(p_source, ''))), '');
  v_source_ref := nullif(trim(coalesce(p_source_ref, '')), '');

  if v_phone = '' then
    return query
    select
      false,
      'So dien thoai khong hop le de tao customer stub profile.',
      null::uuid,
      ''::text,
      ''::text,
      false,
      false,
      coalesce(v_source, ''),
      coalesce(v_name, '');
    return;
  end if;

  select *
  into v_profile
  from public.profiles
  where public.profiles.phone = v_phone
  for update;

  if found then
    v_existing_role := lower(trim(coalesce(v_profile.role, 'customer')));

    if v_existing_role in ('admin', 'staff', 'kitchen') then
      return query
      select
        false,
        'Phone nay dang thuoc profile van hanh, khong hydrate customer stub.',
        v_profile.id,
        v_profile.phone,
        coalesce(v_profile.role, ''),
        coalesce(v_profile.registered, false),
        false,
        coalesce(v_source, ''),
        coalesce(v_profile.name, '');
      return;
    end if;

    v_metadata := case
      when jsonb_typeof(v_profile.metadata) = 'object' then v_profile.metadata
      else '{}'::jsonb
    end;

    if not (v_metadata ? 'customer_source_first') and v_source is not null then
      v_metadata := jsonb_set(v_metadata, '{customer_source_first}', to_jsonb(v_source), true);
    end if;

    if v_source is not null then
      v_metadata := jsonb_set(v_metadata, '{customer_source_latest}', to_jsonb(v_source), true);
    end if;

    if v_source_ref is not null then
      v_metadata := jsonb_set(v_metadata, '{customer_source_ref_latest}', to_jsonb(v_source_ref), true);
    end if;

    v_metadata := jsonb_set(v_metadata, '{customer_stub}', 'true'::jsonb, true);
    v_metadata := jsonb_set(v_metadata, '{customer_stub_last_synced_at}', to_jsonb(now()), true);

    v_safe_name := coalesce(nullif(trim(coalesce(v_profile.name, '')), ''), v_name);

    if lower(trim(coalesce(v_safe_name, ''))) in (
      '',
      'khach',
      'khach hang',
      'khach vang lai',
      'khách',
      'khách hàng',
      'khách vãng lai'
    ) and v_name is not null then
      v_safe_name := v_name;
    end if;

    update public.profiles
    set
      role = coalesce(nullif(trim(coalesce(role, '')), ''), 'customer'),
      status = coalesce(nullif(trim(coalesce(status, '')), ''), 'active'),
      name = nullif(trim(coalesce(v_safe_name, '')), ''),
      metadata = v_metadata,
      updated_at = now()
    where id = v_profile.id
    returning * into v_profile;
  else
    v_metadata := '{}'::jsonb;

    if v_source is not null then
      v_metadata := jsonb_set(v_metadata, '{customer_source_first}', to_jsonb(v_source), true);
      v_metadata := jsonb_set(v_metadata, '{customer_source_latest}', to_jsonb(v_source), true);
    end if;

    if v_source_ref is not null then
      v_metadata := jsonb_set(v_metadata, '{customer_source_ref_latest}', to_jsonb(v_source_ref), true);
    end if;

    v_metadata := jsonb_set(v_metadata, '{customer_stub}', 'true'::jsonb, true);
    v_metadata := jsonb_set(v_metadata, '{customer_stub_last_synced_at}', to_jsonb(now()), true);

    insert into public.profiles (
      phone,
      name,
      role,
      status,
      registered,
      metadata,
      updated_at
    )
    values (
      v_phone,
      v_name,
      'customer',
      'active',
      false,
      v_metadata,
      now()
    )
    returning * into v_profile;

    v_created_new := true;
  end if;

  return query
  select
    true,
    case
      when v_created_new then 'Da tao customer stub profile.'
      else 'Da cap nhat customer stub profile.'
    end,
    v_profile.id,
    coalesce(v_profile.phone, ''),
    coalesce(v_profile.role, ''),
    coalesce(v_profile.registered, false),
    v_created_new,
    coalesce(v_source, ''),
    coalesce(v_profile.name, '');
end;
$$;

grant execute on function public.normalize_vietnam_phone(text) to anon, authenticated;
grant execute on function public.upsert_customer_stub_profile(text, text, text, text) to authenticated;
