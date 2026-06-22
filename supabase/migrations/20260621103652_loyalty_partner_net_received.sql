-- Loyalty program - Phase 2 partner net received amount.
-- Partner loyalty never falls back to customer-facing order totals.

begin;

alter table public.partner_orders
  add column if not exists net_received_amount numeric null,
  add column if not exists loyalty_hold_reason text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'partner_orders_net_received_nonnegative'
      and conrelid = 'public.partner_orders'::regclass
  ) then
    alter table public.partner_orders
      add constraint partner_orders_net_received_nonnegative
      check (net_received_amount is null or net_received_amount >= 0) not valid;
  end if;
end;
$$;

create or replace function loyalty_private.parse_partner_money(p_value text)
returns numeric
language plpgsql
immutable
strict
security invoker
set search_path = pg_catalog
as $$
declare
  v_text text := trim(p_value);
  v_amount numeric;
begin
  if v_text = '' then return null; end if;
  v_text := replace(v_text, ',', '');
  v_text := regexp_replace(v_text, '[^0-9.-]', '', 'g');
  if v_text !~ '^\d+(\.\d+)?$' then return null; end if;
  v_amount := v_text::numeric;
  return case when v_amount > 0 then v_amount else null end;
exception
  when numeric_value_out_of_range or invalid_text_representation then
    return null;
end;
$$;

