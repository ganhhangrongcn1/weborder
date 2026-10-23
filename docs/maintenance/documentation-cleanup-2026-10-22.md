# Báo cáo sắp xếp tài liệu ngày 22 tháng 10 năm 2026

## Kết quả

- Kiểm kê 61 tài liệu Markdown được Git quản lý, gồm hướng dẫn gốc và README sát mã nguồn.
- Sắp xếp 57 tài liệu trong docs theo 10 chức năng; chuyển báo cáo theo đợt vào reports và gắn nhãn lịch sử.
- Giữ nguyên 154 file SQL tham chiếu và toàn bộ migration; bổ sung mục lục SQL theo chức năng.
- Không có file trùng nội dung hoàn toàn trong docs trước khi dọn; không xóa tài liệu nghiệp vụ.
- Sửa tham chiếu đến tài liệu đã chuyển và đường dẫn SQL cũ khi có file đích chính xác.
- README của POS, inventory-app và lớp Supabase giữ cạnh mã nguồn, có liên kết từ mục lục.

## Các điểm cần phân biệt khi đọc

- Báo cáo kiểm kê Kho tháng 8 có các mốc trước và sau triển khai trong cùng file; không dùng số lượng bảng ở đó làm trạng thái hiện tại.
- Tài liệu data source chứa cả hợp đồng và nhật ký refactor; không coi mọi mục kế hoạch là việc còn tồn đọng.
- Tài liệu loyalty phase 1/2 là lịch sử; luồng điểm runtime là điểm đọc đầu tiên cho RPC.
- Báo cáo quà tháng đã ghi chương trình ngừng sử dụng; dữ liệu lịch sử vẫn phục vụ đối soát.
- Hướng dẫn QR tồn tại nhưng feature flag web hiện tắt; POS web chuyển sang trang tải app.

## Đường dẫn cũ và mới

