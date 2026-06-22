-- Loyalty program - Phase 3 runtime engine.
-- Adds annual tier state, whole-balance expiry, milestone vouchers and 50% redemption enforcement.

begin;

alter table public.loyalty_accounts
  add column if not exists tier_id text null,
  add column if not exists tier_cycle_year integer null,
  add column if not exists tier_qualifying_spend numeric not null default 0,
  add column if not exists tier_qualified_at timestamptz null,
  add column if not exists last_purchase_at timestamptz null,
  add column if not exists points_expires_at timestamptz null;

alter table public.orders
  add column if not exists loyalty_tier_id text null,
  add column if not exists loyalty_earn_numerator bigint null,
  add column if not exists loyalty_earn_denominator bigint null;

alter table public.partner_orders
  add column if not exists loyalty_tier_id text null,
  add column if not exists loyalty_earn_numerator bigint null,
  add column if not exists loyalty_earn_denominator bigint null;

create index if not exists loyalty_accounts_tier_cycle_idx
on public.loyalty_accounts (tier_cycle_year, tier_id);

create index if not exists loyalty_accounts_points_expiry_idx
on public.loyalty_accounts (points_expires_at)
where points_expires_at is not null and total_points > 0;

create table if not exists public.loyalty_milestone_grants (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  tier_id text not null,
  cycle_year integer not null,
  coupon_id text not null,
  voucher_data jsonb not null default '{}'::jsonb,
  granted_at timestamptz not null default now(),
  rule_version_id uuid null references public.loyalty_rule_versions(id) on delete restrict,
  constraint loyalty_milestone_grants_business_key
    unique (customer_phone, tier_id, cycle_year),
  constraint loyalty_milestone_grants_cycle_year_check
    check (cycle_year between 2020 and 2200)
);

create index if not exists loyalty_milestone_grants_phone_idx
on public.loyalty_milestone_grants (customer_phone, granted_at desc);

alter table public.loyalty_milestone_grants enable row level security;

drop policy if exists loyalty_milestone_grants_customer_read on public.loyalty_milestone_grants;
create policy loyalty_milestone_grants_customer_read
on public.loyalty_milestone_grants
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and public.normalize_vietnam_phone(p.phone) = customer_phone
  )
  or exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and lower(coalesce(p.role, '')) in ('admin', 'staff')
      and lower(coalesce(p.status, 'active')) = 'active'
  )
);

grant select on public.loyalty_milestone_grants to authenticated;
revoke insert, update, delete on public.loyalty_milestone_grants from public, anon, authenticated;

alter table public.loyalty_ledger
  drop constraint if exists loyalty_ledger_v2_action_check;

alter table public.loyalty_ledger
  add constraint loyalty_ledger_v2_action_check
  check (
    action is null
    or action in (
      'SPEND', 'SETTLE_EARN', 'REVERSE_SPEND', 'REVERSE_EARN',
      'CLAIM_PARTNER_EARN', 'CHECKIN', 'MILESTONE', 'ADMIN_ADJUST',
      'EXPIRE_POINTS'
    )
  ) not valid;

alter table public.loyalty_ledger
  drop constraint if exists loyalty_ledger_v2_sign_check;

alter table public.loyalty_ledger
  add constraint loyalty_ledger_v2_sign_check
  check (
    action is null
    or (action in ('SETTLE_EARN', 'REVERSE_SPEND', 'CLAIM_PARTNER_EARN', 'CHECKIN', 'MILESTONE') and points > 0)
    or (action in ('SPEND', 'REVERSE_EARN', 'EXPIRE_POINTS') and points < 0)
    or (action = 'ADMIN_ADJUST' and points <> 0)
  ) not valid;

