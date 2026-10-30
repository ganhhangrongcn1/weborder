# Đồng bộ NexPOS theo tín hiệu WSS — 30/10/2026

## Phạm vi

Baseline cloud main `1070e32`, importer production v39. Bản này dùng lại ánh xạ
v39, gồm giá món theo tổng dòng, mã Grab nhiều hơn 3 số và PRE_ORDER ±7 ngày.
Không thay lịch polling 15 giây/rare/full, HUB đang tắt, frontend hay APK.

Worker hiện có gửi báo cáo mỗi 30 giây. Khi bộ đếm theo HUB thay đổi, trigger
ghi một thế hệ công việc bền vững vào `nexpos_event_pending`. Broker đánh thức
importer bằng khóa nội bộ chỉ ở Supabase. VPS vẫn chỉ giữ khóa worker và phiên
NexPOS đã được cho phép, không giữ service-role hay cron secret.

Đây là invalidation theo HUB, không coi nội dung WSS là đơn hoàn chỉnh và không
gán một bộ đếm thông báo cho một mã đơn cụ thể. Không hứa nhanh hơn polling:
báo cáo hiện có thể trễ tới khoảng 30 giây trước bước đánh thức.

## Cách xử lý

- WSS chỉ yêu cầu lấy REST cho HUB được enrollment, bật sync và đang enabled.
- Cùng importer lấy PRE_ORDER/DOING/PICK/FINISH/CANCEL theo giới hạn cũ.
  Đơn PRE_ORDER đã biết nhưng không còn trong danh sách được kiểm tra chi tiết
  theo ID nguồn (tối đa 20 đơn), để bắt hủy/đổi trạng thái ngoài cửa sổ cũ.
  GET chi tiết GF-113F đã xác minh HTTP 200, data là object, PRE_ORDER.
- Khóa toàn cục có UUID chủ sở hữu, hạn 120 giây, gia hạn trước GET và xử lý đơn.
  Polling và WSS cùng dùng khóa; chủ cũ không được gia hạn/nhả khóa chủ mới.
- RPC ghi đơn/món/khuyến mãi trong một giao dịch. Lỗi món rollback cả đơn.
  Không xóa đơn để bù lỗi. Giữ trigger điểm/tem/ánh xạ chi nhánh hiện tại.
- RPC kiểm tra owner, HUB enabled, enrollment, hash đã đọc và thời điểm quan sát.
  Chỉ cập nhật trường thực sự thay đổi; không reset kitchen_work_status hay
  kitchen_item_status khi cập nhật đơn cũ.
- Chỉ xác nhận thế hệ đã đọc sau khi hoàn tất; sự kiện mới đến trong lúc chạy
  vẫn còn pending. Lỗi hoặc giới hạn trang/đơn theo dõi giữ pending để thử lại.
  Polling tiếp tục lấy việc còn tồn nếu lần đánh thức thất bại.
- `nexpos_event_sync_receipts` chỉ giữ ID nội bộ, trạng thái trước/sau, số món,
  thế hệ và thời gian; không giữ khách hàng, token hay payload WSS.

## Kiểm thử

14 test Node: xác thực, lọc HUB, PRE_ORDER, ánh xạ v39, new/cancel/PICK/FINISH,
ghi giao dịch, lỗi ghi không ack và nhả đúng khóa. Các trạng thái thử là dữ liệu
giả trong VM; không đổi đơn kinh doanh.

`scripts/nexpos-event-sync-db.test.sql` chạy trong schema thử riêng, sao chép
cấu trúc bảng không sao chép dữ liệu, áp dụng SQL với schema được thay tên,
và rollback toàn bộ. Đạt: khóa cạnh tranh, owner sai, hết hạn/takeover,
rollback đơn thiếu món, tạo đủ món, CANCEL, chống hash cũ, báo cáo lặp,
thế hệ mới trong lúc xử lý và không cấp RPC cho authenticated.

`npm run build` đạt: encoding 707 file, 5.315 module, Vite 1 phút 31 giây.
Cảnh báo Browserslist và chunk lớn có sẵn. Build không thay nghiệm thu tại quán.

## Triển khai / rollback

- Migration cloud `20261030035833_nexpos_event_sync`, service-only, RLS bật.
- Importer v40, JWT verification bật. Broker v2, machine authentication giữ nguyên.
- Chỉ bật `sync_enabled` cho worker `vncloud-primary`, vẫn một HUB canary.
- Tắt WSS sync: đặt `sync_enabled=false`; giữ worker quan sát và polling.
  Không xóa đơn/điểm/tem. Không rollback phạm vi PRE_ORDER cho 4 HUB.
- Không bật 3 HUB còn lại trước nghiệm thu thật đơn mới, hủy, đổi trạng thái,
  reconnect và đối chiếu đơn/món/tiền/điểm/bếp/in. Metadata đơn thuần không đủ.

Kết quả canary trực tiếp sẽ được ghi sau khi production có sự kiện tự nhiên.

## Kiểm tra trực tiếp lúc 11:03 UTC+7

- Canary sync bật lúc khoảng 10:59:38; worker vẫn kết nối và gửi heartbeat.
- Các lượt polling sau v40 thành công, 0 lỗi liên tiếp; cron 15 giây giữ nguyên.
- Từ lúc bật chưa có thế hệ sự kiện mới: pending rỗng, 0 receipt WSS.
  Hai đơn SF-3525/SF-8260 đang PICK/ready, GF-113F còn PRE_ORDER/new.
  Không quy các trạng thái này cho WSS khi không có receipt chứng minh.
- Chưa mở rộng ba HUB còn lại. Automation tiếp tục chờ sự kiện thật.
- Advisor chỉ báo RLS không có policy cho hai bảng mới: chủ đích service-only,
  không có quyền bảng/RPC cho anon hoặc authenticated.

## Danh sách file đồng bộ lên main

Mới trên main (gồm các file quan sát đã triển khai ở giai đoạn trước):

- `docs/nexpos-event-sync-20261030.md`
- `docs/nexpos-wss-rollout-20261030.md`
- `docs/supabase-sql/nexpos-event-sync.sql`
- `docs/supabase-sql/nexpos-wss-observation.sql`
- `scripts/nexpos-event-observer-auth.test.mjs`
- `scripts/nexpos-event-observer.test.mjs`
- `scripts/nexpos-event-sync-db.test.sql`
- `scripts/nexpos-event-sync.test.mjs`
- `services/nexpos-events/ghr-nexpos-observer.service`
- `services/nexpos-events/observer.mjs`
- `services/nexpos-events/prepare.sh`
- `supabase/functions/nexpos-event-observer/index.ts`
- `supabase/functions/nexpos-event-observer/policy.mjs`
- `supabase/functions/nexpos-order-shadow-sync/eventSync.mjs`
- `supabase/migrations/20261030002921_nexpos_wss_observation.sql`
- `supabase/migrations/20261030035833_nexpos_event_sync.sql`

Cập nhật trên main:

- `scripts/nexpos-preorder-window.test.mjs`
- `supabase/functions/nexpos-order-shadow-sync/index.ts`