| Đường dẫn cũ | Tài liệu hiện tại |
| --- | --- |
| `docs/admin-ui-ux-audit-and-roadmap.md` | [docs/admin/admin-ui-ux-audit-and-roadmap.md](../admin/admin-ui-ux-audit-and-roadmap.md) |
| `docs/checklist-app-phase-0-contract.md` | [docs/checklist/checklist-app-phase-0-contract.md](../checklist/checklist-app-phase-0-contract.md) |
| `docs/checklist-app-phase-1-report.md` | [docs/checklist/reports/checklist-app-phase-1-report.md](../checklist/reports/checklist-app-phase-1-report.md) |
| `docs/checklist-app-phase-2-report.md` | [docs/checklist/reports/checklist-app-phase-2-report.md](../checklist/reports/checklist-app-phase-2-report.md) |
| `docs/checklist-app-phase-3-report.md` | [docs/checklist/reports/checklist-app-phase-3-report.md](../checklist/reports/checklist-app-phase-3-report.md) |
| `docs/checklist-app-phase-4-report.md` | [docs/checklist/reports/checklist-app-phase-4-report.md](../checklist/reports/checklist-app-phase-4-report.md) |
| `docs/checklist-app-roadmap.md` | [docs/checklist/checklist-app-roadmap.md](../checklist/checklist-app-roadmap.md) |
| `docs/checklist-phase-4-dashboard-spec.md` | [docs/checklist/checklist-phase-4-dashboard-spec.md](../checklist/checklist-phase-4-dashboard-spec.md) |
| `docs/customer-profiles-regression-checklist.md` | [docs/customers/customer-profiles-regression-checklist.md](../customers/customer-profiles-regression-checklist.md) |
| `docs/data-source-of-truth.md` | [docs/architecture/data-source-of-truth.md](../architecture/data-source-of-truth.md) |
| `docs/gift-order-counting-source-of-truth-audit.md` | [docs/loyalty/reports/gift-order-counting-source-of-truth-audit.md](../loyalty/reports/gift-order-counting-source-of-truth-audit.md) |
| `docs/inventory-migration-drift-audit.md` | [docs/inventory/reports/inventory-migration-drift-audit.md](../inventory/reports/inventory-migration-drift-audit.md) |
| `docs/inventory-phase3-deployment-readiness.md` | [docs/inventory/reports/inventory-phase3-deployment-readiness.md](../inventory/reports/inventory-phase3-deployment-readiness.md) |
| `docs/inventory-roadmap.md` | [docs/inventory/inventory-roadmap.md](../inventory/inventory-roadmap.md) |
| `docs/inventory-techres-operating-contract.md` | [docs/inventory/inventory-techres-operating-contract.md](../inventory/inventory-techres-operating-contract.md) |
| `docs/inventory-techres-settings-forms-audit.md` | [docs/inventory/reports/inventory-techres-settings-forms-audit.md](../inventory/reports/inventory-techres-settings-forms-audit.md) |
| `docs/inventory-techres-warehouse-settings-audit.md` | [docs/inventory/reports/inventory-techres-warehouse-settings-audit.md](../inventory/reports/inventory-techres-warehouse-settings-audit.md) |
| `docs/loyalty-runtime-source-of-truth.md` | [docs/loyalty/loyalty-runtime-source-of-truth.md](../loyalty/loyalty-runtime-source-of-truth.md) |
| `docs/loyalty-v2-phase-1-contract.md` | [docs/loyalty/reports/loyalty-v2-phase-1-contract.md](../loyalty/reports/loyalty-v2-phase-1-contract.md) |
| `docs/loyalty-v2-phase-2-runbook.md` | [docs/loyalty/reports/loyalty-v2-phase-2-runbook.md](../loyalty/reports/loyalty-v2-phase-2-runbook.md) |
| `docs/momo-qr-order-guide.md` | [docs/payments/momo-qr-order-guide.md](../payments/momo-qr-order-guide.md) |
| `docs/n8n-kitchen-partner-item-line-index-contract.md` | [docs/integrations/n8n-kitchen-partner-item-line-index-contract.md](../integrations/n8n-kitchen-partner-item-line-index-contract.md) |
| `docs/n8n-nexpos-partner-orders-mapping.md` | [docs/integrations/n8n-nexpos-partner-orders-mapping.md](../integrations/n8n-nexpos-partner-orders-mapping.md) |
| `docs/n8n-partner-customer-profile-hydration.md` | [docs/integrations/n8n-partner-customer-profile-hydration.md](../integrations/n8n-partner-customer-profile-hydration.md) |
| `docs/pos-mobile-react-native-plan.md` | [docs/pos/pos-mobile-react-native-plan.md](../pos/pos-mobile-react-native-plan.md) |
| `docs/sepay-pos-phase-c-guide.md` | [docs/payments/sepay-pos-phase-c-guide.md](../payments/sepay-pos-phase-c-guide.md) |
| `docs/source-of-truth-live-regression-checklist.md` | [docs/architecture/source-of-truth-live-regression-checklist.md](../architecture/source-of-truth-live-regression-checklist.md) |
| `docs/stamp-confirmation-receipt-2026-10-06.md` | [docs/loyalty/reports/stamp-confirmation-receipt-2026-10-06.md](../loyalty/reports/stamp-confirmation-receipt-2026-10-06.md) |
| `docs/stamp-program-rollout.md` | [docs/loyalty/reports/stamp-program-rollout.md](../loyalty/reports/stamp-program-rollout.md) |
| `docs/stamp-receipt-circles.md` | [docs/loyalty/reports/stamp-receipt-circles.md](../loyalty/reports/stamp-receipt-circles.md) |
| `docs/stamp-supabase-deployment-2026-10-06.md` | [docs/loyalty/reports/stamp-supabase-deployment-2026-10-06.md](../loyalty/reports/stamp-supabase-deployment-2026-10-06.md) |
| `docs/supabase-improvement-proposals-2026-10-06.md` | [docs/supabase/reports/supabase-improvement-proposals-2026-10-06.md](../supabase/reports/supabase-improvement-proposals-2026-10-06.md) |
| `docs/supabase-optimization-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-2026-10-06.md](../supabase/reports/supabase-optimization-2026-10-06.md) |
| `docs/supabase-optimization-phase10-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-phase10-2026-10-06.md](../supabase/reports/supabase-optimization-phase10-2026-10-06.md) |
| `docs/supabase-optimization-phase11-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-phase11-2026-10-06.md](../supabase/reports/supabase-optimization-phase11-2026-10-06.md) |
| `docs/supabase-optimization-phase12-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-phase12-2026-10-06.md](../supabase/reports/supabase-optimization-phase12-2026-10-06.md) |
| `docs/supabase-optimization-phase13-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-phase13-2026-10-06.md](../supabase/reports/supabase-optimization-phase13-2026-10-06.md) |
| `docs/supabase-optimization-phase14-2026-10-07.md` | [docs/supabase/reports/supabase-optimization-phase14-2026-10-07.md](../supabase/reports/supabase-optimization-phase14-2026-10-07.md) |
| `docs/supabase-optimization-phase2-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-phase2-2026-10-06.md](../supabase/reports/supabase-optimization-phase2-2026-10-06.md) |
| `docs/supabase-optimization-phase3-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-phase3-2026-10-06.md](../supabase/reports/supabase-optimization-phase3-2026-10-06.md) |
| `docs/supabase-optimization-phase4-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-phase4-2026-10-06.md](../supabase/reports/supabase-optimization-phase4-2026-10-06.md) |
| `docs/supabase-optimization-phase5-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-phase5-2026-10-06.md](../supabase/reports/supabase-optimization-phase5-2026-10-06.md) |
| `docs/supabase-optimization-phase6-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-phase6-2026-10-06.md](../supabase/reports/supabase-optimization-phase6-2026-10-06.md) |
| `docs/supabase-optimization-phase7-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-phase7-2026-10-06.md](../supabase/reports/supabase-optimization-phase7-2026-10-06.md) |
| `docs/supabase-optimization-phase8-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-phase8-2026-10-06.md](../supabase/reports/supabase-optimization-phase8-2026-10-06.md) |
| `docs/supabase-optimization-phase9-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-phase9-2026-10-06.md](../supabase/reports/supabase-optimization-phase9-2026-10-06.md) |
| `docs/supabase-optimization-publication-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-publication-2026-10-06.md](../supabase/reports/supabase-optimization-publication-2026-10-06.md) |
| `docs/supabase-optimization-roadmap-2026-10-06.md` | [docs/supabase/reports/supabase-optimization-roadmap-2026-10-06.md](../supabase/reports/supabase-optimization-roadmap-2026-10-06.md) |
| `docs/supabase-optimization-roadmap-2026-10-07.md` | [docs/supabase/reports/supabase-optimization-roadmap-2026-10-07.md](../supabase/reports/supabase-optimization-roadmap-2026-10-07.md) |
| `docs/supabase-preview-release-check-2026-10-06.md` | [docs/supabase/reports/supabase-preview-release-check-2026-10-06.md](../supabase/reports/supabase-preview-release-check-2026-10-06.md) |
| `docs/supabase-project-review-2026-10-07.md` | [docs/supabase/reports/supabase-project-review-2026-10-07.md](../supabase/reports/supabase-project-review-2026-10-07.md) |
| `docs/supabase-sql/20260905_inventory_warehouse_stock_thresholds.md` | [docs/inventory/reports/20260905_inventory_warehouse_stock_thresholds.md](../inventory/reports/20260905_inventory_warehouse_stock_thresholds.md) |
| `docs/supabase-sql/20260910_inventory_sales_deduction_switch.md` | [docs/inventory/reports/20260910_inventory_sales_deduction_switch.md](../inventory/reports/20260910_inventory_sales_deduction_switch.md) |
| `docs/supabase-sql/20260916_inventory_adjustment_units_fix.md` | [docs/inventory/reports/20260916_inventory_adjustment_units_fix.md](../inventory/reports/20260916_inventory_adjustment_units_fix.md) |
| `docs/supabase-sql/20260917_inventory_lots_fix.md` | [docs/inventory/reports/20260917_inventory_lots_fix.md](../inventory/reports/20260917_inventory_lots_fix.md) |
| `docs/supabase-sql/20260918_inventory_strict_item_mapping.md` | [docs/inventory/reports/20260918_inventory_strict_item_mapping.md](../inventory/reports/20260918_inventory_strict_item_mapping.md) |
| `docs/vietsing-19k-pos-2026-10.md` | [docs/pos/reports/vietsing-19k-pos-2026-10.md](../pos/reports/vietsing-19k-pos-2026-10.md) |

