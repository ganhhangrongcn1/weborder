# Tra cứu trạng thái điểm — 27/10/2026

## Vấn đề và bằng chứng

- Đơn GF-573 trong ảnh có `point_status=claimed`, có bút toán nhận điểm và tổng điểm ròng dương (kiểm tra chỉ đọc, không xuất SĐT).
- `resolveOrderPointStatus` làm mất trạng thái `claimed` từ đơn nếu lịch sử điểm dùng làm fallback không có bút toán tương ứng. TrackingView sau đó hiển thị lời nhắc quét QR cho đơn đối tác.

## Thay đổi

- Giữ trạng thái đã tích từ dữ liệu đơn trong fallback.
- Dùng cùng một bộ nhãn cho tra cứu khách vãng lai và lịch sử tài khoản: Đã tích điểm; Chờ thanh toán để tích điểm; Chờ đối soát để tích điểm; Đã hết hạn tích điểm; Không tích điểm; Chưa có SĐT nhận điểm; SĐT chưa hợp lệ để tích điểm; Đang cập nhật điểm.
- Đơn có SĐT, đủ dữ liệu nhưng chưa có xác nhận cộng thành công không bị ghi nhầm là đã cộng. Nhãn này không phải nút yêu cầu khách thao tác.
- Hạn hiển thị 24 giờ từ thời điểm mua; đơn đã tích không bị đổi sang hết hạn chỉ vì thời gian trôi qua.
- Không thêm nút nhận từ lịch sử, không thay đổi tự tích, QR, tem, SQL/RLS/RPC, dữ liệu hoặc APK. Khách đã có SĐT và được tự tích không cần bill để nhận lại.

## Kiểm tra

- `node scripts/order-point-display.test.mjs`: trạng thái claimed khi fallback thiếu lịch sử, hủy, thanh toán, đối soát, mốc 24h, thiếu/sai SĐT và đơn đủ điều kiện nhưng chưa có xác nhận cộng.
- Build, UTF-8, lint phạm vi thay đổi và kiểm tra diff trước khi phát hành.
- Không nhận điểm/tem thật, tạo đơn thật hoặc in bill để kiểm thử.