create or replace function loyalty_private.resolve_partner_net_received(p_raw_data jsonb)
returns numeric
language sql
immutable
security invoker
set search_path = pg_catalog, loyalty_private
as $$
  select coalesce(
    loyalty_private.parse_partner_money(p_raw_data #>> '{finance_data,real_received}'),
    loyalty_private.parse_partner_money(p_raw_data #>> '{finance_data,net_received}'),
    loyalty_private.parse_partner_money(p_raw_data ->> 'total_for_biz'),
    loyalty_private.parse_partner_money(p_raw_data #>> '{finance_data,total_for_biz}')
  );
$$;

create or replace function loyalty_private.snapshot_partner_order_loyalty_rule()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, loyalty_private
as $$
declare
  v_rule public.loyalty_rule_versions%rowtype;
  v_net_received numeric;
begin
  select * into v_rule
  from public.loyalty_rule_versions
  where status = 'ACTIVE'
    and effective_from <= now()
  order by effective_from desc, version_number desc
  limit 1;

  if not found then
    raise exception 'Chưa có phiên bản quy tắc loyalty đang hoạt động.';
  end if;

  v_net_received := coalesce(
    loyalty_private.resolve_partner_net_received(coalesce(new.raw_data, '{}'::jsonb)),
    case when new.net_received_amount > 0 then new.net_received_amount else null end
  );

  new.loyalty_rule_version_id := v_rule.id;
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
      v_net_received * v_rule.earn_numerator / v_rule.earn_denominator
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
      select 1
      from public.loyalty_ledger ll
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

  if v_net_received is null then
    new.points_base_amount := 0;
    new.expected_earn_points := 0;
    new.loyalty_hold_reason := 'missing_partner_net_received';
  else
    new.points_base_amount := v_net_received;
    new.expected_earn_points := floor(
      v_net_received * v_rule.earn_numerator / v_rule.earn_denominator
    )::integer;
    new.loyalty_hold_reason := null;
  end if;

  return new;
end;
$$;

update public.partner_orders po
set net_received_amount = loyalty_private.resolve_partner_net_received(
  coalesce(po.raw_data, '{}'::jsonb)
)
where po.net_received_amount is null;

update public.partner_orders po
set
  points_base_amount = coalesce(po.net_received_amount, 0),
  expected_earn_points = case
    when po.net_received_amount > 0 then floor(
      po.net_received_amount * r.earn_numerator / r.earn_denominator
    )::integer
    else 0
  end,
  loyalty_hold_reason = case
    when po.net_received_amount > 0 then null
    else 'missing_partner_net_received'
  end
from public.loyalty_rule_versions r
where r.id = po.loyalty_rule_version_id
  and lower(trim(coalesce(po.point_status, ''))) <> 'claimed'
  and not exists (
    select 1
    from public.loyalty_ledger ll
    where ll.source_type = 'PARTNER_ORDER'
      and ll.source_order_id = po.id::text
      and ll.action in ('CLAIM_PARTNER_EARN', 'REVERSE_EARN')
  );

drop trigger if exists partner_orders_refresh_net_received on public.partner_orders;
create trigger partner_orders_refresh_net_received
before update of raw_data, net_received_amount on public.partner_orders
for each row execute function loyalty_private.refresh_partner_order_net_received();

create index if not exists partner_orders_loyalty_missing_net_received_idx
on public.partner_orders (order_time desc, id)
where net_received_amount is null
  and lower(coalesce(point_status, '')) <> 'claimed';

create or replace function public.get_customer_order_count_summary(p_phone text)
returns table(
  customer_phone text,
  total_orders integer,
  total_spent numeric,
  claimed_points integer,
  pending_points integer
)
language sql
stable
as $$
with rule as (
  select
    coalesce(currency_per_point, 100)::numeric as currency_per_point,
    coalesce(point_per_unit, 1)::numeric as point_per_unit
  from public.get_loyalty_order_rule()
),
identity as (
  select
    public.normalize_vietnam_phone(p_phone) as customer_phone,
    public.get_customer_phone_variants(p_phone) as phone_variants
),
ledger as (
  select
    coalesce(sum(case when entry_type in ('ORDER_EARN', 'PARTNER_ORDER_EARN') then points else 0 end), 0)::integer as ledger_claimed_points,
    array_remove(array_agg(distinct nullif(trim(order_id), '')), null) as claimed_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_id::text), '')), null) as claimed_partner_order_ids,
    array_remove(array_agg(distinct nullif(trim(partner_order_code), '')), null) as claimed_partner_order_codes
  from public.loyalty_ledger ll
  cross join identity i
  where ll.customer_phone = any(i.phone_variants)
),
web_orders as (
  select
    o.id::text as order_identity,
    trim(coalesce(o.order_code, '')) as order_code,
    coalesce(o.total_amount, 0)::numeric as total_amount,
    public.normalize_order_counting_status(o.status) as status_key,
    greatest(
      0,
      coalesce(
        nullif(o.points_earned, 0),
        floor((coalesce(o.total_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)
      )
    )::integer as earned_points
  from public.orders o
  cross join identity i
  cross join rule r
  where o.customer_phone = any(i.phone_variants)
),
valid_web_orders as (
  select *
  from web_orders
  where status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
partner_orders as (
  select
    po.id::text as partner_order_identity,
    trim(coalesce(po.order_code, '')) as partner_order_code,
    coalesce(po.total_amount, 0)::numeric as total_amount,
    coalesce(po.net_received_amount, 0)::numeric as points_base_amount,
    lower(trim(coalesce(po.point_status, 'pending'))) as point_status_key,
    public.normalize_order_counting_status(po.order_status) as order_status_key,
    public.normalize_order_counting_status(po.nexpos_status) as nexpos_status_key,
    public.normalize_order_counting_status(coalesce(po.raw_data ->> 'status', '')) as raw_status_key,
    floor((coalesce(po.net_received_amount, 0)::numeric / nullif(r.currency_per_point, 0)) * r.point_per_unit)::integer as earned_points
  from public.partner_orders po
  cross join identity i
  cross join rule r
  where po.customer_phone_key = any(i.phone_variants)
     or po.customer_phone = any(i.phone_variants)
),
valid_partner_orders as (
  select *
  from partner_orders
  where order_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and nexpos_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
    and raw_status_key not in ('cancel', 'canceled', 'cancelled', 'huy', 'dahuy', 'refunded', 'preorder', 'preordered', 'scheduled', 'dattruoc')
),
web_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when status_key in ('done', 'completed', 'complete', 'finish', 'finished', 'served', 'hoantat')
          and order_identity <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
          and order_code <> all(coalesce((select claimed_order_ids from ledger), array[]::text[]))
        then earned_points
        else 0
      end
    ), 0)::integer as pending_points
  from valid_web_orders
),
partner_summary as (
  select
    count(*)::integer as total_orders,
    coalesce(sum(total_amount), 0)::numeric as total_spent,
    coalesce(sum(
      case
        when point_status_key = 'claimed'
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as claimed_points,
    coalesce(sum(
      case
        when point_status_key not in ('claimed', 'rejected', 'expired')
          and partner_order_identity <> all(coalesce((select claimed_partner_order_ids from ledger), array[]::text[]))
          and partner_order_code <> all(coalesce((select claimed_partner_order_codes from ledger), array[]::text[]))
        then greatest(0, earned_points)
        else 0
      end
    ), 0)::integer as pending_points
  from valid_partner_orders
)
select
  i.customer_phone,
  coalesce(ws.total_orders, 0) + coalesce(ps.total_orders, 0) as total_orders,
  coalesce(ws.total_spent, 0) + coalesce(ps.total_spent, 0) as total_spent,
  coalesce(l.ledger_claimed_points, 0) + coalesce(ps.claimed_points, 0) as claimed_points,
  coalesce(ws.pending_points, 0) + coalesce(ps.pending_points, 0) as pending_points
from identity i
left join ledger l on true
left join web_summary ws on true
left join partner_summary ps on true;
$$;

create or replace function public.get_customer_order_point_statuses(
  p_customer_phone text,
  p_limit integer default 200
)
returns table (
  source_type text,
  source_order_id text,
  order_code text,
  display_order_code text,
  point_status text,
  net_points integer,
  expected_points integer,
  order_created_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with params as (
    select
      public.normalize_vietnam_phone(p_customer_phone) as phone_key,
      greatest(1, least(coalesce(p_limit, 200), 500)) as limit_rows
  ),
  web_orders as (
    select
      'ORDER'::text as source_type,
      o.id::text as source_order_id,
      coalesce(o.order_code, o.id::text) as order_code,
      coalesce(o.order_code, o.id::text) as display_order_code,
      case
        when lower(trim(coalesce(o.status, ''))) in ('cancelled', 'canceled', 'cancel', 'refunded') then 'blocked'
        when coalesce(ledger.net_points, 0) > 0 then 'claimed'
        when lower(trim(coalesce(o.status, ''))) in ('completed', 'done', 'hoan_tat', 'hoan tat')
          and coalesce(o.expected_earn_points, 0) > 0 then 'pending'
        else 'pending'
      end as point_status,
      coalesce(ledger.net_points, 0)::integer as net_points,
      coalesce(o.expected_earn_points, 0)::integer as expected_points,
      coalesce(o.created_at, now()) as order_created_at
    from public.orders o
    cross join params p
    left join lateral (
      select coalesce(sum(ll.points), 0) as net_points
      from public.loyalty_ledger ll
      where ll.source_type = 'ORDER'
        and ll.source_order_id = o.id::text
        and ll.action in ('SETTLE_EARN', 'REVERSE_EARN')
        and ll.action_version = 1
    ) ledger on true
    where public.normalize_vietnam_phone(o.customer_phone) = p.phone_key
  ),
  partner_orders as (
    select
      'PARTNER_ORDER'::text as source_type,
      po.id::text as source_order_id,
      coalesce(po.order_code, po.id::text) as order_code,
      coalesce(nullif(po.display_order_code, ''), po.order_code, po.id::text) as display_order_code,
      case
        when lower(trim(coalesce(po.point_status, ''))) in ('rejected', 'expired', 'cancelled', 'canceled') then 'blocked'
        when lower(trim(coalesce(po.order_status, ''))) in ('cancelled', 'canceled', 'cancel', 'refunded') then 'blocked'
        when coalesce(ledger.net_points, 0) > 0 then 'claimed'
        when po.net_received_amount is null
          or po.loyalty_hold_reason = 'missing_partner_net_received' then 'waiting_data'
        when lower(trim(coalesce(po.order_status, ''))) in ('completed', 'done', 'hoan_tat', 'hoan tat')
          and coalesce(po.expected_earn_points, 0) > 0 then 'pending'
        else 'pending'
      end as point_status,
      coalesce(ledger.net_points, 0)::integer as net_points,
      coalesce(po.expected_earn_points, 0)::integer as expected_points,
      coalesce(po.order_time, po.created_at, now()) as order_created_at
    from public.partner_orders po
    cross join params p
    left join lateral (
      select coalesce(sum(ll.points), 0) as net_points
      from public.loyalty_ledger ll
      where ll.source_type = 'PARTNER_ORDER'
        and ll.source_order_id = po.id::text
        and ll.action in ('CLAIM_PARTNER_EARN', 'REVERSE_EARN')
        and ll.action_version = 1
    ) ledger on true
    where public.normalize_vietnam_phone(
      coalesce(nullif(po.customer_phone_key, ''), po.customer_phone)
    ) = p.phone_key
  )
  select
    x.source_type,
    x.source_order_id,
    x.order_code,
    x.display_order_code,
    x.point_status,
    x.net_points,
    x.expected_points,
    x.order_created_at
  from (
    select * from web_orders
    union all
    select * from partner_orders
  ) x
  order by x.order_created_at desc, x.source_type asc, x.source_order_id asc
  limit (select limit_rows from params);
$$;

revoke execute on function public.get_customer_order_point_statuses(text, integer)
from public;
grant execute on function public.get_customer_order_point_statuses(text, integer)
to anon, authenticated, service_role;

alter table public.partner_orders
  validate constraint partner_orders_net_received_nonnegative;

revoke all on function loyalty_private.parse_partner_money(text)
from public, anon, authenticated;
revoke all on function loyalty_private.resolve_partner_net_received(jsonb)
from public, anon, authenticated;
revoke all on function loyalty_private.refresh_partner_order_net_received()
from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
