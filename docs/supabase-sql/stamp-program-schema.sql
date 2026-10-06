-- Apply with stamp-program-functions.sql and stamp-program-orders.sql in one transaction.
-- Default OFF. No historical backfill. Does not change loyalty tables or rules.
create schema if not exists stamp_private;
revoke all on schema stamp_private from public, anon, authenticated;

create table if not exists stamp_private.program (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  starts_at timestamptz,
  gift_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);
insert into stamp_private.program(id) values(true) on conflict do nothing;
create table if not exists stamp_private.accounts (
  phone text primary key check(phone ~ '^0[35789][0-9]{8}$'),
  balance integer not null default 0,
  held integer not null default 0 check(held >= 0)
);
create table if not exists stamp_private.sources (
  source text not null,
  order_id text not null,
  phone text not null references stamp_private.accounts(phone),
  business_day date not null,
  active boolean not null,
  primary key(source,order_id)
);
create index if not exists stamp_sources_day on stamp_private.sources(phone,business_day) where active;
create table if not exists stamp_private.redemptions (
  order_id text primary key,
  phone text not null references stamp_private.accounts(phone),
  product_id text not null,
  state text not null check(state in ('held','redeemed','released')),
  branch_uuid uuid,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create table if not exists stamp_private.events (
  id bigint generated always as identity primary key,
  phone text not null references stamp_private.accounts(phone),
  kind text not null,
  delta integer not null,
  source text not null,
  order_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists stamp_events_phone_id on stamp_private.events(phone,id desc);
alter table stamp_private.program enable row level security;
alter table stamp_private.accounts enable row level security;
alter table stamp_private.sources enable row level security;
alter table stamp_private.redemptions enable row level security;
alter table stamp_private.events enable row level security;
revoke all on all tables in schema stamp_private from public,anon,authenticated;
revoke all on all sequences in schema stamp_private from public,anon,authenticated;

create or replace function stamp_private.phone(value text) returns text
language sql immutable set search_path = '' as $$
  select case when p ~ '^84[35789][0-9]{8}$' then '0'||substr(p,3) else p end
  from (select regexp_replace(coalesce(value,''),'[^0-9]','','g') p) n
$$;

-- Only active verified owners or operational profiles may read a customer's stamps.
create or replace function stamp_private.authorize(p_phone text, p_branch uuid default null, p_admin boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.auth_user_id=auth.uid()
      and coalesce(p.status,'active')='active'
      and (p.role='admin' or (not p_admin and (
        (p.role in ('staff','kitchen') and (p_branch is null or p.branch_uuid=p_branch))
        or (p.role='customer' and stamp_private.phone(p.phone)=p_phone)
      )))
  ) then raise exception 'STAMP_FORBIDDEN' using errcode='42501'; end if;
end $$;

create or replace function stamp_private.is_operator(p_branch uuid default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')='service_role'
    or (auth.uid() is null and session_user in ('postgres','supabase_admin') and coalesce(current_setting('request.jwt.claims',true),'')='')
    or exists(select 1 from public.profiles p where p.auth_user_id=auth.uid() and coalesce(p.status,'active')='active'
      and (p.role='admin' or (p.role in ('staff','kitchen') and p_branch is not null and p.branch_uuid=p_branch)))
$$;

create or replace function stamp_private.set_source(p_source text,p_id text,p_phone text,p_day date,p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare old_source stamp_private.sources; had_day boolean; has_day boolean;
begin
  if p_phone !~ '^0[35789][0-9]{8}$' then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('stamp:'||p_phone,0));
  insert into stamp_private.accounts(phone) values(p_phone) on conflict do nothing;
  select * into old_source from stamp_private.sources where source=p_source and order_id=p_id;
  -- Order customer/day is immutable once stamped; do not transfer earned stamps to another phone.
  if found and (old_source.phone<>p_phone or old_source.business_day<>p_day) then
    raise exception 'STAMP_ORDER_IDENTITY_CHANGED';
  end if;
  select exists(select 1 from stamp_private.sources where phone=p_phone and business_day=p_day and active) into had_day;
  insert into stamp_private.sources(source,order_id,phone,business_day,active)
    values(p_source,p_id,p_phone,p_day,p_active)
    on conflict(source,order_id) do update set active=excluded.active;
  select exists(select 1 from stamp_private.sources where phone=p_phone and business_day=p_day and active) into has_day;
  if had_day<>has_day then
    update stamp_private.accounts set balance=balance+case when has_day then 1 else -1 end where phone=p_phone;
    insert into stamp_private.events(phone,kind,delta,source,order_id)
      values(p_phone,case when has_day then 'earn' else 'reverse' end,case when has_day then 1 else -1 end,p_source,p_id);
  end if;
end $$;
revoke all on all functions in schema stamp_private from public,anon,authenticated;
