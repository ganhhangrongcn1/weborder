# Thông báo Zalo cho đơn website qua Pay2S

- Workflow n8n `Nhận Đơn Đặt Hàng` đang Active, Webhook POST nối tới node gửi Zalo hiện có. Node gửi đọc `body.zaloMessage`; không đổi nhóm nhận hay credential.
- Nguyên nhân: Pay2S webhook trước đây chỉ xử lý thanh toán, Kitchen, in bill và loyalty; chưa gọi thông báo website.
- Bổ sung gọi helper thông báo sau khi thanh toán và bill được lưu thành công. Session `qr_order` có thể là website hoặc POS, nên helper kiểm tra thêm `metadata.orderSource`; chỉ website được gửi.
- Dùng khóa sự kiện `orderId:payment_paid` trong `web_order_notifications` để chống gửi trùng, kể cả khi receipt chưa hoàn tất và provider gửi lại.
- Pay2S chỉ gửi event, eventKey, orderId, orderCode và zaloMessage tới workflow hiện có; không gửi toàn bộ metadata/raw giao dịch.
- Giữ luồng COD/thanh toán tại quầy qua `web-order-notification-api`, giữ SePay/MoMo hiện có.
- Lỗi thông báo được ghi trong ledger và log, không làm hỏng thanh toán/Kitchen. Không tự gửi lại sự kiện đã ghi failed/processing: cần đối chiếu n8n trước để tránh trùng khi phản hồi mạng bị mất.
- Workflow trả lời Immediately: ledger `sent` xác nhận n8n nhận HTTP, chưa chứng minh node Zalo giao tin thành công. Kiểm tra Executions và tin thực tế khi có đơn mới.
- Không gửi lại đơn cũ hoặc tạo tin thử vào nhóm bán hàng.

## Kiểm tra và triển khai

- `node --test scripts/pay2s-zalo-notification.test.mjs scripts/pay2s-webhook.test.mjs`: 5 kiểm thử đạt; gồm payload tối thiểu, gửi một lần, receipt lặp, POS và lỗi n8n.
- TypeScript check Edge Function: đạt.
- Supabase `pay2s-payment-webhook` version 6 ACTIVE; giữ xác thực Bearer riêng, verify_jwt=false như bản trước.
- Backup bản live version 5 tại `.tmp/pay2s-before-zalo-v5.json` (không đưa vào Git).
- Không thay đổi frontend hay APK. Cần đơn website mới để xác nhận tin về thiết bị thật.
