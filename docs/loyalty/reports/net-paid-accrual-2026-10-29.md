# Tích điểm theo tiền thực trả sau ưu đãi và điểm

- Nguồn: `origin/main` tại `7235a43597c9ae5eaf8405eb6234f206c779ed32`, trùng deployment production trước thay đổi.
- Nguyên nhân: snapshot máy chủ và dự kiến checkout chỉ trừ khuyến mãi, chưa trừ giảm bằng điểm.
- Quy tắc mới cho đơn trực tiếp mới: lấy phần tiền món sau khuyến mãi và điểm, không vượt quá tổng phải trả trừ phí giao hàng. Phí giao hàng vẫn không tích điểm. Làm tròn giảm tiền mặt cũng làm giảm tiền tích điểm.
- Giữ nguyên tỷ lệ tích điểm theo hạng, hạn mức sử dụng điểm, giới hạn kết hợp ưu đãi, quyền truy cập và cơ chế chống cộng trùng.
- Đơn đối tác tiếp tục dùng số tiền thực nhận theo hợp đồng hiện có.
- Không cập nhật lại đơn cũ, ledger hoặc số dư. Checksum đơn được tra cứu và ledger tương ứng không đổi sau triển khai.
- POS và QR bill lấy `expected_earn_points` từ máy chủ; không thay đổi mã native hoặc phát hành APK.

## Kiểm tra

- 9 kiểm tra Node đạt: đơn 40.000đ dùng 9.000 điểm trả 31.000đ nhận 3.100 điểm; voucher kết hợp điểm; phí giao hàng; 0đ; giảm thêm/làm tròn; payload checkout; hạn mức cũ.
- 6 kiểm tra trigger máy chủ đạt trước và sau migration: chỉ ghi bảng tạm, hoàn tác transaction; không tạo đơn, không ghi điểm hoặc in bill thật.
- Helper SQL nằm trong schema riêng; `anon` và `authenticated` không có quyền gọi trực tiếp.
- ESLint các file JS thay đổi và kiểm tra UTF-8 đạt.
- Các cảnh báo security advisor tồn tại trước thay đổi không thuộc phạm vi chỉnh sửa này.

## File thay đổi

- `src/services/loyaltyEarnAmountService.js`: helper tính tiền món thực trả.
- `src/features/checkout/checkoutPricing.js`: dự kiến tích điểm sau toàn bộ giảm giá.
- `src/services/checkoutOrderService.js`: payload tiền tích điểm.
- `src/services/orderService.js`: tính lại từ tiền sau xác thực voucher thay vì tin căn cứ truyền vào.
- `scripts/loyalty-net-paid.test.mjs`: kiểm tra hồi quy.
- `supabase/migrations/20261029033530_loyalty_earn_on_net_paid.sql`: migration đã áp dụng.
- `docs/supabase-sql/2026-10-29-loyalty-earn-on-net-paid.sql`: bản SQL tham chiếu.
- `docs/supabase-sql/2026-10-29-loyalty-earn-on-net-paid-validation.sql`: kiểm tra trigger trong bảng tạm.
- `docs/supabase-sql/2026-10-29-loyalty-earn-on-net-paid-rollback.sql`: định nghĩa gốc để hoàn tác khi cần.
- Báo cáo này.

## Giới hạn xác nhận

Chưa thử mua hàng, thanh toán hoặc in trên máy tại quán. Đơn đã tạo trước khi triển khai giữ snapshot cũ. Sổ điểm cũ không bị điều chỉnh hồi tố.
