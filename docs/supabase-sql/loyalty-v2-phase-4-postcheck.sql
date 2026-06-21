-- Loyalty V2 - Phase 4 postcheck / runbook
-- 1) Audit backlog trước
-- 2) Dry-run reconcile
-- 3) Chạy reconcile thật nếu kết quả đúng
-- 4) Audit lại để xác nhận backlog về 0

begin transaction read only;

select
  source_type,
  action,
  count(*)::bigint as backlog_count
from public.audit_loyalty_reconcile_backlog(null, null, 1000)
group by source_type, action
order by source_type, action;

select *
from public.audit_loyalty_reconcile_backlog('0963360834', null, 200)
order by sort_time asc, action_priority asc;

rollback;

-- Dry-run ghi thử logic reconcile nhưng chưa tạo ledger
select *
from public.reconcile_loyalty_backlog(null, 'ORDER', 200, true)
order by source_type, source_order_id, action;

-- Chạy thật cho 1 khách cụ thể trước khi quét toàn hệ thống
-- select *
-- from public.reconcile_loyalty_backlog('0963360834', 'ORDER', 200, false)
-- order by source_type, source_order_id, action;

-- Chạy thật cho web orders backlog toàn hệ thống
-- select *
-- from public.reconcile_loyalty_backlog(null, 'ORDER', 1000, false)
-- order by source_type, source_order_id, action;

-- Nếu cần quét reverse backlog của partner/orders bị hủy
-- select *
-- from public.reconcile_loyalty_backlog(null, 'PARTNER_ORDER', 500, false)
-- order by source_type, source_order_id, action;

-- Audit đặc biệt: partner đang claimed nhưng ledger earn không có
-- Trường hợp này chỉ để điều tra, không auto reconcile vì claim phải đúng người dùng thực hiện.
select
  po.id,
  po.order_code,
  po.partner_source,
  po.customer_phone,
  po.customer_phone_key,
  po.point_status,
  po.claimed_customer_phone,
  po.claimed_at
from public.partner_orders po
where lower(coalesce(po.point_status, '')) = 'claimed'
  and not exists (
    select 1
    from public.loyalty_ledger ll
    where ll.source_type = 'PARTNER_ORDER'
      and ll.source_order_id = po.id::text
      and ll.action = 'CLAIM_PARTNER_EARN'
      and ll.action_version = 1
  )
order by coalesce(po.updated_at, po.order_time, po.created_at) desc
limit 100;
