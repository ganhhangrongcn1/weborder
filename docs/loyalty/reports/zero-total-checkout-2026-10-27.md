# Sửa thanh toán đơn 0đ — 27/10/2026

- Lỗi: CheckoutView có hai effect chọn hình thức thanh toán. Effect đổi sang pickup gán lại MoMo sau effect chọn counter cho đơn 0đ; do cập nhật cùng lượt, giá trị cuối có thể giữ MoMo. Trigger đổi tem đã chặn phương thức này cho đơn 0đ.
- Sửa: tính hình thức thanh toán hợp lệ ngay trong render từ tổng tiền, lựa chọn khách và cấu hình chi nhánh; bỏ hai effect ghi đè. CTA, lựa chọn và hộp xác nhận cùng dùng giá trị đó.
- Đơn 0đ chỉ có tại quầy, ghi rõ không cần thanh toán. Payload và createOrderAsync đều chuẩn hóa counter, không tạo proof/luồng chờ thanh toán MoMo/QR. Không tự đánh dấu đã trả tiền từ phía khách.
- Có tiền phải thu thì hiện lại các phương thức đã bật tại chi nhánh; giữ lựa chọn hợp lệ của khách. Đổi tem vẫn nhận tại quán, giữ nguyên giữ/trừ/hoàn tem và quyền phía máy chủ.
- Test `scripts/checkout-zero-total.test.mjs`: lựa chọn MoMo/QR cũ, tổng 0, thêm món có tiền, giao hàng, payload, HTML một hình thức duy nhất và thực thi createOrderAsync với adapter giả lập (0đ preparing, có tiền pending_payment).
- ESLint phạm vi sửa và kiểm tra encoding đạt. Script SQL giả lập cũ `stamp-program.test.mjs` chưa chạy được do thiếu gói PGlite trong thư mục tmp; không thay đổi SQL trong bản sửa này. Không tạo đơn hoặc đổi tem thật.
- `npm run build` đạt: 705 file kiểm tra encoding, 5313 module Vite.
