# SQL tham chiếu và kiểm tra

[Toàn bộ tài liệu](../README.md)

Các file được giữ nguyên đường dẫn vì tài liệu và script kiểm thử đang tham chiếu. Đây không phải danh sách lệnh để chạy tuần tự. Kiểm tra phạm vi, quyền và trạng thái triển khai trước khi thực thi. Lịch sử migration nằm tại [supabase/migrations](../../supabase/migrations).

## Bếp

- [kitchen-items-source-of-truth-audit-counts.sql](kitchen-items-source-of-truth-audit-counts.sql)
- [kitchen-items-source-of-truth-audit-samples.sql](kitchen-items-source-of-truth-audit-samples.sql)
- [kitchen-items-source-of-truth-audit-summary.sql](kitchen-items-source-of-truth-audit-summary.sql)
- [kitchen-items-source-of-truth-audit.sql](kitchen-items-source-of-truth-audit.sql)
- [kitchen-work-status.sql](kitchen-work-status.sql)

## Checklist

- [checklist-confirmations-drilldown-smoke.sql](checklist-confirmations-drilldown-smoke.sql)
- [checklist-employee-auto-code-smoke.sql](checklist-employee-auto-code-smoke.sql)
- [checklist-employee-hr-smoke.sql](checklist-employee-hr-smoke.sql)
- [checklist-fair-scoring-smoke.sql](checklist-fair-scoring-smoke.sql)
- [checklist-phase-1-audit.sql](checklist-phase-1-audit.sql)
- [checklist-phase-2-audit.sql](checklist-phase-2-audit.sql)
- [checklist-phase-3-audit.sql](checklist-phase-3-audit.sql)
- [checklist-phase-3-smoke.sql](checklist-phase-3-smoke.sql)
- [checklist-phase-4-audit.sql](checklist-phase-4-audit.sql)
- [checklist-phase-4-smoke.sql](checklist-phase-4-smoke.sql)

## Cấu hình và vận hành

- [2026-10-06-analytics-uuid-join-applied.sql](2026-10-06-analytics-uuid-join-applied.sql)
- [2026-10-06-analytics-uuid-join-rollback.sql](2026-10-06-analytics-uuid-join-rollback.sql)
- [2026-10-06-analytics-uuid-join-validation.sql](2026-10-06-analytics-uuid-join-validation.sql)
- [2026-10-06-dashboard-period-rollback.sql](2026-10-06-dashboard-period-rollback.sql)
- [2026-10-06-dashboard-period-validation.sql](2026-10-06-dashboard-period-validation.sql)
- [20260907_disable_retired_mango_tea_gift.sql](20260907_disable_retired_mango_tea_gift.sql)
- [admin-business-analytics-rpc.sql](admin-business-analytics-rpc.sql)
- [admin-crm-analytics-cache.sql](admin-crm-analytics-cache.sql)
- [admin-crm-analytics-rpc.sql](admin-crm-analytics-rpc.sql)
- [admin-dashboard-revenue-series-rpc.sql](admin-dashboard-revenue-series-rpc.sql)
- [admin-dashboard-summary-rpc.sql](admin-dashboard-summary-rpc.sql)
- [app-downloads-storage.sql](app-downloads-storage.sql)
- [cake-supabase-first-step-1.sql](cake-supabase-first-step-1.sql)
- [cake-supabase-first-step-2-products-audit.sql](cake-supabase-first-step-2-products-audit.sql)
- [cake-supabase-first-step-4-force-304-delivery-source.sql](cake-supabase-first-step-4-force-304-delivery-source.sql)
- [print-jobs-retention.sql](print-jobs-retention.sql)
- [site-visit-tracking.sql](site-visit-tracking.sql)
- [supabase-io-hot-path-indexes.sql](supabase-io-hot-path-indexes.sql)
- [supabase-realtime-audit-and-trim.sql](supabase-realtime-audit-and-trim.sql)
- [supabase-resource-optimization.sql](supabase-resource-optimization.sql)
- [supabase-trash-audit.sql](supabase-trash-audit.sql)
- [vietsing-19k-branch-read-audit.sql](vietsing-19k-branch-read-audit.sql)
- [vietsing-19k-menu-2026-10.sql](vietsing-19k-menu-2026-10.sql)
- [vietsing-19k-rollback.sql](vietsing-19k-rollback.sql)

