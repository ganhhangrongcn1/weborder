-- Loyalty reachable tiers and customer-specific order progress.

begin;

alter table public.loyalty_accounts
  add column if not exists tier_qualifying_order_count integer not null default 0;

alter table public.loyalty_accounts
  drop constraint if exists loyalty_accounts_tier_order_count_check;

alter table public.loyalty_accounts
  add constraint loyalty_accounts_tier_order_count_check
  check (tier_qualifying_order_count >= 0) not valid;

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
    tier_qualifying_spend, tier_qualifying_order_count, metadata
  ) values (
    v_phone, 0,
    loyalty_private.resolve_program_tier(p_rule, 0) ->> 'id',
    v_year, 0, 0,
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
      tier_qualifying_order_count = greatest(coalesce(tier_qualifying_order_count, 0), 0),
      updated_at = now()
    where customer_phone = v_phone
    returning * into v_account;
  elsif v_account.tier_cycle_year < v_year then
    v_tier := loyalty_private.resolve_program_tier(p_rule, v_account.tier_qualifying_spend);
    update public.loyalty_accounts
    set
      tier_id = v_tier ->> 'id',
      tier_cycle_year = v_year,
      tier_qualifying_spend = 0,
      tier_qualifying_order_count = 0,
      tier_qualified_at = p_at,
      updated_at = now()
    where customer_phone = v_phone
    returning * into v_account;
  end if;

  return v_account;
end;
$$;

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
  v_previous_tier_id := coalesce(
    nullif(v_account.tier_id, ''),
    loyalty_private.resolve_program_tier(v_rule, 0) ->> 'id'
  );

  if new.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN') then
    update public.loyalty_accounts
    set
      tier_qualifying_spend = greatest(
        coalesce(tier_qualifying_spend, 0) + greatest(coalesce(new.amount, 0), 0),
        0
      ),
      tier_qualifying_order_count = greatest(coalesce(tier_qualifying_order_count, 0) + 1, 0),
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
            set
              vouchers = coalesce(vouchers, '[]'::jsonb) || jsonb_build_array(v_voucher),
              updated_at = now()
            where customer_phone = public.normalize_vietnam_phone(new.customer_phone);
          end if;
        end if;
      end if;
    end if;
  else
    update public.loyalty_accounts
    set
      tier_qualifying_spend = greatest(
        coalesce(tier_qualifying_spend, 0) - greatest(coalesce(new.amount, 0), 0),
        0
      ),
      tier_qualifying_order_count = greatest(coalesce(tier_qualifying_order_count, 0) - 1, 0),
      updated_at = now()
    where customer_phone = public.normalize_vietnam_phone(new.customer_phone);
  end if;

  return new;
end;
$$;

drop function if exists public.prepare_customer_loyalty_account(text);

create function public.prepare_customer_loyalty_account(p_phone text)
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
  tier_qualifying_order_count integer,
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
    coalesce(la.tier_qualifying_order_count, 0)::integer,
    la.tier_qualified_at,
    la.last_purchase_at,
    la.points_expires_at
  from public.loyalty_accounts la
  where la.customer_phone = v_phone;
end;
$$;

revoke execute on function public.prepare_customer_loyalty_account(text) from public, anon;
grant execute on function public.prepare_customer_loyalty_account(text) to authenticated, service_role;

do $$
declare
  v_active_rule public.loyalty_rule_versions%rowtype;
  v_config jsonb;
  v_tiers jsonb;
begin
  select * into v_active_rule
  from public.loyalty_rule_versions
  where status = 'ACTIVE' and effective_from <= now()
  order by effective_from desc, version_number desc
  limit 1;

  select coalesce(value, v_active_rule.source_config, '{}'::jsonb)
  into v_config
  from public.app_configs
  where id = 'ghr_loyalty';

  v_config := coalesce(v_config, v_active_rule.source_config, '{}'::jsonb);
  if jsonb_typeof(v_config -> 'tiers') <> 'array'
    or jsonb_array_length(v_config -> 'tiers') <> 5
  then
    raise exception 'Cấu hình loyalty hiện tại không có đủ 5 hạng.';
  end if;

  select jsonb_agg(
    tier.value || jsonb_build_object(
      'minAnnualSpend', case tier.value ->> 'id'
        when 'new_customer' then 0
        when 'returning_customer' then 500000
        when 'super_fan' then 1500000
        when 'inner_circle_fan' then 3000000
        when 'ganh_legend' then 6000000
        else coalesce((tier.value ->> 'minAnnualSpend')::integer, 0)
      end
    )
    order by tier.ordinality
  )
  into v_tiers
  from jsonb_array_elements(v_config -> 'tiers') with ordinality as tier(value, ordinality);

  v_config := v_config || jsonb_build_object(
    'tiers', v_tiers,
    'source', 'loyalty_reachable_tiers_2026',
    'idempotencyKey', 'migration:20260622012305'
  );

  update public.loyalty_rule_versions
  set status = 'RETIRED', retired_at = now()
  where status = 'ACTIVE';

  insert into public.loyalty_rule_versions (
    status, effective_from, earn_numerator, earn_denominator,
    redeem_point_unit, redeem_value, checkin_daily_points,
    streak_rewards, source_config
  ) values (
    'ACTIVE', now(),
    greatest(coalesce((v_tiers -> 0 ->> 'pointPerUnit')::bigint, 10), 1),
    greatest(coalesce((v_tiers -> 0 ->> 'currencyPerPoint')::bigint, 100), 1),
    1, 1,
    greatest(coalesce((v_config ->> 'checkinDailyPoints')::integer, 0), 0),
    coalesce(v_config -> 'streakRewards', '{}'::jsonb),
    v_config
  )
  returning * into v_active_rule;

  insert into public.app_configs (id, value, updated_at)
  values ('ghr_loyalty', v_config, now())
  on conflict (id) do update
  set value = excluded.value, updated_at = excluded.updated_at;

  with annual_activity as (
    select
      public.normalize_vietnam_phone(ll.customer_phone) as customer_phone,
      greatest(sum(
        case
          when ll.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN') then greatest(coalesce(ll.amount, 0), 0)
          when ll.action = 'REVERSE_EARN' then -greatest(coalesce(ll.amount, 0), 0)
          else 0
        end
      ), 0) as qualifying_spend,
      greatest(sum(
        case
          when ll.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN') then 1
          when ll.action = 'REVERSE_EARN' then -1
          else 0
        end
      ), 0)::integer as qualifying_order_count
    from public.loyalty_ledger ll
    where ll.created_at >= date_trunc('year', now())
      and ll.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN', 'REVERSE_EARN')
    group by public.normalize_vietnam_phone(ll.customer_phone)
  )
  update public.loyalty_accounts la
  set
    tier_id = loyalty_private.resolve_program_tier(
      v_active_rule,
      coalesce(activity.qualifying_spend, 0)
    ) ->> 'id',
    tier_cycle_year = extract(year from now())::integer,
    tier_qualifying_spend = coalesce(activity.qualifying_spend, 0),
    tier_qualifying_order_count = coalesce(activity.qualifying_order_count, 0),
    tier_qualified_at = case
      when la.tier_id is distinct from loyalty_private.resolve_program_tier(
        v_active_rule,
        coalesce(activity.qualifying_spend, 0)
      ) ->> 'id' then now()
      else la.tier_qualified_at
    end,
    updated_at = now()
  from annual_activity activity
  where la.customer_phone = activity.customer_phone;

  update public.loyalty_accounts la
  set
    tier_id = loyalty_private.resolve_program_tier(v_active_rule, 0) ->> 'id',
    tier_cycle_year = extract(year from now())::integer,
    tier_qualifying_spend = 0,
    tier_qualifying_order_count = 0,
    updated_at = now()
  where not exists (
    select 1
    from public.loyalty_ledger ll
    where public.normalize_vietnam_phone(ll.customer_phone) = la.customer_phone
      and ll.created_at >= date_trunc('year', now())
      and ll.action in ('SETTLE_EARN', 'CLAIM_PARTNER_EARN', 'REVERSE_EARN')
  );
end;
$$;

alter table public.loyalty_accounts
  validate constraint loyalty_accounts_tier_order_count_check;

comment on column public.loyalty_accounts.tier_qualifying_order_count is
  'Net completed orders counted toward the current calendar-year loyalty tier.';

comment on function public.prepare_customer_loyalty_account(text) is
  'Rolls tier/expiry state and returns spend plus completed-order progress for the authenticated customer.';

notify pgrst, 'reload schema';

commit;
