-- Read-only audit. Run before applying the rolling 60-day migration.
-- It reconstructs current remaining lots with FIFO consumption, without
-- changing production data.
-- Existing balances keep their current account expiry; only post-cutover
-- earning events receive the new 60-day expiry.

with
earning_lots as (
  select
    public.normalize_vietnam_phone(ll.customer_phone) as customer_phone,
    ll.id,
    ll.points as earned_points,
    ll.created_at as earned_at,
    greatest(
      ll.created_at + interval '1 microsecond',
      coalesce(la.points_expires_at, 'infinity'::timestamptz)
    ) as expires_at,
    coalesce(sum(ll.points) over (
      partition by public.normalize_vietnam_phone(ll.customer_phone)
      order by ll.created_at, ll.id
      rows between unbounded preceding and 1 preceding
    ), 0) as earned_before
  from public.loyalty_ledger ll
  left join public.loyalty_accounts la
    on la.customer_phone = public.normalize_vietnam_phone(ll.customer_phone)
  where ll.points > 0
),
debits as (
  select
    public.normalize_vietnam_phone(customer_phone) as customer_phone,
    coalesce(abs(sum(points)), 0) as debited_points
  from public.loyalty_ledger
  where points < 0
    and coalesce(action, '') <> 'EXPIRE_POINTS'
  group by public.normalize_vietnam_phone(customer_phone)
),
remaining_lots as (
  select
    l.*,
    greatest(
      l.earned_points
      - greatest(least(coalesce(d.debited_points, 0) - l.earned_before, l.earned_points), 0),
      0
    )::integer as remaining_points
  from earning_lots l
  left join debits d using (customer_phone)
),
source_summary as (
  select
    count(*) filter (where points > 0) as earning_events,
    coalesce(sum(points) filter (where points > 0), 0) as earned_points,
    coalesce(abs(sum(points) filter (where points < 0)), 0) as debited_points,
    coalesce(sum(points), 0) as ledger_balance
  from public.loyalty_ledger
),
due_points as (
  select
    count(*) filter (where remaining_points > 0 and expires_at <= now()) as grandfathered_lots_already_due,
    count(distinct customer_phone) filter (where remaining_points > 0 and expires_at <= now()) as accounts_already_due,
    coalesce(sum(remaining_points) filter (where remaining_points > 0 and expires_at <= now()), 0) as grandfathered_points_already_due,
    coalesce(sum(remaining_points) filter (where remaining_points > 0 and expires_at > now()), 0) as points_remaining_after_cutover
  from remaining_lots
)
select
  now() as audited_at,
  60 as expiry_days,
  s.earning_events,
  s.earned_points,
  s.debited_points,
  s.ledger_balance,
  d.grandfathered_lots_already_due,
  d.accounts_already_due,
  d.grandfathered_points_already_due,
  d.points_remaining_after_cutover,
  (select count(*) from public.loyalty_accounts where total_points > 0) as positive_accounts,
  (select coalesce(sum(total_points), 0) from public.loyalty_accounts) as account_balance
from source_summary s
cross join due_points d;

-- Per-customer impact. Review this list before approving the production cutover.
with
earning_lots as (
  select
    public.normalize_vietnam_phone(ll.customer_phone) as customer_phone,
    ll.points as earned_points,
    greatest(
      ll.created_at + interval '1 microsecond',
      coalesce(la.points_expires_at, 'infinity'::timestamptz)
    ) as expires_at,
    coalesce(sum(ll.points) over (
      partition by public.normalize_vietnam_phone(ll.customer_phone)
      order by ll.created_at, ll.id rows between unbounded preceding and 1 preceding
    ), 0) as earned_before
  from public.loyalty_ledger ll
  left join public.loyalty_accounts la
    on la.customer_phone = public.normalize_vietnam_phone(ll.customer_phone)
  where ll.points > 0
),
debits as (
  select public.normalize_vietnam_phone(customer_phone) as customer_phone,
         coalesce(abs(sum(points)), 0) as debited_points
  from public.loyalty_ledger
  where points < 0 and coalesce(action, '') <> 'EXPIRE_POINTS'
  group by public.normalize_vietnam_phone(customer_phone)
),
remaining_lots as (
  select l.customer_phone, l.expires_at,
    greatest(l.earned_points - greatest(
      least(coalesce(d.debited_points, 0) - l.earned_before, l.earned_points), 0
    ), 0)::integer as remaining_points
  from earning_lots l left join debits d using (customer_phone)
)
select
  customer_phone,
  sum(remaining_points) as balance_before_cutover,
  sum(remaining_points) filter (where expires_at <= now()) as grandfathered_points_already_due,
  sum(remaining_points) filter (where expires_at > now()) as balance_after_cutover,
  min(expires_at) filter (where remaining_points > 0 and expires_at > now()) as next_expiry_at
from remaining_lots
group by customer_phone
having coalesce(sum(remaining_points) filter (where expires_at <= now()), 0) > 0
order by grandfathered_points_already_due desc, customer_phone;

-- Data-quality checks that must return zero rows before cutover.
select customer_phone, total_points
from public.loyalty_accounts
where total_points < 0;

select customer_phone, count(*) as duplicate_accounts
from public.loyalty_accounts
group by customer_phone
having count(*) > 1;

select id, customer_phone, points, created_at
from public.loyalty_ledger
where customer_phone is null
   or btrim(customer_phone) = ''
   or points = 0;
