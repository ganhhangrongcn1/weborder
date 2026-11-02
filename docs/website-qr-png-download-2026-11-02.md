# Giữ nhấn giữ QR để lưu PNG — 02/11/2026

Anh xác nhận trước đây nhấn giữ ảnh QR để lưu và mở được, không yêu cầu nút tải mới. Phương án nút tải PNG chưa từng publish đã được bỏ.

Kiểm tra HTTP thật bằng tài khoản giả: URL VietQR `compact2.png` trả 301 sang `.svg`, ảnh đích trả 200 `image/svg+xml`, có `Access-Control-Allow-Origin: *`. Đây là nguyên nhân dù URL đuôi PNG, nhấn giữ lại lưu SVG.

Giữ nguyên ảnh VietQR và thao tác nhấn giữ. Sau khi ảnh tải xong, dùng canvas chép nguyên ảnh (logo, QR, người nhận, số tiền) sang PNG data URL rồi gắn lại vào img. Không tự tạo nội dung QR, không tạo phiên mới hay thay tài khoản. Trong lúc tải vẫn dùng URL VietQR, không thêm request server thanh toán. PNG gắn với đúng URL phiên để không hiện nhầm ảnh đơn trước. MoMo không thay đổi. Nếu trình duyệt không cho chuyển ảnh, QR gốc vẫn quét được và có hướng dẫn thử Chrome/Safari.

Lint và encoding/build Vite được kiểm tra trước khi publish. Preview localhost đã chạy nhưng công cụ trình duyệt không kết nối được, nên chưa xác nhận nhấn giữ trên điện thoại thật. Anh tải lại trang rồi thử lưu ảnh sau khi bản mới triển khai.

File mới: `src/services/paymentQrImageService.js`, báo cáo này. Cập nhật: `src/features/orders/OrderSuccessView.jsx`. Không đổi Supabase, APK hay cấu hình ngân hàng.
