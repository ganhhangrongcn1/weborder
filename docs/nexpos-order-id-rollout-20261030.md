# Tăng tốc WSS theo ID đơn — 30/10/2026

## Cập nhật 19:08 UTC+7: v43 và chuyển HUB thử nghiệm

Anh yêu cầu tối ưu và thử HUB khác vì 30/4 ít đơn. Cloud main đã fetch và
khớp local `324cb9e`; source production v42 khớp đủ ba file trước sửa.

- V43 cho hai cặp truy vấn đọc độc lập chạy song song: HUB/enrollment và
  order/shadow snapshot. Snapshot đọc lỗi sẽ dừng an toàn thay vì coi như thiếu
  đơn. Không song song các ghi, không thay khóa hoặc ánh xạ nghiệp vụ.
- Thêm `metadata.timings_ms`: setup, source_fetch, snapshot_read,
  processing_and_ack. Đây là thời lượng trong importer, không phải Kitchen.
- 20 test Node đạt; source v43 production khớp ba file đã kiểm tra, JWT bật.
- Ba giờ trước chuyển: Thích Quảng Đức 17 đơn, Việt Sing 12, Lê Hồng Phong 12,
  30/4 6. Chuyển enrollment `vncloud-primary` từ 30/4 sang duy nhất
  `69e589d15f07d302954e2f63` (277 Thích Quảng Đức), sau khi queue cũ hết.
  Worker bootstrap lại 19:08:10, gửi tín hiệu reconnect 19:08:11.
- Polling 15 giây/rare/full/late và PRE_ORDER ±7 ngày giữ nguyên bốn HUB.
  Ba HUB tắt không thay đổi. Không tạo đơn/đổi trạng thái để thử.
- Hai receipt ID trước chuyển thuộc SF-6443 ở HUB 30/4: DOING→PICK 3,286622s,
  PICK→FINISH 2,768046s worker→commit, mỗi lượt GET một đơn, không lỗi ID.
  Đây không phải mẫu của HUB mới hoặc phép đo đến Kitchen; có sai số đồng hồ.
- Chưa kết luận mức tăng tốc sau v43; cần receipt thật và timings mới.
  Automation đã cập nhật HUB và phiên bản, vẫn chỉ một HUB thử nghiệm.
- Lượt reconnect HUB mới 19:08:12 thành công, không tạo đơn: setup 645ms,
  fetch nguồn 6369ms (8 request), đọc snapshot 277ms, xử lý/ack 9183ms.
  Đây là đối soát reconnect, không phải độ trễ nhận đơn mới. Hàng đợi sau đó
  trống, control 0 lỗi; polling 15 giây còn active. Encoding 707 file đạt.
- 19:09:56 nhận WSS của GF-646 đúng HUB mới, PICK→FINISH; commit lúc
  19:10:00, khoảng 4,010378s từ worker (khác đồng hồ) đến commit. Một request
  chi tiết, id_only=true, 0 lỗi ID; DB có một identity và 3 dòng món. Setup
  1166ms, source_fetch 1218ms, snapshot_read 285ms, processing/ack 1207ms.
  Chưa phải đơn mới, chưa kiểm tra màn hình Kitchen hoặc đủ mẫu để so tốc độ.

File sửa trong lượt này: `supabase/functions/nexpos-order-shadow-sync/index.ts`
và tài liệu này. Không sửa worker VPS hay frontend.

## Baseline và phạm vi

Main cloud trước sửa: `6db10af`. Importer production trước sửa v41, broker v2.
Giữ ánh xạ v38/v39, PRE_ORDER ±7 ngày, RPC ghi giao dịch và lịch polling cũ.
Chỉ canary HUB `69e18c814673b293b04be1ab`; không bật ba HUB đang tắt.

Đã xác minh live `saas_order_status_change.data.order_ids` khớp ID nguồn đúng
HUB và API chi tiết. Chỉ topic này được dùng để lấy riêng từng đơn. Topic khác,
thiếu ID, vượt giới hạn hoặc reconnect vẫn yêu cầu đối soát HUB.

## Đường mới

- Worker gửi sự kiện đầu tiên ngay; khi đang gửi thì giữ tín hiệu mới, gộp
  250 ms trước lượt kế tiếp. Lỗi có backoff tối đa 10 giây, không xóa tín hiệu
  trước cloud ack. Giới hạn payload theo byte; quá nhiều ID chuyển đối soát HUB.
- Heartbeat 30 giây giữ riêng. Báo cáo `immediate-v1` không gây quét HUB trùng
  với đường gửi ngay. Worker cũ vẫn được hỗ trợ và dùng báo cáo như trước.
- Broker giữ xác thực machine-key, kiểm tra enrollment/HUB/feature flag, ghi
  hàng đợi transaction rồi mới ack và đánh thức importer. Không đưa cron secret
  hay service-role tới VPS. Cùng khóa worker hiện có, không tạo khóa mới.
- Hàng đợi theo `(hub_id,order_id)` có generation, pending và retry_at. Chỉ
  xác nhận đúng generation đã xử lý; sự kiện đến trong lúc bận không bị xóa.
- Lượt WSS chỉ có ID hợp lệ sẽ gọi GET đúng đơn, không quét năm trạng thái.
  Giữ nguyên importer cho món, tiền, điểm/tem, bếp và in. Lỗi ID không chặn
  polling các HUB khác, giữ pending, lùi retry và đối soát HUB.
