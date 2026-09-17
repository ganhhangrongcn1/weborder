# Đồng bộ tồn theo lô — đã áp dụng Supabase

## Trạng thái

- Đã viết bản sửa và kiểm tra trong giao dịch ROLLBACK.
- Người dùng đã xác nhận phạm vi; áp dụng production thành công phiên bản `20260917001258`.
- Chưa commit/push giao diện. Đã cập nhật số dư lô, không đổi tồn tổng hoặc phiếu.
- Đối chiếu ban đầu sau triển khai: Xoài 2.369 gram trong nhóm CXĐ-TỒN-CŨ; hai lô cũ và lô Rau Răm còn 0.
- Sau đó người dùng yêu cầu giữ cách hiển thị cũ và duyệt phân bổ Xoài theo FEFO:
  lô SX-LSX-000026 = 0, SX-LSX-000028 = 2.369 gram, nhóm CXĐ Xoài = 0.
  Giữ nguyên ngày sản xuất/HSD; metadata ghi rõ đây là phân bổ theo quy ước người dùng duyệt.
- Sao lưu nguyên bản 3 lô; 31 nhóm tồn cũ chưa xác định HSD. Không còn cặp theo dõi lô lệch tồn tổng.

## Nguyên nhân xác nhận

Trigger hiện tại chỉ tạo lô nhập mua/sản xuất; các bút toán xuất thông thường không giảm remaining_quantity.
Tại lúc kiểm tra, Xoài Sơ Chế kho 30/4 còn tổng 2.369 gram nhưng hai lô còn 7.000 gram/lô.
Rau Răm tổng bằng 0 nhưng lô còn 1.200 gram.

## Phạm vi đã được người dùng duyệt

1. Đồng bộ lô theo movement đã ghi sổ: FEFO rồi FIFO; không thay đổi quyền/RPC nghiệp vụ hoặc tồn tổng.
2. Thêm khóa nguồn lô, đổi unique từ dòng phiếu sang dòng phiếu + nguồn lô để chuyển nhiều lô trong một dòng.
3. Cho phép created_by của lô để trống đối với hoàn đơn tự động; giữ foreign key khi có người thao tác.
4. Lưu phân bổ movement/lô trong bảng private để hoàn đơn trả đúng lô, giữ số lượng khi đổi đơn vị.
5. Chuyển tồn cũ không xác định lô sang nhóm không có HSD, tuyệt đối không suy đoán hạn dùng.
   Phạm vi gồm những cặp kho/mặt hàng có theo dõi hạn dùng hoặc có lô, có tổng lô khác tồn tổng.
   Kiểm tra thử hiện tạo 31 nhóm tồn chưa xác định HSD; không tạo phiếu nhập hay bút toán mới.
   Ba lô cũ được lưu nguyên bản trong bảng backup private trước khi đưa số dư về 0.
6. Chuyển đủ hàng giữ từng lô/HSD. Nhận thiếu không xác định được lô nào thì ghi chưa xác định HSD.
   Cần đối chiếu vật lý; bản sửa này không tự phân bổ lại hạn dùng từ hàng thực tế.

## Kiểm tra

- SQL transaction ROLLBACK: FEFO, chia nhiều lô, duplicate movement, hoàn bán,
  hủy, điều chỉnh, chuyển nhiều lô, nhận thiếu, 5.800 đơn vị gốc, đổi đơn vị,
  không trừ lặp khi hoàn phiếu nhập và không thay đổi tổng stock_balances: PASS.
- Node lot report: 5/5 PASS. Sửa fixture cũ sang purchaseToBaseRatio riêng của mặt hàng.
- npm run build: PASS; UTF-8 635 source files PASS. Có cảnh báo kích thước bundle hiện hữu.
- Chưa xác nhận giao diện trên website production (chưa push).
- SQL kiểm thử lại sau triển khai: PASS, toàn bộ fixture ROLLBACK.
- Advisor sau triển khai: hai thông báo INFO mới RLS bật nhưng không có policy ở hai bảng private.
  Đây là chủ đích: không cấp quyền cho anon/authenticated, chỉ RPC nghiệp vụ chạy bằng chủ sở hữu truy cập.
  Tham khảo: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Mốc đối chiếu trước triển khai (2026-09-17)

