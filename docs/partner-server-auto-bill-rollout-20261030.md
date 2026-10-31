# Server tạo bill đối tác — 30/10/2026

## Mới nhất 31/10/2026: đã bật server tạo bill đúng bốn HUB

Theo yêu cầu trực tiếp của anh, mở rộng cấu hình từng bước lúc 07:29–07:30
UTC+7, sau mỗi bước kiểm tra scope hợp lệ và không còn intent pending/processing:

| HUB | Branch UUID | Mốc bật server (UTC+7) |
| --- | --- | --- |
| Thích Quảng Đức | 99ffd49c-c0e3-4267-a384-35c6298b1abf | 30/10 20:42:12 (giữ mốc cũ) |
| 30/4 | c0d35bd0-e614-4973-9eb2-17e78fb9a245 | 31/10 07:29:51 |
| Lê Hồng Phong | 2ae2433d-081e-4a1c-a65f-8b158f48df56 | 31/10 07:29:58 |
| Việt Sing | b108f000-02dc-4f04-8a97-996bbfc27fb8 | 31/10 07:30:08 |

- Chỉ đơn tạo sau activated_at của từng HUB được tham gia; không enqueue lại
  lịch sử. Bốn scope đúng HUB/branch đang bật, ba HUB tắt không thay đổi.
- Xprinter 80mm/cashier-80mm khớp job production của từng chi nhánh.
- Không đổi code/function/schema, template hoặc APK trong lượt mở rộng này.
  Giữ unique auto_bill_key xuyên suốt printed/failed, In lại thủ công không có
  key tự động, In tem giữ nguyên luồng. Không tạo đơn hoặc in thử thật.
- WSS vẫn bốn HUB; polling NexPOS 15 giây active, lịch rare/full/late, refresh
  Kitchen và quét POS giữ nguyên. Không bật lại automation đã xóa.
- Checkpoint sau bật: enabled_scopes=4, invalid_hubs=0, pending_intents=0.
  Worker kết nối; control không lỗi liên tiếp. Hiện ngoài giờ importer hoạt
  động, nên chưa có lượt sync/bill thật mới để nghiệm thu ba HUB vừa mở.
  Không gọi việc cấu hình thành công là chứng minh đã in giấy cả bốn HUB.

### Bằng chứng canary trước mở rộng

Năm đơn SF-9969, GF-204, SF-8196, GF-010, GF-717 đều có đúng một job tự động
producer=auto-server-partner, intent enqueued ngay lần đầu và POS báo printed.
Commit đơn → tạo job lần lượt 0,448 / 0,722 / 0,447 / 0,531 / 0,642 giây,
trung vị 0,531 giây (timestamp server). Không tồn intent, không job server failed.
GF-010 và GF-717 có thêm job không mang dấu tự động sau khoảng 13–15 phút;
không tính chúng thành duplicate auto. Chưa xác minh người bấm/lý do in lại.
Timestamp thiết bị lệch đồng hồ, không dùng hiệu số âm làm phép đo giấy ra.

### Rollback phạm vi

Có thể tắt enabled theo từng HUB để quay về Kitchen; giữ nguyên các key/job
đã tạo để tránh in lại. Không xóa intent hoặc job và không chạy backfill bill.
Phần canary một HUB bên dưới là lịch sử, đã được thay bằng phạm vi bốn HUB này.

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

Đã bật canary Thích Quảng Đức `69e589d15f07d302954e2f63`, branch
`99ffd49c-c0e3-4267-a384-35c6298b1abf`, activated_at
`2026-10-30T13:42:12.037056Z` (20:42:12 UTC+7). Printer cashier-80mm,
Xprinter 80mm, khớp cấu hình các job production trước đó. Chỉ đơn mới tạo
sau mốc này tham gia; không tạo intent cho lịch sử. Ba HUB khác giữ Kitchen.

Web implementation commit `a82da9c`, Vercel
`dpl_Dqu56JCx9MURwJ74XzgSyASWjJVo` production READY. GET custom domain
/kitchen trả app root; manifest trỏ printerService-CIAGOS9R.js JavaScript 200.
Checkpoint 20:42:53: chưa có intent/đơn mới tại scope sau bật, không lỗi sync;
polling tự nhiên có auto_bill.failed=0. Đây là đã triển khai và bật canary,
chưa phải bằng chứng nhận/in bill thật hoặc tốc độ, chưa mở rộng server bốn HUB.

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
