# Quan sát ID đơn WSS NexPOS — 30/10/2026

## Quyền và phạm vi

Anh đã cho phép triển khai đầu quan sát tạm có xác thực trên Supabase để kiểm
tra ID đơn WSS; không ghi đơn, không đổi trạng thái, không lộ token/dữ liệu khách
hàng và vô hiệu hóa sau kiểm tra. Chỉ quan sát HUB canary
`69e18c814673b293b04be1ab`.

Probe dùng xác thực server-to-server với khóa cron hiện hữu, không nhận khóa
trong URL. Phiên NexPOS chỉ được đọc và dùng bên trong Edge Function, không trả
ra ngoài. Không ghi business table. Kết quả chỉ chứa tên/kiểu trường, topic,
thời gian và kết quả đối chiếu ID ứng viên với database, không trả raw event
hay giá trị ID chưa được kiểm chứng. Có hạn tuyệt đối 17:00 UTC+7 và thời gian
mỗi lượt 55 giây.

## Kết quả trực tiếp 15:49–15:52 UTC+7

- Hai lượt quan sát hoàn tất HTTP 200, socket mở, lần lượt nhận 4 và 2 thông
  điệp. Cả hai đều không có mẫu sự kiện nghiệp vụ thuộc HUB canary.
- Không đủ dữ liệu kết luận sự kiện có/không có ID đơn. Không coi heartbeat,
  socket mở hoặc không thấy mẫu là bằng chứng ID dùng được.
- Các ID nguồn đang lưu cho đơn hôm nay có độ dài 15, 26 và 27 ký tự. Không
  suy đoán identity theo định dạng MongoDB 24 hex hoặc theo mã hiển thị.
- Kiểm tra không có khóa xác thực trả HTTP 401. Không đổi worker, importer,
  lịch polling, phạm vi sync, trạng thái đơn hoặc gọi in/điểm để tạo sự kiện.

## Vô hiệu hóa

Sau hai lượt, đã thay endpoint bằng handler cố định `probe_disabled`/410 và bật
lại JWT verification. Handler không còn đọc database, lấy phiên hay mở WSS.
Mã nguồn lưu trong repo là bản đã vô hiệu hóa; không giữ endpoint quan sát mở.
Luồng sync production và polling dự phòng vẫn được giữ nguyên.

Muốn xác minh ID cần quan sát lại lúc HUB thực sự có sự kiện mới/đổi trạng thái;
không tạo hoặc thay đổi đơn thật chỉ để thử.
