# Khôi phục hiển thị QR website — 02/11/2026

Theo yêu cầu anh, trả `OrderSuccessView.jsx` và `qrPaymentService.js` về đúng nội dung commit `761a536`, trước tối ưu 0.4.35. Website lại dùng ảnh VietQR theo snapshot tài khoản của phiên; không ép vùng gọi Edge Function. Vẫn đợi lưu phiên thành công trước khi hiện QR. Giữ Pay2S–MB, cấu hình các chi nhánh, POS và giao dịch nguyên vẹn. Không đổi Edge Function hay cơ sở dữ liệu trong lần hoàn tác này.

Đối soát ban đầu đơn `GHR261102195836710`: ảnh khách gửi báo chuyển thành công 2.800đ lúc 19:59 vào MB, nội dung khớp đơn. Server có phiên Pay2S tạo 19:58:47 giờ Việt Nam, đang `pending_payment`, chưa có provider transaction id. Bảng `pay2s_webhook_receipts` chưa nhận bản ghi tương ứng khi kiểm tra; hai bản ghi trước đó đã processed. Chưa xác định Pay2S chưa gửi, gửi lỗi xác thực, hay giao dịch ngân hàng chưa được đồng bộ sang Pay2S. Không coi việc khôi phục ảnh QR là đã sửa webhook; không tự đánh dấu paid từ suy đoán.

Kiểm tra: lint hai file, 7 bài kiểm tra Pay2S (gồm snapshot MB và chờ phiên), encoding và `npm run build` đạt. Cần xác nhận giao dịch trong Pay2S, lịch sử gửi webhook và trạng thái đơn/Kitchen sau khi webhook được xử lý. Không yêu cầu khách chuyển tiền lại.

File cập nhật: `src/features/orders/OrderSuccessView.jsx`, `src/services/qrPaymentService.js`. File mới: báo cáo này.

## Kết quả đối soát sau đó

Webhook thật đến lúc 20:04:56.528 giờ Việt Nam, transaction `34201101`; xử lý hoàn tất 20:04:57.278. Phiên chuyển `converted`, đủ 2.800đ. So với ảnh chuyển khoản 19:59, thông báo đến server trễ khoảng 6 phút; chưa xác định phần trễ nằm ở MB đồng bộ sang Pay2S hay Pay2S gửi webhook. Không có thao tác đánh dấu paid thủ công.

Đơn hiển thị `paymentStatus=paid`, `kitchen_status=done`, `status=ready_for_pickup` lúc 20:05:23. Lệnh `customer_bill` do `pay2s_webhook` tạo, POS báo `printed` 20:05:01, retry_count 0. Đây là trạng thái server/POS báo, chưa thay thế xác nhận giấy thực tế của anh.

Website production đã READY với commit `027ca09f3f8ddffeb69baaf8280ffff1de5267e0`, alias `ganhhangrong.vn`. Trả cách hiển thị cũ không bảo đảm xử lý được độ trễ thông báo Pay2S; cần kiểm tra lịch sử đồng bộ/gửi webhook phía nhà cung cấp nếu lặp lại.
