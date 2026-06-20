-- Loyalty V2 - Phase 2 preflight audit (READ ONLY)
-- Chạy trước migration. File này không thay đổi dữ liệu hoặc schema.

begin transaction read only;

-- A01. Phiên bản PostgreSQL và thời điểm audit.
select
  'A01_environment' as check_name,
  current_database() as database_name,
  current_setting('server_version') as postgres_version,
  now() as audited_at;

-- A02. Các bảng bắt buộc.
with required_tables(table_name) as (
  values
    ('profiles'),
    ('orders'),
    ('partner_orders'),
    ('loyalty_accounts'),
    ('loyalty_ledger'),
    ('app_configs')
)
select
  'A02_required_tables' as check_name,
  r.table_name,
  to_regclass('public.' || r.table_name) is not null as ok
from required_tables r
order by r.table_name;

-- A03. Tổng quan dữ liệu và mốc đối chiếu.
select 'A03_profiles' as check_name, count(*)::bigint as row_count from public.profiles
union all
select 'A03_orders', count(*)::bigint from public.orders
union all
select 'A03_partner_orders', count(*)::bigint from public.partner_orders
union all
select 'A03_loyalty_accounts', count(*)::bigint from public.loyalty_accounts
union all
select 'A03_loyalty_ledger', count(*)::bigint from public.loyalty_ledger;

select
  'A04_balance_totals' as check_name,
  coalesce((select sum(total_points) from public.loyalty_accounts), 0)::bigint as account_total,
  coalesce((select sum(points) from public.loyalty_ledger), 0)::bigint as ledger_total,
  coalesce((select sum(total_points) from public.loyalty_accounts), 0)::bigint
    = coalesce((select sum(points) from public.loyalty_ledger), 0)::bigint as ok;

-- A05. Sai lệch số dư theo khách. Kết quả mong đợi: mismatch_count = 0.
with ledger_totals as (
  select
    public.normalize_vietnam_phone(customer_phone) as phone,
    sum(points)::bigint as ledger_points
  from public.loyalty_ledger
  group by public.normalize_vietnam_phone(customer_phone)
),
account_totals as (
  select
    public.normalize_vietnam_phone(customer_phone) as phone,
    sum(total_points)::bigint as account_points
  from public.loyalty_accounts
  group by public.normalize_vietnam_phone(customer_phone)
),
comparison as (
  select
    coalesce(a.phone, l.phone) as phone,
    coalesce(a.account_points, 0) as account_points,
    coalesce(l.ledger_points, 0) as ledger_points
  from account_totals a
  full join ledger_totals l using (phone)
)
select
  'A05_balance_by_customer' as check_name,
  count(*) filter (where account_points <> ledger_points)::bigint as mismatch_count,
  count(*)::bigint as customer_count,
  count(*) filter (where account_points <> ledger_points) = 0 as ok
from comparison;

-- A06. Số điện thoại không hợp lệ hoặc không có profile.
select
  'A06_invalid_loyalty_phone' as check_name,
  count(*)::bigint as issue_count,
  count(*) = 0 as ok
from (
  select customer_phone from public.loyalty_accounts
  union
  select customer_phone from public.loyalty_ledger
) x
where public.normalize_vietnam_phone(x.customer_phone) = '';

select
  'A07_loyalty_without_profile' as check_name,
  count(*)::bigint as issue_count,
  count(*) = 0 as ok
from (
  select customer_phone from public.loyalty_accounts
  union
  select customer_phone from public.loyalty_ledger
) x
where not exists (
  select 1
  from public.profiles p
  where public.normalize_vietnam_phone(p.phone)
    = public.normalize_vietnam_phone(x.customer_phone)
);

-- A08. Giao dịch đơn hàng bị trùng theo định danh legacy.
select
  'A08_duplicate_legacy_order_events' as check_name,
  count(*)::bigint as duplicate_group_count,
  count(*) = 0 as ok
from (
  select customer_phone, entry_type, order_id
  from public.loyalty_ledger
  where nullif(trim(coalesce(order_id, '')), '') is not null
    and entry_type in ('ORDER_EARN', 'ORDER_SPEND')
  group by customer_phone, entry_type, order_id
  having count(*) > 1
) duplicates;

select
  'A09_duplicate_partner_earn' as check_name,
  count(*)::bigint as duplicate_group_count,
  count(*) = 0 as ok
from (
  select partner_order_id
  from public.loyalty_ledger
  where partner_order_id is not null
    and entry_type = 'PARTNER_ORDER_EARN'
  group by partner_order_id
  having count(*) > 1
) duplicates;