- Hash toàn bộ stock_balances: `73c6e0a6e23ea08e64780b9e6b0eafc4`.
- Movements 2.129; documents 173; document lines 2.546.
- Hash trước/sau tồn tổng giống nhau; movements `df160dcd65b19915a5f5aaacfe7568f0`,
  documents `da91cf58120ff75e9dbb640df9b779be`, lines `e955361de0c8d8761e531a8cd5a820d5` đều không đổi.
- Migration có khóa và kiểm tra hash trong cùng giao dịch để đảm bảo reconcile không sửa stock_balances.
- Khi tiếp tục phải đọc lại trạng thái thật, không coi các số này là snapshot mới nhất.

## Tệp trong phạm vi

Mới:
- `supabase/migrations/20260917001258_inventory_lot_movement_sync.sql`
- `docs/supabase-sql/20260917_inventory_lots_reconcile.sql`
- `docs/supabase-sql/20260917_inventory_lots_verify.sql`
- `docs/supabase-sql/20260917_inventory_lots_fix.md`

Cập nhật:
- `src/services/inventoryLotReportService.js`
- `scripts/inventory-lot-report.test.mjs`

## Điều chỉnh theo yêu cầu giữ giao diện cũ

- `src/pages/admin/inventory/InventoryLotReport.jsx` đã trả lại đúng nội dung trước lần sửa này, không còn diff.
- Phương án ban đầu: service lọc các nhóm accounting-only bằng metadata, trước phân trang/count; giữ nguyên lọc kho.
  Không ẩn lô vật lý không có HSD (metadata cờ không có hoặc false vẫn hiển thị).
- Thêm `docs/supabase-sql/20260917_inventory_mango_legacy_fefo.sql`:
  đã chạy ROLLBACK kiểm tra rồi COMMIT, chỉ đổi 3 dòng Xoài CN 30/4.
  Sao lưu trạng thái trước phân bổ trong private.inventory_lot_reconciliation_backup,
  revision `20260917-mango-approved-fefo`. Các lô khác và dữ liệu nghiệp vụ có hash không đổi.
- Bảng vẫn hiển thị mã lô, ngày sản xuất, hạn dùng và số còn như cũ.
  Nhóm không có lô nguồn không được tự gán hạn dùng, chỉ không hiện trong báo cáo lô vật lý.
- Kiểm tra lại: build/encoding PASS; 5/5 lot report tests PASS. Giao diện chưa push.

## Bộ lọc nhanh theo yêu cầu tiếp theo

- Thay phương án ẩn ở service bằng bộ lọc người dùng chủ động chọn: Có hạn sử dụng (mặc định),
  Sắp / đã hết hạn, Không có hạn, Tất cả. Service trở lại truy vấn ban đầu để không mất các nhóm khi chọn Tất cả.
- Giữ bộ lọc kho, nguyên liệu, tìm kiếm và các trạng thái chi tiết. Đổi lọc quay về trang 1.
- Link có tham số lô/tìm kiếm/nguyên liệu tiếp tục mở Tất cả nếu không chỉ định trạng thái,
  tránh làm mất kết quả của link cũ. Link chỉ định expiry vẫn được ưu tiên.
- Không thay đổi database hay số tồn. Giao diện chưa push.
- Cập nhật: `src/pages/admin/inventory/InventoryLotReport.jsx`,
  `src/services/inventoryLotReportCalculations.js`, `scripts/inventory-lot-report.test.mjs`, tài liệu này.
- Mới: `src/styles/admin/inventory-lot-filters.css`.
- `src/services/inventoryLotReportService.js` được trả về bản gốc, không còn diff.
- Kiểm thử bộ lọc và tính toán: 7/7 PASS.

Các tệp dirty khác trong workspace không thuộc bản sửa này.