create or replace function loyalty_private.resolve_program_tier(
  p_rule public.loyalty_rule_versions,
  p_qualifying_spend numeric
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  v_tiers jsonb := p_rule.source_config -> 'tiers';
  v_tier jsonb;
  v_result jsonb;
  v_spend numeric := greatest(coalesce(p_qualifying_spend, 0), 0);
begin
  if jsonb_typeof(v_tiers) <> 'array' or jsonb_array_length(v_tiers) = 0 then
    return jsonb_build_object(
      'id', 'new_customer',
      'name', 'Khách Mới',
      'minAnnualSpend', 0,
      'currencyPerPoint', p_rule.earn_denominator,
      'pointPerUnit', p_rule.earn_numerator,
      'milestoneVoucherId', ''
    );
  end if;

  for v_tier in select value from jsonb_array_elements(v_tiers)
  loop
    if coalesce((v_tier ->> 'enabled')::boolean, true)
      and v_spend >= greatest(coalesce((v_tier ->> 'minAnnualSpend')::numeric, 0), 0)
    then
      v_result := v_tier;
    end if;
  end loop;

  return coalesce(v_result, v_tiers -> 0);
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return v_tiers -> 0;
end;
$$;

create or replace function loyalty_private.program_tier_position(
  p_rule public.loyalty_rule_versions,
  p_tier_id text
)
returns integer
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select coalesce(min(ordinality)::integer, 1)
  from jsonb_array_elements(coalesce(p_rule.source_config -> 'tiers', '[]'::jsonb))
    with ordinality as tier(value, ordinality)
  where value ->> 'id' = p_tier_id;
$$;

create or replace function loyalty_private.rollover_loyalty_account(
  p_phone text,
  p_rule public.loyalty_rule_versions,
  p_at timestamptz default now()
)
returns public.loyalty_accounts
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_phone text := public.normalize_vietnam_phone(p_phone);
  v_year integer := extract(year from p_at)::integer;
  v_account public.loyalty_accounts%rowtype;
  v_tier jsonb;
begin
  if v_phone = '' then
    return null;
  end if;

  insert into public.loyalty_accounts (
    customer_phone, total_points, tier_id, tier_cycle_year,
    tier_qualifying_spend, metadata
  ) values (
    v_phone, 0,
    loyalty_private.resolve_program_tier(p_rule, 0) ->> 'id',
    v_year, 0,
    jsonb_build_object('source', 'loyalty_program_v3')
  )
  on conflict (customer_phone) do nothing;

  select * into v_account
  from public.loyalty_accounts
  where customer_phone = v_phone
  for update;

  if v_account.tier_cycle_year is null then
    v_tier := loyalty_private.resolve_program_tier(p_rule, 0);
    update public.loyalty_accounts
    set
      tier_id = coalesce(nullif(tier_id, ''), v_tier ->> 'id'),
      tier_cycle_year = v_year,
      tier_qualifying_spend = greatest(coalesce(tier_qualifying_spend, 0), 0),
      updated_at = now()
    where customer_phone = v_phone
    returning * into v_account;
  elsif v_account.tier_cycle_year < v_year then
    v_tier := loyalty_private.resolve_program_tier(
      p_rule,
      v_account.tier_qualifying_spend
    );
    update public.loyalty_accounts
    set
      tier_id = v_tier ->> 'id',
      tier_cycle_year = v_year,
      tier_qualifying_spend = 0,
      tier_qualified_at = p_at,
      updated_at = now()
    where customer_phone = v_phone
    returning * into v_account;
  end if;

  return v_account;
end;
$$;

create or replace function loyalty_private.expire_loyalty_account_if_due(
  p_phone text,
  p_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_phone text := public.normalize_vietnam_phone(p_phone);
  v_account public.loyalty_accounts%rowtype;
  v_event_id text;
  v_expiry_key text;
begin
  select * into v_account
  from public.loyalty_accounts
  where customer_phone = v_phone
  for update;

  if not found
    or coalesce(v_account.total_points, 0) <= 0
    or v_account.points_expires_at is null
    or v_account.points_expires_at > p_at
  then
    return false;
  end if;

  v_expiry_key := 'loyalty-expiry:' || v_phone || ':' || v_account.points_expires_at::text;
  v_event_id := 'loyalty-expiry-' || gen_random_uuid()::text;

  insert into public.loyalty_ledger (
    id, customer_phone, entry_type, points, amount, title, note, metadata,
    source, source_type, source_order_id, action, action_version,
    idempotency_key, actor_type, created_at
  ) values (
    v_event_id, v_phone, 'POINTS_EXPIRED', -v_account.total_points, 0,
    'Điểm đã hết hạn',
    'Hết hạn sau 12 tháng kể từ lần mua gần nhất',
    jsonb_build_object('source', 'loyalty_program_v3', 'expiredAt', v_account.points_expires_at),
    'system', 'ADMIN', v_phone || ':' || v_account.points_expires_at::text,
    'EXPIRE_POINTS', 1, v_expiry_key, 'SYSTEM', p_at
  )
  on conflict do nothing;

  return found;
end;
$$;

create or replace function loyalty_private.guard_loyalty_ledger_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_max_points integer;
  v_current_points integer;
begin
  if new.action = 'SPEND' then
    perform loyalty_private.expire_loyalty_account_if_due(new.customer_phone, now());

    select coalesce(total_points, 0)::integer
    into v_current_points
    from public.loyalty_accounts
    where customer_phone = public.normalize_vietnam_phone(new.customer_phone)
    for update;

    if abs(new.points) > coalesce(v_current_points, 0) then
      raise exception 'Khách không đủ điểm sau khi kiểm tra hạn sử dụng.';
    end if;

    if new.source_type <> 'ORDER' then
      raise exception 'Chỉ đơn hàng trực tiếp mới được sử dụng điểm.';
    end if;

    select floor(greatest(coalesce(o.points_base_amount, 0), 0) * 0.5)::integer
    into v_max_points
    from public.orders o
    where o.id = new.source_order_id;

    if abs(new.points) > coalesce(v_max_points, 0) then
      raise exception 'Chỉ được sử dụng điểm tối đa 50%% giá trị đơn hợp lệ.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_loyalty_program_guard on public.loyalty_ledger;
create trigger trg_loyalty_program_guard
before insert on public.loyalty_ledger
for each row execute function loyalty_private.guard_loyalty_ledger_event();

create or replace function loyalty_private.apply_loyalty_account_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_rule public.loyalty_rule_versions%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_candidate jsonb;
  v_previous_tier_id text;
  v_next_tier_id text;
  v_coupon_id text;
  v_coupon public.coupons%rowtype;
  v_voucher jsonb;
  v_grant_id uuid;
begin
  if new.action not in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN', 'REVERSE_EARN') then
    return new;
  end if;

  select * into v_rule
  from public.loyalty_rule_versions
  where id = new.rule_version_id
  limit 1;

  if not found then
    select * into v_rule
    from public.loyalty_rule_versions
    where status = 'ACTIVE' and effective_from <= now()
    order by effective_from desc, version_number desc
    limit 1;
  end if;

  v_account := loyalty_private.rollover_loyalty_account(new.customer_phone, v_rule, new.created_at);
  v_previous_tier_id := coalesce(nullif(v_account.tier_id, ''),
    loyalty_private.resolve_program_tier(v_rule, 0) ->> 'id');

  if new.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN') then
    update public.loyalty_accounts
    set
      tier_qualifying_spend = greatest(coalesce(tier_qualifying_spend, 0) + greatest(coalesce(new.amount, 0), 0), 0),
      last_purchase_at = greatest(coalesce(last_purchase_at, new.created_at), new.created_at),
      points_expires_at = greatest(coalesce(last_purchase_at, new.created_at), new.created_at) + interval '12 months',
      updated_at = now()
    where customer_phone = public.normalize_vietnam_phone(new.customer_phone)
    returning * into v_account;

    v_candidate := loyalty_private.resolve_program_tier(v_rule, v_account.tier_qualifying_spend);
    if loyalty_private.program_tier_position(v_rule, v_candidate ->> 'id')
      > loyalty_private.program_tier_position(v_rule, v_previous_tier_id)
    then
      v_next_tier_id := v_candidate ->> 'id';
      update public.loyalty_accounts
      set
        tier_id = v_next_tier_id,
        tier_qualified_at = new.created_at,
        updated_at = now()
      where customer_phone = public.normalize_vietnam_phone(new.customer_phone);

      v_coupon_id := trim(coalesce(v_candidate ->> 'milestoneVoucherId', ''));
      if v_coupon_id <> '' then
        select * into v_coupon
        from public.coupons c
        where c.id::text = v_coupon_id
        limit 1;

        if found then
          v_voucher := jsonb_build_object(
            'id', 'tier-' || v_next_tier_id || '-' || v_account.tier_cycle_year::text,
            'type', 'TIER_MILESTONE',
            'couponId', v_coupon.id::text,
            'code', coalesce(v_coupon.code, ''),
            'title', coalesce(v_coupon.name, v_candidate ->> 'name'),
            'discountType', coalesce(v_coupon.discount_type, ''),
            'value', coalesce(v_coupon.value, 0),
            'maxDiscount', coalesce(v_coupon.max_discount, 0),
            'minOrder', coalesce(v_coupon.min_order, 0),
            'createdAt', new.created_at::date::text,
            'expiredAt', coalesce(nullif(v_coupon.end_at, '')::date::text, ''),
            'used', false,
            'tierId', v_next_tier_id,
            'cycleYear', v_account.tier_cycle_year
          );

          insert into public.loyalty_milestone_grants (
            customer_phone, tier_id, cycle_year, coupon_id,
            voucher_data, rule_version_id
          ) values (
            public.normalize_vietnam_phone(new.customer_phone),
            v_next_tier_id, v_account.tier_cycle_year, v_coupon.id::text,
            v_voucher, v_rule.id
          )
          on conflict (customer_phone, tier_id, cycle_year) do nothing
          returning id into v_grant_id;

          if v_grant_id is not null then
            update public.loyalty_accounts
            set vouchers = coalesce(vouchers, '[]'::jsonb) || jsonb_build_array(v_voucher),
                updated_at = now()
            where customer_phone = public.normalize_vietnam_phone(new.customer_phone);
          end if;
        end if;
      end if;
    end if;
  else
    update public.loyalty_accounts
    set
      tier_qualifying_spend = greatest(coalesce(tier_qualifying_spend, 0) - greatest(coalesce(new.amount, 0), 0), 0),
      updated_at = now()
    where customer_phone = public.normalize_vietnam_phone(new.customer_phone);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_loyalty_program_after_ledger on public.loyalty_ledger;
create trigger trg_loyalty_program_after_ledger
after insert on public.loyalty_ledger
for each row execute function loyalty_private.apply_loyalty_account_lifecycle();

create or replace function loyalty_private.snapshot_order_loyalty_rule()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_rule public.loyalty_rule_versions%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_tier jsonb;
  v_metadata_points integer;
  v_max_points integer;
begin
  select * into v_rule
  from public.loyalty_rule_versions
  where status = 'ACTIVE' and effective_from <= now()
  order by effective_from desc, version_number desc
  limit 1;

  if not found then
    raise exception 'Chưa có phiên bản quy tắc loyalty đang hoạt động.';
  end if;

  v_account := loyalty_private.rollover_loyalty_account(new.customer_phone, v_rule, now());
  v_tier := loyalty_private.resolve_program_tier(
    v_rule,
    coalesce(v_account.tier_qualifying_spend, 0)
  );
  if v_account.tier_id is not null then
    select value into v_tier
    from jsonb_array_elements(coalesce(v_rule.source_config -> 'tiers', '[]'::jsonb))
    where value ->> 'id' = v_account.tier_id
    limit 1;
    v_tier := coalesce(v_tier, loyalty_private.resolve_program_tier(v_rule, 0));
  end if;

  new.loyalty_rule_version_id := v_rule.id;
  new.loyalty_tier_id := v_tier ->> 'id';
  new.loyalty_earn_numerator := greatest(coalesce((v_tier ->> 'pointPerUnit')::bigint, v_rule.earn_numerator), 1);
  new.loyalty_earn_denominator := greatest(coalesce((v_tier ->> 'currencyPerPoint')::bigint, v_rule.earn_denominator), 1);
  new.points_base_amount := greatest(coalesce(new.subtotal, 0) - coalesce(new.promo_discount, 0), 0);
  new.expected_earn_points := floor(
    new.points_base_amount * new.loyalty_earn_numerator / new.loyalty_earn_denominator
  )::integer;
  new.points_discount_amount := coalesce(new.points_discount, 0);

  v_metadata_points := loyalty_private.jsonb_nonnegative_integer(new.metadata, 'pointsSpent');
  new.points_spent := coalesce(new.points_spent, v_metadata_points);
  if new.points_spent is null and coalesce(new.points_discount, 0) > 0 then
    new.points_spent := floor(new.points_discount)::integer;
  end if;
  new.points_spent := coalesce(new.points_spent, 0);

  v_max_points := floor(new.points_base_amount * 0.5)::integer;
  if new.points_spent > v_max_points or new.points_discount_amount > v_max_points then
    raise exception 'Chỉ được sử dụng điểm tối đa 50%% giá trị đơn hợp lệ.';
  end if;

  return new;
end;
$$;

create or replace function loyalty_private.snapshot_partner_order_loyalty_rule()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_rule public.loyalty_rule_versions%rowtype;
  v_account public.loyalty_accounts%rowtype;
  v_tier jsonb;
  v_net_received numeric;
begin
  select * into v_rule
  from public.loyalty_rule_versions
  where status = 'ACTIVE' and effective_from <= now()
  order by effective_from desc, version_number desc
  limit 1;

  if not found then
    raise exception 'Chưa có phiên bản quy tắc loyalty đang hoạt động.';
  end if;

  v_account := loyalty_private.rollover_loyalty_account(
    coalesce(nullif(new.customer_phone_key, ''), new.customer_phone),
    v_rule,
    now()
  );
  v_tier := loyalty_private.resolve_program_tier(v_rule, coalesce(v_account.tier_qualifying_spend, 0));
  if v_account.tier_id is not null then
    select value into v_tier
    from jsonb_array_elements(coalesce(v_rule.source_config -> 'tiers', '[]'::jsonb))
    where value ->> 'id' = v_account.tier_id
    limit 1;
    v_tier := coalesce(v_tier, loyalty_private.resolve_program_tier(v_rule, 0));
  end if;

  v_net_received := coalesce(
    loyalty_private.resolve_partner_net_received(coalesce(new.raw_data, '{}'::jsonb)),
    case when new.net_received_amount > 0 then new.net_received_amount else null end
  );

  new.loyalty_rule_version_id := v_rule.id;
  new.loyalty_tier_id := v_tier ->> 'id';
  new.loyalty_earn_numerator := greatest(coalesce((v_tier ->> 'pointPerUnit')::bigint, v_rule.earn_numerator), 1);
  new.loyalty_earn_denominator := greatest(coalesce((v_tier ->> 'currencyPerPoint')::bigint, v_rule.earn_denominator), 1);
  new.net_received_amount := v_net_received;
  new.points_spent := coalesce(new.points_spent, 0);
  new.points_discount_amount := coalesce(new.points_discount_amount, 0);

  if v_net_received is null then
    new.points_base_amount := 0;
    new.expected_earn_points := 0;
    new.loyalty_hold_reason := 'missing_partner_net_received';
  else
    new.points_base_amount := v_net_received;
    new.expected_earn_points := floor(
      v_net_received * new.loyalty_earn_numerator / new.loyalty_earn_denominator
    )::integer;
    new.loyalty_hold_reason := null;
  end if;

  return new;
end;
$$;

create or replace function loyalty_private.refresh_partner_order_net_received()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_rule public.loyalty_rule_versions%rowtype;
  v_net_received numeric;
begin
  v_net_received := coalesce(
    loyalty_private.resolve_partner_net_received(coalesce(new.raw_data, '{}'::jsonb)),
    case when new.net_received_amount > 0 then new.net_received_amount else null end
  );
  new.net_received_amount := v_net_received;

  if lower(trim(coalesce(old.point_status, ''))) = 'claimed'
    or exists (
      select 1 from public.loyalty_ledger ll
      where ll.source_type = 'PARTNER_ORDER'
        and ll.source_order_id = old.id::text
        and ll.action in ('CLAIM_PARTNER_EARN', 'REVERSE_EARN')
    )
  then
    return new;
  end if;

  select * into v_rule
  from public.loyalty_rule_versions
  where id = coalesce(new.loyalty_rule_version_id, old.loyalty_rule_version_id)
  limit 1;

  if not found then
    select * into v_rule
    from public.loyalty_rule_versions
    where status = 'ACTIVE' and effective_from <= now()
    order by effective_from desc, version_number desc
    limit 1;
    new.loyalty_rule_version_id := v_rule.id;
  end if;

  new.loyalty_earn_numerator := greatest(
    coalesce(new.loyalty_earn_numerator, old.loyalty_earn_numerator, v_rule.earn_numerator),
    1
  );
  new.loyalty_earn_denominator := greatest(
    coalesce(new.loyalty_earn_denominator, old.loyalty_earn_denominator, v_rule.earn_denominator),
    1
  );

  if v_net_received is null then
    new.points_base_amount := 0;
    new.expected_earn_points := 0;
    new.loyalty_hold_reason := 'missing_partner_net_received';
  else
    new.points_base_amount := v_net_received;
    new.expected_earn_points := floor(
      v_net_received * new.loyalty_earn_numerator / new.loyalty_earn_denominator
    )::integer;
    new.loyalty_hold_reason := null;
  end if;

  return new;
end;
$$;

create or replace function public.prepare_customer_loyalty_account(p_phone text)
returns table (
  customer_phone text,
  total_points integer,
  checkin_streak integer,
  last_checkin_date text,
  last_missed_streak integer,
  comeback_used_date text,
  vouchers jsonb,
  tier_id text,
  tier_cycle_year integer,
  tier_qualifying_spend numeric,
  tier_qualified_at timestamptz,
  last_purchase_at timestamptz,
  points_expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_phone text := public.normalize_vietnam_phone(p_phone);
  v_actor_type text;
  v_actor_id uuid;
  v_actor_phone text;
  v_actor_role text;
  v_rule public.loyalty_rule_versions%rowtype;
begin
  select * into v_actor_type, v_actor_id, v_actor_phone, v_actor_role
  from loyalty_private.current_actor();

  if v_actor_role not in ('service_role', 'admin', 'staff')
    and not (v_actor_role = 'customer' and v_actor_phone = v_phone)
  then
    raise exception 'Tài khoản hiện tại không được đọc loyalty của khách này.';
  end if;

  select * into v_rule
  from public.loyalty_rule_versions
  where status = 'ACTIVE' and effective_from <= now()
  order by effective_from desc, version_number desc
  limit 1;

  perform loyalty_private.rollover_loyalty_account(v_phone, v_rule, now());
  perform loyalty_private.expire_loyalty_account_if_due(v_phone, now());

  return query
  select
    la.customer_phone,
    coalesce(la.total_points, 0)::integer,
    coalesce(la.checkin_streak, 0)::integer,
    la.last_checkin_date,
    coalesce(la.last_missed_streak, 0)::integer,
    la.comeback_used_date,
    coalesce(la.vouchers, '[]'::jsonb),
    la.tier_id,
    la.tier_cycle_year,
    la.tier_qualifying_spend,
    la.tier_qualified_at,
    la.last_purchase_at,
    la.points_expires_at
  from public.loyalty_accounts la
  where la.customer_phone = v_phone;
end;
$$;

create or replace function public.expire_due_loyalty_accounts(p_limit integer default 500)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_actor_type text;
  v_actor_id uuid;
  v_actor_phone text;
  v_actor_role text;
  v_row record;
  v_count integer := 0;
begin
  select * into v_actor_type, v_actor_id, v_actor_phone, v_actor_role
  from loyalty_private.current_actor();
  if v_actor_role not in ('service_role', 'admin') then
    raise exception 'Chỉ admin hoặc service role được chạy hết hạn điểm theo lô.';
  end if;

  for v_row in
    select customer_phone
    from public.loyalty_accounts
    where total_points > 0 and points_expires_at <= now()
    order by points_expires_at
    limit greatest(1, least(coalesce(p_limit, 500), 5000))
  loop
    if loyalty_private.expire_loyalty_account_if_due(v_row.customer_phone, now()) then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke all on function loyalty_private.resolve_program_tier(public.loyalty_rule_versions, numeric) from public, anon;
revoke all on function loyalty_private.program_tier_position(public.loyalty_rule_versions, text) from public, anon;
revoke all on function loyalty_private.rollover_loyalty_account(text, public.loyalty_rule_versions, timestamptz) from public, anon;
revoke all on function loyalty_private.expire_loyalty_account_if_due(text, timestamptz) from public, anon;
revoke all on function loyalty_private.guard_loyalty_ledger_event() from public, anon;
revoke all on function loyalty_private.apply_loyalty_account_lifecycle() from public, anon;

revoke execute on function public.prepare_customer_loyalty_account(text) from public, anon;
grant execute on function public.prepare_customer_loyalty_account(text) to authenticated, service_role;

revoke execute on function public.expire_due_loyalty_accounts(integer) from public, anon, authenticated;
grant execute on function public.expire_due_loyalty_accounts(integer) to service_role;

comment on function public.prepare_customer_loyalty_account(text) is
  'Lazily rolls the annual tier cycle and expires the whole point balance before returning account state.';
comment on function public.expire_due_loyalty_accounts(integer) is
  'Expires due loyalty balances in bounded batches without frontend requests.';

with active_rule as (
  select r.*
  from public.loyalty_rule_versions r
  where r.status = 'ACTIVE' and r.effective_from <= now()
  order by r.effective_from desc, r.version_number desc
  limit 1
), annual_spend as (
  select
    public.normalize_vietnam_phone(ll.customer_phone) as customer_phone,
    greatest(sum(
      case
        when ll.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN') then greatest(coalesce(ll.amount, 0), 0)
        when ll.action = 'REVERSE_EARN' then -greatest(coalesce(ll.amount, 0), 0)
        else 0
      end
    ), 0) as qualifying_spend
  from public.loyalty_ledger ll
  where ll.created_at >= date_trunc('year', now())
    and ll.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN', 'REVERSE_EARN')
  group by public.normalize_vietnam_phone(ll.customer_phone)
), purchases as (
  select
    public.normalize_vietnam_phone(ll.customer_phone) as customer_phone,
    max(ll.created_at) filter (
      where ll.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN')
    ) as last_purchase_at
  from public.loyalty_ledger ll
  group by public.normalize_vietnam_phone(ll.customer_phone)
), account_state as (
  select
    la.customer_phone,
    r.id as rule_id,
    coalesce(s.qualifying_spend, 0) as qualifying_spend,
    p.last_purchase_at
  from public.loyalty_accounts la
  cross join active_rule r
  left join annual_spend s on s.customer_phone = la.customer_phone
  left join purchases p on p.customer_phone = la.customer_phone
)
update public.loyalty_accounts la
set
  tier_id = loyalty_private.resolve_program_tier(
    r,
    state.qualifying_spend
  ) ->> 'id',
  tier_cycle_year = extract(year from now())::integer,
  tier_qualifying_spend = state.qualifying_spend,
  tier_qualified_at = coalesce(la.tier_qualified_at, now()),
  last_purchase_at = coalesce(la.last_purchase_at, state.last_purchase_at),
  points_expires_at = case
    when coalesce(la.last_purchase_at, state.last_purchase_at) is not null
      then coalesce(la.last_purchase_at, state.last_purchase_at) + interval '12 months'
    else la.points_expires_at
  end,
  updated_at = now()
from account_state state
join active_rule r on r.id = state.rule_id
where la.customer_phone = state.customer_phone;

notify pgrst, 'reload schema';

commit;
