# Lấy đơn mới theo ID — 02/11/2026

## Phạm vi được anh cho phép

Bốn HUB đang bật, giữ polling 30 giây, logic đơn/món/tiền/điểm/tem,
bill server, in lại và in tem. Không bật HUB tắt, không tạo giao dịch thử.

## Thay đổi

- Worker order-id-v2 đọc đúng trường đã xác minh qua GF-222:
  notifications.data.order_ids; print_bill.data.order_id; giữ status_change.order_ids.
- Broker giữ các ID này sau kiểm tra scope và giới hạn 32 ID; database đưa
  vào hàng đợi ID hiện có. ID thiếu/sai/overflow và reconnect vẫn đối soát HUB.
- Sự kiện print chỉ yêu cầu lấy snapshot REST, không trực tiếp in. Importer
  vẫn kiểm identity/HUB, chuẩn hóa, giao dịch, lease và chống snapshot cũ.
- Hai topic có thể cùng chỉ một đơn; hàng đợi vẫn một khóa HUB/identity với
  generation để không mất cập nhật. Có thể GET lại, không tạo đơn/bill trùng:
  khóa identity và auto_bill_key không đổi. Không thay importer v44.
- Không coi mọi notification là tạo mới; GET chi tiết xác định trạng thái thật.

## Kiểm tra trước triển khai

- Fetch origin; HEAD và origin/main cùng be6e09d trước sửa.
- Broker production v3 khớp source đọc trực tiếp; worker đang order-id-v1,
  sync/id_sync bật đúng bốn HUB. Không xuất token/khách hàng.
- 18/18 test Node đạt: parser, auth/scope, delivery retry/overflow, importer,
  trạng thái và renderer bill. Build đạt 5.319 module, encoding 712 file.
- SQL rollback trong schema riêng kiểm ba topic vào một ID generation=3,
  không sinh HUB scan; thiếu ID vẫn tạo HUB fallback. Không ghi đơn thật.
- CUA lỗi sau restart; reset runtime đã khôi phục console. Chưa coi worker
  đã chạy bản mới cho tới khi manifest/systemd/heartbeat xác nhận.

## File thay đổi

- services/nexpos-events/observer.mjs
- services/nexpos-events/worker-files.sha256
- supabase/functions/nexpos-event-observer/policy.mjs
- supabase/functions/nexpos-event-observer/signals.mjs
- scripts/nexpos-immediate-signals.test.mjs
- supabase/migrations/20261102083005_nexpos_new_order_id_topics.sql
- docs/nexpos-new-order-id-20261102.md

## Triển khai

Đã áp dụng migration20261102083005 và broker v4; tương thích worker v1 cũ
chưa gửi ID từ hai topic mới. Đang cập nhật VPS trước khi nhận hoàn tất.
Không khôi phục lịch giám sát.