## Kho

- [20260725_inventory_mvp.sql](20260725_inventory_mvp.sql)
- [20260725_inventory_mvp_audit.sql](20260725_inventory_mvp_audit.sql)
- [20260824_inventory_engine_concurrency_test.sql](20260824_inventory_engine_concurrency_test.sql)
- [20260824_inventory_engine_postcheck.sql](20260824_inventory_engine_postcheck.sql)
- [20260824_inventory_engine_smoke_test.sql](20260824_inventory_engine_smoke_test.sql)
- [20260824_inventory_phase1_audit.sql](20260824_inventory_phase1_audit.sql)
- [20260824_inventory_phase3_baseline_seed.sql](20260824_inventory_phase3_baseline_seed.sql)
- [20260824_inventory_phase3_foundation_test.sql](20260824_inventory_phase3_foundation_test.sql)
- [20260824_inventory_phase3_p0_settings_postcheck.sql](20260824_inventory_phase3_p0_settings_postcheck.sql)
- [20260824_inventory_phase3_p0_settings_test.sql](20260824_inventory_phase3_p0_settings_test.sql)
- [20260824_inventory_phase3_postcheck.sql](20260824_inventory_phase3_postcheck.sql)
- [20260826_inventory_phase7_stock_flow_report.sql](20260826_inventory_phase7_stock_flow_report.sql)
- [20260910_inventory_sales_deduction_verify.sql](20260910_inventory_sales_deduction_verify.sql)
- [20260916_inventory_adjustment_units_approval_verify.sql](20260916_inventory_adjustment_units_approval_verify.sql)
- [20260916_inventory_adjustment_units_verify.sql](20260916_inventory_adjustment_units_verify.sql)
- [20260917_inventory_lots_reconcile.sql](20260917_inventory_lots_reconcile.sql)
- [20260917_inventory_lots_verify.sql](20260917_inventory_lots_verify.sql)
- [20260917_inventory_mango_legacy_fefo.sql](20260917_inventory_mango_legacy_fefo.sql)
- [20260918_inventory_mapping_cleanup.sql](20260918_inventory_mapping_cleanup.sql)
- [20260918_inventory_strict_item_mapping_test.sql](20260918_inventory_strict_item_mapping_test.sql)
- [20260923_inventory_lot_disposal.sql](20260923_inventory_lot_disposal.sql)
- [20260923_inventory_lot_disposal_verify.sql](20260923_inventory_lot_disposal_verify.sql)

## Khách hàng và phân quyền

- [2026-10-06-customer-count-real-validation.sql](2026-10-06-customer-count-real-validation.sql)
- [2026-10-06-customer-count-rollback.sql](2026-10-06-customer-count-rollback.sql)
- [2026-10-06-customer-count-validation.sql](2026-10-06-customer-count-validation.sql)
- [2026-10-06-stub-profile-name-rollback.sql](2026-10-06-stub-profile-name-rollback.sql)
- [2026-10-06-stub-profile-name-validation.sql](2026-10-06-stub-profile-name-validation.sql)
- [customer-auth-profile-link-backfill.sql](customer-auth-profile-link-backfill.sql)
- [customer-order-counting-rpc.sql](customer-order-counting-rpc.sql)
- [customer-popular-products-rpc.sql](customer-popular-products-rpc.sql)
- [customer-profile-rpc.sql](customer-profile-rpc.sql)
- [customer-profiles-source-of-truth-audit.sql](customer-profiles-source-of-truth-audit.sql)
- [customer-profiles-source-of-truth-deep-audit.sql](customer-profiles-source-of-truth-deep-audit.sql)
- [harden-customer-profile-access.sql](harden-customer-profile-access.sql)
- [monthly-customer-gifts.sql](monthly-customer-gifts.sql)
- [pos-payment-session-profiles-service-role-grant.sql](pos-payment-session-profiles-service-role-grant.sql)
- [profile-branch-rpc.sql](profile-branch-rpc.sql)
- [profiles-backfill-and-auto-sync-from-orders.sql](profiles-backfill-and-auto-sync-from-orders.sql)
- [profiles-backfill-order-totals.sql](profiles-backfill-order-totals.sql)
- [profiles-branches-source-of-truth-audit.sql](profiles-branches-source-of-truth-audit.sql)
- [supabase-profiles-migration.sql](supabase-profiles-migration.sql)

