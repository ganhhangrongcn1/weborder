-- Loyalty V2 - Phase 4.1 runbook
-- Mục tiêu:
-- 1) nhìn backlog theo nhóm safe / suspicious
-- 2) chỉ quét auto nhóm safe
-- 3) giữ lại nhóm suspicious để audit thủ công

-- 1. Xem nhóm safe / suspicious toàn hệ thống
select
  classification,
  suspicious_reason,
  action,
  count(*)::bigint as total_rows
from public.audit_loyalty_reconcile_plan(null, 'ORDER', 1000)
group by classification, suspicious_reason, action
order by classification, suspicious_reason, action;

-- 2. Xem chi tiết 1 khách
select
  source_order_id,
  order_code,
  action,
  event_delta,
  current_balance,
  batch_balance_before,
  batch_balance_after,
  classification,
  suspicious_reason
from public.audit_loyalty_reconcile_plan('0963360834', 'ORDER', 200)
order by sort_time asc, action_priority asc, action asc;

-- 3. Dry-run nhóm safe
select
  source_order_id,
  action,
  classification,
  points_delta,
  ok,
  applied,
  message
from public.reconcile_loyalty_backlog_safe(null, 'ORDER', 200, true)
order by source_order_id, action;

-- 4. Chạy thật nhóm safe cho 1 khách
-- select *
-- from public.reconcile_loyalty_backlog_safe('0963360834', 'ORDER', 200, false)
-- order by source_order_id, action;

-- 5. Chạy thật nhóm safe toàn hệ thống
-- select *
-- from public.reconcile_loyalty_backlog_safe(null, 'ORDER', 1000, false)
-- order by customer_phone, source_order_id, action;
