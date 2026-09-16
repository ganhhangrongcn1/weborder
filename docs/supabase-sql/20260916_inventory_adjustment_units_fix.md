# Giữ đơn vị được chọn khi điều chỉnh tồn

- Nguyên nhân: trigger tự ghi đè đơn vị của phiếu điều chỉnh về đơn vị hiển thị nhưng giữ nguyên số lượng.
- Sửa duy nhất `private.inventory_normalize_document_line_unit`: giữ `unit_id`, vẫn tính tỷ lệ bằng `inventory_item_unit_to_base`. Không đổi quyền hoặc hàm duyệt.
- Đã áp dụng migration `20260916000853_inventory_adjustment_preserve_selected_unit.sql` trên Supabase.
- Không sửa phiếu cũ, không bù tồn. Người dùng tự lập phiếu bổ sung.

## Xác minh

- 133 mã đang hoạt động; 101 mã có đơn vị mua khác đơn vị gốc, cùng có nguy cơ nếu chọn đơn vị khác đơn vị bị ép trước đây.
- 1.197 kiểm tra trigger đạt: tạo/sửa, tăng/giảm, đơn vị gốc/mua, tỷ lệ bị gửi sai được tính lại, đơn vị ngoài cấu hình bị từ chối. Dữ liệu thử nằm trong bảng tạm và rollback.
- Kiểm tra duyệt thực tế trong giao dịch rollback: +1 Kg và -1 Kg ghi 1.000 Gram; gọi duyệt lại không tạo bút toán trùng.
- Hash dòng phiếu trước/sau: `6c577d589c845b7bce7a338b2e2b1688`; hash tồn: `c5b649ca0710be4dc307b5725af814a1`; 964 biến động. Không thay đổi dữ liệu thật.
- Node regression: 10/11 đạt; bài cũ `service lưu bốn mức tồn theo đơn vị gốc` không đạt (6 so với 1200). Các file JavaScript liên quan không có diff và không được sửa trong nhiệm vụ này.
- Không thể suy ra chắc chắn đơn vị người dùng đã chọn trên mọi phiếu lịch sử vì trigger đã ghi đè trước khi lưu; không tự quy đổi các phiếu cũ dựa trên phỏng đoán.

## File

- Migration: `supabase/migrations/20260916000853_inventory_adjustment_preserve_selected_unit.sql`
- Kiểm tra tất cả mã: `docs/supabase-sql/20260916_inventory_adjustment_units_verify.sql`
- Kiểm tra duyệt: `docs/supabase-sql/20260916_inventory_adjustment_units_approval_verify.sql`
- Tài liệu này.
