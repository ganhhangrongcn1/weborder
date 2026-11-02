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

Đã áp dụng migration20261102083005 và broker v4. Worker VPS đã cập nhật
đúng commit11e92a269224063f87ffa75e1cb2a3757a8b57be bằng deploy-reviewed.sh:
cả bốn file SHA-256 OK, Node syntax OK, systemd active, khóa vẫn
root:ghr-observer640. Không đọc/xuất khóa. Đã đăng xuất root sau triển khai.

Heartbeat15:32:53 UTC+7 xác nhận order-id-v2, connected=true,
delivery_mode=immediate-v1, đúng bốn HUB. Reconnect đã gửi đối soát bốn HUB;
importer có lượt thành công sau restart, last_success15:33:21, lỗi liên tiếp0.
Polling vẫn30seconds, grants RPC anon/authenticated vẫn false.

Checkpoint chưa có receipt ID thật sau cập nhật; không tuyên bố đã đo được
độ trễ đơn mới, Kitchen hoặc giấy in của v2. Kiểm tra không thấy auto_bill_key
trùng sau mốc cài. Không khôi phục lịch giám sát hay mở lại probe tạm.
Enrollment hiện hết hạn06/11/2026 07:42UTC+7, cần gia hạn trước hạn để WSS
tiếp tục; polling không phụ thuộc enrollment này.
