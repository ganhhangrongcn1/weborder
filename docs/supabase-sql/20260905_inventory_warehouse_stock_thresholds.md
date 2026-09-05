# Ngưỡng tồn theo kho

- Migration: `supabase/migrations/20260905001008_inventory_warehouse_stock_thresholds.sql`.
- `inventory_items.minimum_stock` và `reorder_point`: mức Kho Tổng, đồng thời là fallback cho dữ liệu cũ.
- `metadata.stock_thresholds.branch`: cặp `minimumStock`, `reorderPoint` mặc định cho chi nhánh; `null` kế thừa Kho Tổng.
- `metadata.stock_thresholds.warehouses[warehouse UUID]`: cặp ngưỡng riêng cho kho chi nhánh. Xóa cặp để dùng mặc định chi nhánh.
- Tất cả ngưỡng lưu theo đơn vị gốc. Form nhập/hiển thị theo đơn vị mua bằng tỷ lệ của từng nguyên vật liệu.
- Giá trị 0 là cấu hình rõ ràng; không thay bằng fallback. Không có cấu hình mới thì giữ nguyên ngưỡng cũ, không cần cập nhật hàng loạt nguyên liệu.
- Chỉ kho loại `branch` dùng ngưỡng chi nhánh. Kho khác dùng các cột ngưỡng hiện có.
- Báo cáo, cảnh báo, số đếm menu và RPC tổng quan dùng cùng thứ tự ưu tiên. Tồn bằng 0 hoặc âm luôn cảnh báo.
- Quyền ghi dùng RLS cập nhật nguyên vật liệu hiện có. Migration không thay đổi quyền kho và không ghi tồn/chứng từ.

## File trong phạm vi thay đổi

Tạo mới:

- `src/services/inventoryStockThresholds.js`
- `src/pages/admin/inventory/InventoryStockThresholdFields.jsx`
- `scripts/inventory-stock-thresholds.test.mjs`
- `supabase/migrations/20260905001008_inventory_warehouse_stock_thresholds.sql`
- `docs/supabase-sql/20260905_inventory_warehouse_stock_thresholds.md`

Cập nhật:

- `src/services/inventoryMasterDataService.js`
- `src/services/inventoryStockReportCalculations.js`
- `src/services/inventoryStockReportService.js`
- `src/services/inventoryAlertCalculations.js`
- `src/pages/admin/inventory/InventoryStockReport.jsx`
- `src/pages/admin/inventory/InventoryMasterDataModal.jsx`
- `src/pages/admin/inventory/InventoryCatalogManager.jsx`
- `src/styles/admin/inventory.css`

## Kiểm tra

- 41/41 kiểm thử tự động đạt, gồm ngưỡng mới, báo cáo, cảnh báo, nguyên vật liệu và phân quyền.
- 7/7 trường hợp kiểm tra SQL đạt; ngưỡng nguyên vật liệu cũ không thay đổi.
- Build và kiểm tra encoding đạt. Chưa xác nhận trực quan bằng tài khoản đăng nhập trên trình duyệt.
