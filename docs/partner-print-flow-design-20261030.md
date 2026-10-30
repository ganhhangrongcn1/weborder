# Thiết kế tinh gọn nhận đơn và in bill đối tác — 30/10/2026

## Trạng thái

Đây là phương án thiết kế sau đối chiếu cloud main `581a00b` và hợp đồng in
hiện tại; chưa chuyển production sang server tạo bill. Production vẫn là
Kitchen tạo print_jobs, POS claim/in, có scheduler Realtime mới 250/750ms.
Không thay polling, dữ liệu đơn hoặc phát lệnh in trong lượt phân tích này.

## Luồng đích

NexPOS WSS → worker → hàng đợi sự kiện → importer đọc REST → giao dịch ghi
đơn/món. Sau dữ liệu đủ điều kiện, server tạo duy nhất một bill tự động vào
print_jobs. Từ Supabase tách hai nhánh độc lập:

1. Kitchen nhận Realtime để hiển thị và vận hành bếp.
2. POS nhận Realtime print_jobs, claim, in và ghi kết quả.

Polling nguồn, refresh Kitchen và quét print_jobs của POS vẫn làm dự phòng.
Không nối POS trực tiếp tới NexPOS, không gửi token NexPOS xuống thiết bị.

## Phản biện các cách rút ngắn

- Bỏ REST, dùng raw WSS in: chưa có đủ payload/độ phủ topic; có nguy cơ thiếu
  món/tiền/option, sai HUB. Giữ REST và importer hiện tại là chủ sở hữu dữ liệu.
- Chỉ giảm timer Kitchen: đã sửa nhưng vẫn phụ thuộc tab, mạng và vòng đời
  trình duyệt. Không giải quyết được trường hợp Kitchen tắt hoặc chưa tải đơn.
- Bật server in song song auto-Kitchen ngay: nguy cơ hai bill, vì unique index
  hiện tại chỉ bảo vệ pending/printing; khi printed, writer khác có thể tạo mới.
- Trigger SQL tự dựng text bill: tạo bộ render khác với printerService, có thể
  làm sai QR tích điểm, footer, khổ giấy, lựa chọn món. Không chọn phương án này.
- Cho POS tự fetch đơn và dựng job: cần phát APK và mang eligibility/dedup vào
  thiết bị. Chưa có lợi so với giữ POS hiện tại chỉ nhận print_jobs.
- Hứa exactly-once in giấy: không thể bảo đảm khi máy đã in nhưng mất ACK.
  Trạng thái không rõ cần giữ/cảnh báo để xử lý, không tự in lại mù quáng.

## Điều kiện triển khai đường server

1. Trích xuất mapper/builder bill thành module thuần dùng chung server và web;
   giữ hợp đồng buildCustomerBillPrintPayload/buildPrintJobPayload, option,
   QR/điểm, tiền, sourceType, cửa hàng, khổ giấy và nội dung hiện hành. Cấu hình
   cần lấy theo branch từ cloud; không dựa printerSettings trong localStorage.
2. Tách intent in bền vững khỏi việc in vật lý: commit đơn đánh dấu việc cần
   in trong cùng giao dịch; renderer xử lý sau commit. Nếu render lỗi thì đơn
   vẫn được nhận và intent còn retry, không rollback đơn vì lỗi máy in/template.
   Nếu render có thể hoàn thành trước commit với snapshot đủ dữ liệu, có thể
   atomically ghi print_jobs trực tiếp; không render/HTTP trong trigger SQL.
3. Khóa idempotency tự động cấp database theo branch + printer + loại bill +
   source + identity đơn, tồn tại qua cả printed/failed. Server và auto-Kitchen
   phải gọi chung RPC/claim này trước khi bật server; thủ công In lại có lượt
   yêu cầu riêng, không bị cấm bởi khóa bill tự động.
4. Chỉ đơn đủ món/chi nhánh/eligibility mới phát bill. Giữ quy tắc PRE_ORDER,
   hủy/hoàn tất, thanh toán, thời gian được in, cắt đơn cũ khi mới bật. Không
   in lại lịch sử do deploy/reconnect. Không biến mọi status update thành bill.
5. Feature flag theo branch/HUB và mốc activation. Chuyển quyền tự tạo bill
   sang server cho scope đó; Kitchen hiển thị trạng thái và vẫn In lại thủ công.
   Không để fallback tự tạo độc lập; fallback phải dùng chung khóa bền vững.
6. Giữ POS claim lệnh pending và chống chạy trùng; giữ quét dự phòng. Worker
   phát tín hiệu, POS nhận job và database ghi trạng thái cần xác thực/phân quyền
   hiện có; không đưa service role lên client hoặc VPS chỉ để tối ưu in.

## Nghiệm thu trước mở rộng

- Snapshot bill server/web cùng đơn phải tương đương: món/options/giá/tiền,
  điểm/QR/footer/source/chi nhánh/khổ giấy. Chỉ so sánh không phát in thử thật.
- Test race server/Kitchen, retry, duplicate event sau printed, reconnect,
  thiếu món rồi bổ sung, đặt trước đến giờ, hủy trước dispatch, hết cửa sổ tự
  in và In lại có chủ đích. Không tạo/hủy đơn kinh doanh để thử.
- Bật một scope sau chuyển dedup chung, quan sát đơn tự nhiên khi Kitchen
  không tham gia tạo bill. Không bật cả bốn chỉ dựa unit test.
- Đo bằng timestamp server: commit dữ liệu đủ → intent/job → claim → ACK.
  Timestamp client hiện có sai số, không suy ra thời điểm giấy thực tế từ ACK.
- Rollback scope server phải khôi phục producer Kitchen qua cùng khóa; giữ
  intent đã nhận, không xóa job/ledger hoặc chạy lại bill đã in.

## Kết luận thiết kế

Loại Kitchen khỏi đường bắt buộc tạo bill là cải thiện kiến trúc chính. Không
loại hàng đợi, chuẩn hóa dữ liệu hoặc khóa chống trùng để giảm số ô trên sơ đồ.
Tối ưu timer vừa triển khai là bước nhỏ an toàn; đường server cần hoàn tất các
hợp đồng trên trước khi bật ghi/in thật, chưa được coi là đã triển khai.
