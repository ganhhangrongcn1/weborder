# Tạm tắt tự trừ khi bán để vận hành nhập, điều chuyển và kiểm kê

## Cách sử dụng

- Kho → Cài đặt kho → Tự trừ tồn theo bán hàng.
- Mặc định tắt cho các chi nhánh; chi nhánh mới chưa có cấu hình cũng tắt. Sau khi xóa Mini theo yêu cầu ngày 10/09/2026, còn 3 chi nhánh chính.
- Khi tắt: chốt nhận hàng, sơ chế và hủy; ngừng luân chuyển khi đếm; nhập số đếm thực tế và gửi quản lý duyệt kiểm kê theo quyền hiện có.
- Chênh lệch có thể gồm nguyên liệu đã dùng bán hàng, không mặc định là thất thoát. Không tạo thêm phiếu xuất cho phần đã điều chỉnh qua kiểm kê.
- Khi sẵn sàng: hoàn thiện định lượng và gán món, kiểm kê chốt tồn rồi bật riêng chi nhánh. Chỉ đơn tạo mới sau thời điểm bật mới được xét trừ.
- Đơn thiếu định lượng/ánh xạ vẫn bị chặn toàn bộ như trước. Xem tại Đối chiếu đơn ↔ kho.

## Phạm vi và an toàn

- Migration đã áp dụng: `supabase/migrations/20260910001326_inventory_sales_deduction_switch.sql`.
- Chỉ thêm chốt vào ba điểm: queue bán hàng, worker xử lý, thử lại sự kiện. Nội dung tính định lượng, ghi phiếu, trừ tồn, hoàn tồn giữ nguyên.
- Không cập nhật hàng loạt sự kiện lịch sử. Đơn cũ đang treo giữ nguyên lịch sử; nếu xử lý/thử lại sẽ xét công tắc và mốc bắt đầu trước khi ghi kho.
- Đơn bị loại lưu dấu trong metadata; đồng bộ lại, bật lại, thử lại đều không xóa dấu để trừ bù.
- Mốc xét đơn Website/POS/QR là `orders.created_at`; đối tác là `partner_orders.order_time`, dự phòng `created_at`, không dùng thời điểm đồng bộ lại. Sự kiện trước mốc bật cũng không được ghi bù.
- Tắt/bật lại tạo mốc mới. Lưu lại cùng chế độ không dời mốc. Có kiểm tra phiên bản cập nhật để chặn ghi đè từ màn hình cũ.
- Worker khóa dòng cấu hình trong giao dịch; thao tác lưu chờ xử lý đang chạy xong. Không đảo thứ tự khóa giữa sự kiện và cài đặt.
- Admin toàn hệ thống/Kho Tổng mới được thay đổi; tài khoản chi nhánh không được đổi và không đọc cài đặt chi nhánh khác. Không thay đổi quyền kiểm kê, điều chuyển hoặc chứng từ khác.
- Hoàn tồn đơn đã ghi trước đó vẫn chạy khi tắt, theo đúng bút toán gốc. Hủy đơn chưa từng ghi không cộng tồn.
- Hai bảng private bật RLS, không cấp quyền trực tiếp cho anon/authenticated; mặc định không có policy là chủ ý deny-all. Chỉ RPC kiểm tra quyền được truy cập. Advisor có thông báo INFO RLS-no-policy tương ứng, không mở quyền để loại thông báo.

## Kiểm tra

- 67/67 kiểm thử mã nguồn đạt: công tắc, phân quyền/menu/route, kiểm kê, định lượng, BOM và bộ lọc chứng từ.
- 16/16 kiểm tra SQL tích hợp đạt; toàn bộ fixture, bật/tắt thử, định lượng thử, phiếu và tồn thử được ROLLBACK. Không ghi/sửa đơn bán thật.
- Có kiểm tra trừ đúng định lượng một lần, replay không trừ hai lần, bật/tắt lại, đơn đối tác đồng bộ trễ, chặn thiếu định lượng, hoàn tồn một lần khi tắt và quyền Admin/Kho Tổng/chi nhánh/khách.
- 107 hàm kho ngoài ba điểm sửa có hash giữ nguyên.
- Trước/sau: 369 mục gán món; 0 định lượng; 0 chứng từ; 0 biến động; hash tồn `d41d8cd98f00b204e9800998ecf8427e` không đổi. Bốn chi nhánh vẫn tắt sau kiểm thử.
- Build và kiểm tra encoding đạt. Có cảnh báo kích thước bundle hiện có.
- ESLint đạt cho 4 file service, hook và giao diện mới.
- Đã sửa bố cục tiêu đề và nút bật/tắt theo ảnh phản hồi; ảnh tiếp theo của người dùng hiển thị nút trên một dòng. Không sửa CSS chung.
- Bản ghi Mini cùng cài đặt đang tắt và phân quyền checklist riêng đã được xóa trên Supabase theo yêu cầu; đã sao lưu riêng trên máy, không đưa bản sao lưu vào Git. Ba chi nhánh chính giữ nguyên.

## File mới

- `src/services/inventorySalesDeductionService.js`
- `src/hooks/useInventorySalesDeductionSettings.js`
- `src/pages/admin/inventory/InventorySalesDeductionSettings.jsx`
- `src/pages/admin/inventory/InventoryManualCountNotice.jsx`
- `scripts/inventory-sales-deduction.test.mjs`
- `supabase/migrations/20260910001326_inventory_sales_deduction_switch.sql`
- `docs/supabase-sql/20260910_inventory_sales_deduction_verify.sql`
- `docs/supabase-sql/20260910_inventory_sales_deduction_switch.md`

## File cập nhật

- `src/app/routeState.js`
- `src/pages/admin/adminModuleAccessPolicy.js`
- `src/pages/admin/inventory/inventoryNavigation.js`
- `src/pages/admin/inventory/InventoryWorkspace.jsx`
- `src/pages/admin/inventory/InventoryCountManager.jsx`
- `src/pages/admin/inventory/InventorySalesReconciliation.jsx`
- `src/services/inventorySalesConfigurationService.js`
