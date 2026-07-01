-- Change tier milestone voucher grants from once per tier per year
-- to once per tier per calendar month. Voucher validity is 7 days.

begin;

alter table public.loyalty_milestone_grants
  add column if not exists grant_month text;

update public.loyalty_milestone_grants
set grant_month = to_char(granted_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM')
where grant_month is null or trim(grant_month) = '';

alter table public.loyalty_milestone_grants
  alter column grant_month set not null;

alter table public.loyalty_milestone_grants
  drop constraint if exists loyalty_milestone_grants_business_key;

alter table public.loyalty_milestone_grants
  drop constraint if exists loyalty_milestone_grants_grant_month_check;

alter table public.loyalty_milestone_grants
  add constraint loyalty_milestone_grants_grant_month_check
  check (grant_month ~ '^[0-9]{4}-[0-9]{2}$');

alter table public.loyalty_milestone_grants
  add constraint loyalty_milestone_grants_business_key
  unique (customer_phone, tier_id, grant_month);

create index if not exists loyalty_milestone_grants_month_idx
on public.loyalty_milestone_grants (grant_month desc, tier_id);

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
  v_grant_month text;
  v_expired_at date;
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
    v_next_tier_id := v_candidate ->> 'id';

    if loyalty_private.program_tier_position(v_rule, v_next_tier_id)
      > loyalty_private.program_tier_position(v_rule, v_previous_tier_id)
    then
      update public.loyalty_accounts
      set
        tier_id = v_next_tier_id,
        tier_qualified_at = new.created_at,
        updated_at = now()
      where customer_phone = public.normalize_vietnam_phone(new.customer_phone)
      returning * into v_account;
    end if;

    -- Monthly tier voucher: once per customer + tier + Vietnam calendar month.
    -- If the customer upgrades again in the same month, the new tier is a new grant key.
    v_coupon_id := trim(coalesce(v_candidate ->> 'milestoneVoucherId', ''));
    if v_coupon_id <> '' then
      select * into v_coupon
      from public.coupons c
      where c.id::text = v_coupon_id
      limit 1;

      if found then
        v_grant_month := to_char(new.created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM');
        v_expired_at := ((new.created_at at time zone 'Asia/Ho_Chi_Minh')::date + interval '7 days')::date;

        v_voucher := jsonb_build_object(
          'id', 'tier-' || v_next_tier_id || '-' || v_grant_month,
          'type', 'TIER_MONTHLY',
          'couponId', v_coupon.id::text,
          'code', coalesce(v_coupon.code, ''),
          'title', coalesce(v_coupon.name, v_candidate ->> 'name'),
          'discountType', coalesce(v_coupon.discount_type, ''),
          'value', coalesce(v_coupon.value, 0),
          'maxDiscount', coalesce(v_coupon.max_discount, 0),
          'minOrder', coalesce(v_coupon.min_order, 0),
          'createdAt', (new.created_at at time zone 'Asia/Ho_Chi_Minh')::date::text,
          'expiredAt', v_expired_at::text,
          'used', false,
          'tierId', v_next_tier_id,
          'cycleYear', v_account.tier_cycle_year,
          'grantMonth', v_grant_month
        );

        insert into public.loyalty_milestone_grants (
          customer_phone, tier_id, cycle_year, grant_month, coupon_id,
          voucher_data, rule_version_id
        ) values (
          public.normalize_vietnam_phone(new.customer_phone),
          v_next_tier_id, v_account.tier_cycle_year, v_grant_month, v_coupon.id::text,
          v_voucher, v_rule.id
        )
        on conflict (customer_phone, tier_id, grant_month) do nothing
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

comment on column public.loyalty_milestone_grants.grant_month is
  'Vietnam calendar month YYYY-MM used to grant one tier voucher per customer and tier each month.';

comment on function loyalty_private.apply_loyalty_account_lifecycle() is
  'Maintains loyalty tier progress and grants one 7-day tier voucher per customer, tier, and Vietnam calendar month.';

notify pgrst, 'reload schema';

commit;
