# Server tạo bill đối tác — 30/10/2026

## Phạm vi

Anh yêu cầu triển khai flow đã thảo luận; tối ưu màn hình Kitchen để sau.
Baseline cloud `b865a7c`, importer v43. Không thay Kitchen UI/hook, POS APK,
WSS bốn HUB, polling NexPOS 15 giây, Kitchen 60 giây hoặc trạm POS 30 giây.
Không bật lại automation kiểm tra đã xóa.

## Luồng mới

Importer commit đơn/món → trigger ghi intent in cùng giao dịch → importer
dựng bill bằng renderer thuần dùng chung với web → commit print_jobs → POS
Realtime/claim/in. Kitchen nhận dữ liệu song song, không bắt buộc tạo bill.

Intent bền vững được thử lại bằng importer/polling hiện có; không thêm một
cron quét chậm hoặc endpoint công khai. Khi tạo đơn mới/đổi PRE_ORDER sang
active, dispatcher chạy ngay trong lượt importer sau khi dữ liệu đã commit,
không phải chờ quét xong cả batch HUB. Lỗi in không rollback đơn đã nhận.

## Giữ hợp đồng và chống trùng

- Chuyển nguyên bộ render thuần từ printerService sang receiptRenderCore;
  browser vẫn nạp template cache như trước, server dùng ghr_receipt_template.
  Bundle server được tạo bằng scripts/build-partner-receipt-server.mjs từ cùng
  source, không có auth/storage/printing side effects. Không viết renderer SQL.
- Adapter partner giữ mã hiển thị, unit price/line total, options/note,
  expected points, branch/source và shape payload hiện POS đang nhận.
  POS vẫn hydrate QR và tem theo đường hiện tại; không cần APK mới.
- partner_auto_bill_scopes giới hạn HUB/branch và activated_at. Mặc định tắt,
  chỉ đơn tạo sau mốc kích hoạt được tham gia; không backfill lịch sử.
- Chỉ DOING/PICK hợp lệ; bỏ hủy/hoàn tất/PRE_ORDER, thiếu món, sai branch,
  snapshot hash đã thay đổi. Intent quá 5 phút không được tự phát bill muộn.
- auto_bill_key unique tồn tại qua printed/failed, tính theo branch/printer/
  customer_bill/partner/order UUID. Trigger bảo vệ cả client Kitchen cũ.
  Kitchen/server cùng tranh một key; server nhận lại job đã có, không tạo lại.
- In lại thủ công không mang automatic key. Giữ unique một active job và
  claim pending của POS. Không hứa exactly-once giấy khi máy in mất ACK.
- Tắt scope giữ các key đã gắn, để client cũ không tạo lại bill đã in. Không
  xóa intent/job; có thể quay lại Kitchen mà không mở đường in trùng.

## Kiểm thử

- 23 test Node đạt: hồi quy v38/v39/v41/ID/WSS, renderer mới khớp renderer
  phát hành b865a7c theo từng byte ở các mẫu synthetic Grab/Shopee/Xanh/web,
  khổ 58/80mm, options/điểm/0đ; render lỗi giữ retry, không báo thành công.
- SQL trong schema riêng, clone cấu trúc không copy đơn/triggers thật,
  rollback toàn bộ: enqueue/claim/commit, duplicate sau printed, manual reprint,
  PRE_ORDER/active/CANCEL, hash cũ, thu hồi scope, rollback giữ dedup, anon cấm.
- Lint bốn file service đạt. Build đạt 5317 module, 15,23 giây; encoding
  710 file đạt; chỉ cảnh báo Browserslist/chunk size có sẵn.
- Migration production 20261030133757_partner_server_auto_bill đã áp dụng;
  importer v44 JWT true, source đủ sáu file khớp. Khi scope còn tắt: các lượt
  polling tự nhiên success, metadata.auto_bill claimed/enqueued/failed đều 0.

## Kích hoạt và theo dõi

Chỉ kích hoạt một HUB sau khi kiểm tra scope/branch/printer. Giữ ba HUB khác
tạo bill qua Kitchen như cũ. Theo dõi intent → job, producer auto-server-partner,
duplicate identity/job, trạng thái thiết bị và đồng hồ server. Không tạo đơn,
hủy, đổi trạng thái hay in thử thật để có mẫu. Không claim đã ra giấy hoặc
đã nhanh hơn khi mới có cấu hình, test hoặc trạng thái printed trên database.

File cập nhật: src/services/printerService.js, src/services/printJobService.js,
supabase/functions/nexpos-order-shadow-sync/index.ts,
scripts/nexpos-event-sync.test.mjs, scripts/nexpos-preorder-window.test.mjs,
docs/partner-print-flow-design-20261030.md.
File mới: src/services/receiptRenderCore.js, src/services/partnerReceiptOrder.js,
supabase/functions/nexpos-order-shadow-sync/autoPrint.mjs,
supabase/functions/nexpos-order-shadow-sync/receiptCore.bundle.mjs,
supabase/functions/nexpos-order-shadow-sync/partnerReceiptOrder.bundle.mjs,
scripts/build-partner-receipt-server.mjs, scripts/partner-auto-bill.test.mjs,
scripts/partner-auto-bill-db.test.sql,
supabase/migrations/20261030133757_partner_server_auto_bill.sql,
docs/supabase-sql/partner-server-auto-bill.sql và tài liệu này.