-- A10. Đơn đối tác đã claim nhưng chưa hoàn tất.
select
  'A10_partner_claim_not_completed' as check_name,
  count(*)::bigint as issue_count,
  count(*) = 0 as ok
from public.loyalty_ledger ll
join public.partner_orders po on po.id = ll.partner_order_id
where ll.entry_type = 'PARTNER_ORDER_EARN'
  and lower(trim(coalesce(po.order_status, ''))) not in ('completed', 'done', 'hoan_tat', 'hoan tat');

-- A11. Đơn hoàn tất chưa có earn. Đây là số liệu audit, chưa tự bù điểm.
select
  'A11_completed_orders_without_earn' as check_name,
  count(*)::bigint as issue_count
from public.orders o
where lower(trim(coalesce(o.status, ''))) in ('completed', 'done', 'hoan_tat', 'hoan tat')
  and public.normalize_vietnam_phone(o.customer_phone) <> ''
  and not exists (
    select 1
    from public.loyalty_ledger ll
    where ll.order_id = o.id
      and ll.entry_type = 'ORDER_EARN'
  );

select
  'A12_completed_partner_orders_unclaimed' as check_name,
  count(*)::bigint as issue_count
from public.partner_orders po
where lower(trim(coalesce(po.order_status, ''))) in ('completed', 'done', 'hoan_tat', 'hoan tat')
  and public.normalize_vietnam_phone(
    coalesce(nullif(po.customer_phone_key, ''), po.customer_phone)
  ) <> ''
  and not exists (
    select 1
    from public.loyalty_ledger ll
    where ll.partner_order_id = po.id
      and ll.entry_type = 'PARTNER_ORDER_EARN'
  );

-- A13. Đơn dùng giảm loyalty nhưng thiếu số điểm đã trừ độc lập.
select
  'A13_orders_missing_points_spent' as check_name,
  count(*)::bigint as issue_count
from public.orders o
where coalesce(o.points_discount, 0) > 0
  and not (
    coalesce(o.metadata, '{}'::jsonb) ? 'pointsSpent'
    and coalesce(o.metadata ->> 'pointsSpent', '') ~ '^\d+(\.\d+)?$'
  );

-- A14. Cấu hình loyalty hiện hành.
select
  'A14_loyalty_config' as check_name,
  value ->> 'enabled' as enabled,
  value ->> 'currencyPerPoint' as currency_per_point,
  value ->> 'pointPerUnit' as point_per_unit,
  value ->> 'redeemPointUnit' as redeem_point_unit,
  value ->> 'redeemValue' as redeem_value,
  value ->> 'checkinDailyPoints' as checkin_daily_points,
  value -> 'streakRewards' as streak_rewards
from public.app_configs
where id = 'ghr_loyalty';

-- A15. Policy đang cho anon/authenticated ghi trực tiếp các bảng nhạy cảm.
select
  'A15_broad_write_policies' as check_name,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in ('loyalty_accounts', 'loyalty_ledger')
  and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
  and (
    roles::text ilike '%anon%'
    or roles::text ilike '%authenticated%'
    or roles::text ilike '%public%'
  )
order by tablename, policyname;

-- A16. Quyền execute của RPC loyalty legacy.
select
  'A16_legacy_rpc_grants' as check_name,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in (
    'apply_loyalty_event',
    'claim_partner_order_points',
    'can_apply_loyalty_event'
  )
order by routine_name, grantee;

-- A17. Trigger đồng bộ số dư phải tồn tại.
select
  'A17_loyalty_balance_triggers' as check_name,
  c.relname as table_name,
  t.tgname as trigger_name,
  t.tgenabled
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('loyalty_accounts', 'loyalty_ledger')
  and not t.tgisinternal
order by c.relname, t.tgname;

-- A18. Lịch sử check-in trùng ngày Việt Nam do unique index legacy dùng ngày UTC.
-- V2 giữ nguyên dữ liệu này và dùng CHECKIN_V2 + business-event key riêng.
select
  'A18_duplicate_checkin_vietnam_day' as check_name,
  count(*)::bigint as duplicate_group_count
from (
  select
    customer_phone,
    (created_at at time zone 'Asia/Ho_Chi_Minh')::date as business_date
  from public.loyalty_ledger
  where entry_type = 'CHECKIN'
  group by customer_phone, (created_at at time zone 'Asia/Ho_Chi_Minh')::date
  having count(*) > 1
) duplicates;

rollback;