## Loyalty

- [2026-10-06-loyalty-rule-estimate-rollback.sql](2026-10-06-loyalty-rule-estimate-rollback.sql)
- [2026-10-06-loyalty-rule-estimate-validation.sql](2026-10-06-loyalty-rule-estimate-validation.sql)
- [20260905_pause_automatic_loyalty_vouchers.sql](20260905_pause_automatic_loyalty_vouchers.sql)
- [loyalty-accounts-ensure-legacy-customer-parent.sql](loyalty-accounts-ensure-legacy-customer-parent.sql)
- [loyalty-crm-voucher-rpc.sql](loyalty-crm-voucher-rpc.sql)
- [loyalty-partner-net-received-audit.sql](loyalty-partner-net-received-audit.sql)
- [loyalty-phase-3-remote-audit.sql](loyalty-phase-3-remote-audit.sql)
- [loyalty-points-rolling-60-day-audit.sql](loyalty-points-rolling-60-day-audit.sql)
- [loyalty-rpc-execute-permissions.sql](loyalty-rpc-execute-permissions.sql)
- [loyalty-v2-phase-2-audit.sql](loyalty-v2-phase-2-audit.sql)
- [loyalty-v2-phase-2-deploy-verify.sql](loyalty-v2-phase-2-deploy-verify.sql)
- [loyalty-v2-phase-2-postcheck.sql](loyalty-v2-phase-2-postcheck.sql)
- [loyalty-v2-phase-2-security-cutover.sql](loyalty-v2-phase-2-security-cutover.sql)
- [loyalty-v2-phase-4-1-runbook.sql](loyalty-v2-phase-4-1-runbook.sql)
- [loyalty-v2-phase-4-postcheck.sql](loyalty-v2-phase-4-postcheck.sql)
- [loyalty-v2-retire-legacy-rpc-audit.sql](loyalty-v2-retire-legacy-rpc-audit.sql)
- [pos-loyalty-event-rpc.sql](pos-loyalty-event-rpc.sql)
- [pos-loyalty-rpc-grants-and-partner-profile-trigger.sql](pos-loyalty-rpc-grants-and-partner-profile-trigger.sql)

## POS và thanh toán

- [20260714_secure_pos_app_releases.sql](20260714_secure_pos_app_releases.sql)
- [momo-webhook-logs.sql](momo-webhook-logs.sql)
- [pos-orders-walkin-phone-nullable.sql](pos-orders-walkin-phone-nullable.sql)
- [pos-payment-sessions-phase-1-audit.sql](pos-payment-sessions-phase-1-audit.sql)
- [pos-payment-sessions-realtime.sql](pos-payment-sessions-realtime.sql)
- [pos-shifts-phase-1-audit.sql](pos-shifts-phase-1-audit.sql)
- [pos-shifts-phase-1.sql](pos-shifts-phase-1.sql)
- [pos-shifts-phase-2-rls-shared-pos-account.sql](pos-shifts-phase-2-rls-shared-pos-account.sql)
- [pos-shifts-phase-3-cash-breakdown-audit.sql](pos-shifts-phase-3-cash-breakdown-audit.sql)
- [pos-shifts-phase-3-cash-breakdown.sql](pos-shifts-phase-3-cash-breakdown.sql)
- [sepay-pos-webhook-log.sql](sepay-pos-webhook-log.sql)
- [vietsing-19k-activate-after-pos-update.sql](vietsing-19k-activate-after-pos-update.sql)

## Tích tem

- [stamp-partner-confirmation.sql](stamp-partner-confirmation.sql)
- [stamp-program-functions.sql](stamp-program-functions.sql)
- [stamp-program-orders.sql](stamp-program-orders.sql)
- [stamp-program-schema.sql](stamp-program-schema.sql)

## Voucher

