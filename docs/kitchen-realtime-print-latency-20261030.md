# Kitchen nhận đơn và tạo bill — 30/10/2026

## Phạm vi và baseline

Cloud main/production trước sửa: `9a5230d`, deployment Vercel
`dpl_9Jvd8RcSZwEivB7R87KDgpGda7PK` READY. Anh yêu cầu tối ưu Supabase →
Kitchen → tạo lệnh in, giữ logic và chống in trùng, polling dự phòng.

Luồng hiện có: NexPOS → importer ghi Supabase → Kitchen tải đơn bằng Realtime
hoặc refresh dự phòng → effect tự in tạo print_jobs → POS nhận job và in.
Như vậy POS phải chờ có print_jobs; tám job đối chiếu đều requested_by
auto-kitchen. POS không tự lấy đơn NexPOS hoặc tự sinh bill trong đường này.
Không thể kết luận TFood có cùng bước từ tài liệu bàn giao; tài liệu chỉ xác
nhận listener/REST và Android nhận đơn/in, chưa mô tả đủ nơi tạo print job.

## Bằng chứng trước sửa

- Kitchen có Realtime orders/partner_orders và đăng ký item events; refresh
  dự phòng 60 giây khi tab hiện, đồng bộ lại khi online/hiện tab.
- Handler cũ reset timer mỗi event: 2 giây order, 5 giây item. Event liên tục
  có thể hoãn refresh vô hạn; chưa có telemetry chứng minh riêng nguyên nhân
  này giải thích toàn bộ độ trễ 25–40 giây trên thiết bị.
- Trạm POS có Realtime print_jobs và polling dự phòng 30 giây.
- Tám đơn mới sau bật bốn HUB đều có job được thiết bị báo printed. Thời gian
  đơn vào DB → timestamp tạo job khoảng 5,36–40,26 giây. created_at/requested_at
  của job và printed_at có thể do client cung cấp: sáu mẫu claimed_at sớm hơn
  created_at, nên không coi các hiệu số là đồng hồ server chính xác hoặc in giấy.
- Chưa có bằng chứng giảm độ trễ giấy. Không tạo/in thử đơn thật để kiểm tra.

## Thay đổi

- Tách scheduler nhỏ cho Realtime: order chờ 250ms, item chờ tối đa 750ms;
  luôn giữ hạn sớm nhất. Item đến sau không kéo lùi order, order đến sau có
  thể đẩy sớm batch item. Gộp nhiều nguồn thành một refresh đủ cả hai nguồn.
- Giữ nguyên filter branch/date/important-fields, hàng đợi đọc tuần tự và
  generation chống kết quả cũ; cancel batch khi cleanup/đổi scope.
- Không tạo job trực tiếp từ payload Realtime. Vẫn tải qua kitchenOrderService
  đầy đủ mapping/món/options/repair rồi dùng effect auto-print cũ.
- Không đổi eligibility đơn đặt trước/hủy/POS, dấu đã in theo runtime, in-flight
  guard, kiểm tra job cũ, unique index một active job và claim pending của POS.
- Polling Kitchen 60 giây, POS 30 giây và NexPOS 15 giây giữ nguyên. Không bật
  lại automation đã xóa. Có thể tăng số refresh khi event liên tục; không claim
  giảm request. Mục tiêu là giới hạn thời gian gộp, không bỏ kiểm tra nghiệp vụ.

## Kiểm tra và áp dụng

8 test scheduler/refresh queue đạt: event liên tục không hoãn order, gộp nguồn,
ưu tiên order, cleanup, busy follow-up, đổi scope, unmount và lỗi đọc.
Build đạt: 5316 module, 1 phút 29 giây, encoding 708 file đạt; chỉ cảnh báo
Browserslist và chunk size. Không thay đổi giao diện hoặc cấu hình máy in.
Sau deploy cần tải lại tab Kitchen để dùng code mới; không cần rebuild APK.
Chỉ đo tốc độ vận hành sau khi tab thực sự dùng bản mới; không coi build hoặc
READY thay cho chứng minh bill ra giấy nhanh hơn.

File sửa: src/hooks/useKitchenOrders.js. File mới:
src/services/kitchenRealtimeRefreshScheduler.js,
scripts/kitchen-realtime-refresh-scheduler.test.mjs và tài liệu này.