- `nexpos_commit_id_order` kiểm tra scope và gọi RPC giao dịch hiện có; ghi
  receipt riêng, không đụng ledger hay reset tiến độ bếp. Khóa worker trước
  pending để thống nhất thứ tự với enqueue và tránh deadlock.
- Khóa xử lý vẫn dùng chung với polling; chưa tách khóa theo HUB trong lượt này.
  Va chạm với polling có thể làm chậm một lượt, không cam kết mọi đơn dưới 1 giây.

## Triển khai và kiểm thử

- Migration cloud `20261030111713_nexpos_order_id_events`.
- Importer v42, JWT verification bật; broker v3, own machine authentication.
- Cờ `id_sync_enabled` mặc định tắt, chỉ bật canary sau khi worker mới chạy tốt.
- 20 test Node đạt: parser ID opaque, xác thực/phạm vi, gửi ngay, gộp khi bận,
  retry, overflow, GET đúng một đơn, mapping món/giá, trạng thái và PRE_ORDER.
- SQL thử trong schema riêng, sao chép cấu trúc không có đơn thật, rollback
  toàn bộ: enqueue ID, cooldown, HUB tắt, giao dịch/receipt, thế hệ mới khi bận,
  thu hồi feature scope và cấm RPC cho anon. Đã đạt.
- Script deploy VPS tải nguồn pin theo commit, kiểm SHA-256, kiểm cú pháp,
  sao lưu source cũ và phục hồi nếu restart thất bại. Không đọc/in khóa worker.

## Rollback

Đặt `id_sync_enabled=false` cho worker, giữ `sync_enabled=true`. Worker quay về
báo cáo metadata khi bootstrap lại; polling giữ nguyên. ID còn pending không
được xử lý khi cờ tắt. Không xóa dữ liệu đơn/điểm. Probe quan sát tạm vẫn tắt.

Chưa nghiệm thu in giấy/Kitchen trên thiết bị thật trong lượt này. Chỉ mở rộng
ba HUB bật còn lại sau bằng chứng vận hành canary; không dùng socket mở hoặc
unit test thay cho nghiệm thu thật.

## File trong phạm vi

- `services/nexpos-events/observer.mjs` — cập nhật.
- `services/nexpos-events/prepare.sh` — cập nhật để chuẩn bị đủ module phụ thuộc.
- `services/nexpos-events/signalDelivery.mjs` — mới.
- `services/nexpos-events/deploy-reviewed.sh` — mới.
- `services/nexpos-events/worker-files.sha256` — mới.
- `supabase/functions/nexpos-event-observer/index.ts` — cập nhật.
- `supabase/functions/nexpos-event-observer/policy.mjs` — cập nhật.
- `supabase/functions/nexpos-event-observer/signals.mjs` — mới.
- `supabase/functions/nexpos-order-shadow-sync/index.ts` — cập nhật.
- `supabase/functions/nexpos-order-shadow-sync/eventSync.mjs` — cập nhật.
- `supabase/migrations/20261030111713_nexpos_order_id_events.sql` — mới.
- `docs/supabase-sql/nexpos-order-id-events.sql` — mới.
- `scripts/nexpos-event-observer-auth.test.mjs` — cập nhật.
- `scripts/nexpos-event-sync.test.mjs` — cập nhật.
- `scripts/nexpos-immediate-signals.test.mjs` — mới.
- `scripts/nexpos-order-id-events-db.test.sql` — mới.
- `docs/nexpos-order-id-rollout-20261030.md` — mới.

Kết quả cài VPS, bật cờ và quan sát thật sẽ bổ sung sau kiểm tra trực tiếp.

## Kết quả production lúc 18:24 UTC+7

- VPS đã tải đúng commit `f4fb9e68f0e65560c86d81093e5df5e348a99f51`, cả bốn
  file worker khớp manifest SHA-256, Node syntax check đạt, systemd active.
- Khóa worker vẫn root:ghr-observer 640; không tạo/chuyển khóa mới. Đã đăng
  nhập bằng phiên root được anh cho phép, không ghi mật khẩu vào source/log.
  Đã đăng xuất root sau triển khai.
- Cloud nhận worker_version=order-id-v1, connected=true; sau bật cờ một HUB,
  cloud nhận delivery_mode=immediate-v1. Bootstrap/reconnect và heartbeat đạt.
- Polling 15 giây vẫn active; các lượt sau importer v42 thành công, 0 lỗi liên
  tiếp. Feature scope chỉ đúng canary; ba HUB polling khác giữ nguyên.
- Tại checkpoint chưa có receipt ID thật sau bật, không tồn pending ID.
  Đây là triển khai đã chạy và kiểm tra kết nối, chưa phải bằng chứng độ trễ
  đơn thật/Kitchen hoặc đủ điều kiện mở rộng 4 HUB.
- Build web đã đạt, 5.315 module, Vite 3 phút 25 giây; encoding 707 file đạt.
  Không sửa frontend. Cảnh báo Browserslist và chunk size có sẵn.
- Security advisor chỉ báo RLS-no-policy cho hai bảng service-only mới như
  thiết kế. Anon/authenticated không được đọc queue hay gọi RPC enqueue.
- Lịch theo dõi đã cập nhật để đọc receipt ID, metadata.id_only và lỗi theo ID.
  Giữ một HUB, không dùng socket mở để tự động mở rộng.