- [20260905_restore_welcome_voucher_only.sql](20260905_restore_welcome_voucher_only.sql)
- [20260906_enforce_combined_voucher_points_cap.sql](20260906_enforce_combined_voucher_points_cap.sql)
- [20260906_verify_combined_voucher_points_cap.sql](20260906_verify_combined_voucher_points_cap.sql)
- [crm-registered-voucher-audience-index.sql](crm-registered-voucher-audience-index.sql)
- [customer-voucher-backfill-postcheck.sql](customer-voucher-backfill-postcheck.sql)
- [normalized-customer-vouchers-phase-1.sql](normalized-customer-vouchers-phase-1.sql)
- [voucher-phase-2-postcheck.sql](voucher-phase-2-postcheck.sql)
- [voucher-security-phase-1a-postcheck.sql](voucher-security-phase-1a-postcheck.sql)
- [voucher-security-phase-1b-postcheck.sql](voucher-security-phase-1b-postcheck.sql)
- [voucher-usage-sync-postcheck.sql](voucher-usage-sync-postcheck.sql)

## Đánh giá

- [grab-reviews-phase-1.sql](grab-reviews-phase-1.sql)
- [review-reward-claims.sql](review-reward-claims.sql)
- [review-reward-google-maps.sql](review-reward-google-maps.sql)
- [review-reward-google-points.sql](review-reward-google-points.sql)

## Đơn hàng

- [2026-10-06-order-items-duplicate-index-rollback.sql](2026-10-06-order-items-duplicate-index-rollback.sql)
- [2026-10-06-orders-duplicate-index-rollback.sql](2026-10-06-orders-duplicate-index-rollback.sql)
- [2026-10-06-orders-duplicate-index-validation.sql](2026-10-06-orders-duplicate-index-validation.sql)
- [20260717_harden_cake_orders_public_insert_rls.sql](20260717_harden_cake_orders_public_insert_rls.sql)
- [cake-orders-and-config.sql](cake-orders-and-config.sql)
- [cake-supabase-first-step-3-order-permissions.sql](cake-supabase-first-step-3-order-permissions.sql)
- [order-items-kitchen-status.sql](order-items-kitchen-status.sql)
- [web-order-notifications.sql](web-order-notifications.sql)

## Đối tác

- [2026-10-06-items-partner-duplicate-index-validation.sql](2026-10-06-items-partner-duplicate-index-validation.sql)
- [2026-10-06-partner-orders-duplicate-index-rollback.sql](2026-10-06-partner-orders-duplicate-index-rollback.sql)
- [kitchen-nexpos-status-test-order.sql](kitchen-nexpos-status-test-order.sql)
- [kitchen-partner-items-backfill-missing-from-raw.sql](kitchen-partner-items-backfill-missing-from-raw.sql)
- [kitchen-partner-items-dedupe-line-index-cleanup.sql](kitchen-partner-items-dedupe-line-index-cleanup.sql)
- [kitchen-partner-items-line-index-contract.sql](kitchen-partner-items-line-index-contract.sql)
- [kitchen-partner-items-line-index-trigger.sql](kitchen-partner-items-line-index-trigger.sql)
- [kitchen-partner-items-line-index-unique-guard.sql](kitchen-partner-items-line-index-unique-guard.sql)
- [partner-order-points-7-day-expiry-audit.sql](partner-order-points-7-day-expiry-audit.sql)
- [partner-order-points-7-day-expiry-verify.sql](partner-order-points-7-day-expiry-verify.sql)
- [partner-order-points-7-day-expiry.sql](partner-order-points-7-day-expiry.sql)
- [partner-order-profile-ingest-contract.sql](partner-order-profile-ingest-contract.sql)
- [partner-orders-branch-fields.sql](partner-orders-branch-fields.sql)
- [partner-orders-branch-hard-link.sql](partner-orders-branch-hard-link.sql)
- [partner-orders-claim-points.sql](partner-orders-claim-points.sql)
- [partner-orders-test-claim.sql](partner-orders-test-claim.sql)
- [partner-orders-unique-nexpos-order-id.sql](partner-orders-unique-nexpos-order-id.sql)
- [partner-review-management.sql](partner-review-management.sql)

