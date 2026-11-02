# Giữ nhấn giữ QR để lưu PNG — 02/11/2026

Anh xác nhận trước đây nhấn giữ ảnh QR để lưu và mở được, không yêu cầu nút tải mới. Phương án nút tải PNG chưa từng publish đã được bỏ.

Kiểm tra HTTP thật bằng tài khoản giả: URL VietQR `compact2.png` trả 301 sang `.svg`, ảnh đích trả 200 `image/svg+xml`, có `Access-Control-Allow-Origin: *`. Đây là nguyên nhân dù URL đuôi PNG, nhấn giữ lại lưu SVG.

Giữ nguyên ảnh VietQR và thao tác nhấn giữ. Sau khi ảnh tải xong, dùng canvas chép nguyên ảnh (logo, QR, người nhận, số tiền) sang PNG data URL rồi gắn lại vào img. Không tự tạo nội dung QR, không tạo phiên mới hay thay tài khoản. Trong lúc tải vẫn dùng URL VietQR, không thêm request server thanh toán. PNG gắn với đúng URL phiên để không hiện nhầm ảnh đơn trước. MoMo không thay đổi. Nếu trình duyệt không cho chuyển ảnh, QR gốc vẫn quét được và có hướng dẫn thử Chrome/Safari.

Lint và encoding/build Vite được kiểm tra trước khi publish. Preview localhost đã chạy nhưng công cụ trình duyệt không kết nối được, nên chưa xác nhận nhấn giữ trên điện thoại thật. Anh tải lại trang rồi thử lưu ảnh sau khi bản mới triển khai.

File mới: `src/services/paymentQrImageService.js`, báo cáo này. Cập nhật: `src/features/orders/OrderSuccessView.jsx`. Không đổi Supabase, APK hay cấu hình ngân hàng.

## Sửa tiếp sau kiểm tra trên điện thoại

Anh gửi ảnh QR không tải được sau bản 2d835e6. Đối chiếu source trước Pay2S (`2add423^`): img dùng URL VietQR PNG trực tiếp, không crossOrigin, không chuyển ảnh. Bản thêm crossOrigin để rasterize đi qua redirect PNG → SVG; redirect 301 không có CORS, dù ảnh SVG đích có CORS.

Sửa nguồn rasterize sang SVG đích trực tiếp, chỉ cho host img.vietqr.io và path /image/*.png; giữ nguyên tài khoản và query. Nếu tải nguồn này lỗi, img được remount về đúng URL gốc, bỏ crossOrigin như source SePay cũ. Lỗi chuyển định dạng không được làm mất ảnh QR. Cache PNG và trạng thái fallback gắn với URL phiên, không dùng ảnh phiên cũ.

Đã kiểm tra browser thật trên trang test riêng bằng dữ liệu giả, dùng chính service runtime: ảnh đích `data:image/png;base64`, kích thước 540×640. Đã lưu byte PNG rồi giải mã độc lập bằng ZXing: bank 970422, account thử 00123456789, amount 2800, reference POS20261102201308. Đây là nguyên ảnh VietQR chuyển định dạng, không tạo QR mới. Hai test URL/giữ query đạt; lint, encoding và npm run build đạt. Chưa xác nhận nhấn giữ trên chính điện thoại anh.

File cập nhật thêm: service ảnh và OrderSuccessView; tạo `scripts/payment-qr-raster-source.test.mjs`.