## Kiểm chứng

Kiểm tra đích liên kết Markdown nội bộ và kiểm tra encoding mã nguồn đều đạt. SQL/migration được đối chiếu với Git HEAD và giữ nguyên byte. Phạm vi là tài liệu repository; không xác minh lại các tuyên bố production trong báo cáo cũ.

## Tham chiếu lịch sử chưa có file trong repository

- `docs/supabase-sql/2026-10-06-analytics-uuid-join-candidate.sql` và `docs/supabase-security-rollout-2026-10-06.md` được nhắc trong báo cáo tối ưu 06/10 nhưng không có trong bản checkout. Giữ nguyên tên trong nội dung lịch sử, không tạo tài liệu giả để lấp chỗ trống.
- Bỏ liên kết ảnh preview đã mất ở báo cáo tích tem; giữ ghi chú đường dẫn ảnh tạm để đối chiếu.

## File bổ sung và cập nhật ngoài bảng di chuyển

- `AGENTS.md`: cập nhật vị trí tài liệu, quy tắc Markdown và RPC loyalty hiện hành.
- `scripts/check-doc-links.py`: kiểm tra đích file của liên kết Markdown; không kiểm tra URL ngoài hoặc anchor.
- `docs/README.md`: mục lục chung.
- `docs/supabase-sql/README.md`: danh mục 154 SQL giữ nguyên vị trí.
- `docs/maintenance/documentation-cleanup-2026-10-22.md`: báo cáo này.
- `docs/architecture/README.md`: mục lục chức năng.
- `docs/customers/README.md`: mục lục chức năng.
- `docs/loyalty/README.md`: mục lục chức năng.
- `docs/payments/README.md`: mục lục chức năng.
- `docs/pos/README.md`: mục lục chức năng.
- `docs/integrations/README.md`: mục lục chức năng.
- `docs/inventory/README.md`: mục lục chức năng.
- `docs/checklist/README.md`: mục lục chức năng.
- `docs/admin/README.md`: mục lục chức năng.
- `docs/supabase/README.md`: mục lục chức năng.

