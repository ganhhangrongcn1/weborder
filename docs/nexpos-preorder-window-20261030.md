# Phạm vi lấy đơn đặt trước NexPOS - 30/10/2026

## Nguyên nhân và bằng chứng ban đầu

- Main cloud được kiểm tra: `922e0b527168154158eb2c684cb4352bf2cea2a1`.
- Importer production trước sửa: `nexpos-order-shadow-sync` v38, có các xử lý
  mã Grab và đơn giá món khác main. Bản sửa lấy v38 làm chuẩn nghiệp vụ.
- NexPOS trả `GF-113F`, trạng thái `PRE_ORDER`, đúng HUB
  `69e18c814673b293b04be1ab`; `order_time` 30/10 10:06:10 UTC+7,
  `pick_time` 30/10 17:17:38 UTC+7.
- GET cùng HUB và `PRE_ORDER` với khoảng cũ (lùi 6 giờ, tới 1 giờ) trả HTTP 200,
  0 đơn. GET với khoảng lùi/tới 7 ngày trả HTTP 200, 1 đơn, không có trang sau.
- Chưa khẳng định NexPOS lọc chính xác theo trường thời gian nào. Bằng chứng
  xác nhận phạm vi cũ loại đơn này; không suy luận chỉ từ `order_time`.

## Bản sửa

- Thêm config `ghr_nexpos_preorder_window`: enabled, hubIds, lookbackDays,
  lookaheadDays. Giới hạn tối đa 7 ngày mỗi phía; config thiếu/tắt giữ khoảng cũ.
- Chỉ trạng thái `PRE_ORDER` trên HUB được cấu hình dùng khoảng mới.
- Các trạng thái khác, lịch polling, giờ hoạt động, khóa, API nguồn, phân trang,
  mã đơn, chuẩn hóa món/giá/tài chính, điểm/tem, tiến độ bếp và in giữ logic v38.
- Đọc config mới chung truy vấn config tự chỉnh thời gian Grab hiện có;
  không thêm truy vấn config riêng mỗi lượt.
- Số trang tối đa vẫn 5, 20 đơn/trang. Khoảng mới là hữu hạn, không bảo đảm
  bao phủ đơn đặt trước xa hơn 7 ngày hoặc vượt giới hạn trang hiện tại.
- Không thay RLS/schema. File SQL chỉ ghi config, có hướng dẫn tắt để rollback.

## Triển khai và kiểm tra

- Đã triển khai importer v39 với JWT verification giữ bật.
- Ban đầu bật config đúng một HUB; giữ nguyên 4 HUB polling đang bật.
- Chờ polling tự nhiên lấy GF-113F; không tạo đơn, không đổi trạng thái hay in thử.
- Sau khi đối chiếu bản ghi và món trên một HUB đạt, mới mở cấu hình khoảng
  PRE_ORDER cho 4 HUB đang bật. Đây không phải mở rộng đồng bộ WSS.
- WSS vẫn quan sát một HUB; nghiệm thu WSS đơn mới/hủy/đổi trạng thái là việc riêng.

## File thay đổi

- `supabase/functions/nexpos-order-shadow-sync/index.ts` (cập nhật, giữ baseline v38).
- `supabase/functions/nexpos-order-shadow-sync/preorderWindow.mjs` (mới).
- `scripts/nexpos-preorder-window.test.mjs` (mới).
- `docs/supabase-sql/nexpos-preorder-window.sql` (mới).
- `docs/nexpos-preorder-window-20261030.md` (mới).

Kiểm tra: test khoảng PRE_ORDER, HUB chưa bật, các trạng thái khác, rollback,
giới hạn ngày, parse entrypoint TypeScript, mã Grab v38 và đọc config theo lô.
Kết quả canary và mở rộng thực tế ghi bổ sung sau khi xác minh.

## Kết quả production

- Polling tự nhiên lúc 10:15:18 đã lấy đơn; GF-113F được tạo lúc
  10:15:20.937 UTC+7, chi nhánh `304`, `PRE_ORDER`, `order_status=new`,
  `kitchen_work_status=pending`.
- Đối chiếu theo `partner_source + nexpos_order_id`: đúng 1 bản ghi đơn,
  đủ 3/3 dòng món, 3/3 dòng khớp số lượng, đơn giá và thành tiền theo v38.
  Tổng tiền 64.000đ; thực nhận và cơ sở điểm 52.512đ.
- Trigger nghiệp vụ hiện có đã xử lý trạng thái điểm của đơn; kiểm tra ledger
  có đúng 1 `CLAIM_PARTNER_EARN`. Không chạy RPC tích điểm hay tạo giao dịch thử.
- Lượt full tiếp theo 10:15:48–10:15:52 thành công, không tạo thêm đơn;
  kiểm tra lúc 10:16:51 vẫn 1 đơn, 1 bút toán earn.
- Sau canary đạt mới mở config phạm vi PRE_ORDER cho đúng 4 HUB đang bật,
  không bật HUB bị tắt và không đổi lịch polling 15 giây/60 giây/5 phút.
- Việc mở rộng này chỉ áp dụng phạm vi truy vấn PRE_ORDER trong polling.
  Bộ nghe WSS vẫn chỉ quan sát 1 HUB; chưa kích hoạt đồng bộ đơn qua WSS.
- Sau mở rộng, lượt rare 10:17:03–10:17:06 chạy thành công trên 4 HUB,
  12 request danh sách, quan sát 2 bản ghi. Các lượt fast sau đó cũng thành công.
- 9 kiểm tra chuyên biệt đã đạt. Kiểm tra encoding quét 707 file đã đạt;
  trạng thái full build được báo riêng, không dùng thay bằng chứng production.
