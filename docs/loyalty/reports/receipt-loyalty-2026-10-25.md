# QR bill và tích điểm khi đã thanh toán — 25/10/2026

## Phạm vi được duyệt

- Đơn đã thanh toán có SĐT hợp lệ tự nhận điểm; chưa có số nhận qua QR riêng, không OTP.
- Chung khóa sự kiện loyalty V2 cho tự động, QR, quầy và lần gọi lại.
- Trang `/nhan-diem/:token` độc lập, không thanh điều hướng/footer; đăng nhập về `/profile`.
- Banner thưởng đánh giá dẫn tới chương trình hiện có. Không thay quy tắc thưởng ảnh.
- Không cộng hàng loạt đơn cũ, không sửa tổng tiền, không trộn tích tem với điểm.

## Khảo sát

- Nhánh gốc `codex/cloud-source-20261023`, commit `d28901b`; đã fetch GitHub. Nhánh này có công việc riêng ngoài main; không merge/push main để tránh đưa các phần đó lên production.
- Nhánh triển khai `codex/receipt-loyalty-20261025`.
- QR cũ là `/orders?phone=...`; khách nhận điểm đối tác qua tài khoản đúng số.
- Supabase hiện khóa sự kiện theo nguồn + id đơn + action + version và idempotency key.
- Đơn đối tác chỉ tính điểm trên tiền thực nhận; thiếu đối soát phải giữ chờ, không dùng tổng bill thay thế.
- Anh xác nhận bổ sung: đơn đối tác đã thanh toán khi vào hệ thống. Tự xét ngay khi ingest, không chờ in hay hoàn thành. Thiếu đối soát vẫn giữ chờ đúng căn cứ tiền hiện hành.

## Tiến độ

1. Đã khảo sát mã nguồn và schema/hàm production bằng truy vấn đọc. Chưa thay đổi production ở thời điểm tạo ghi chép này.
2. Đã xây cơ chế token, điều kiện thanh toán, trang riêng và đường in tương thích.
3. Build/encoding web đã đạt. Kiểm tra SQL trong một transaction rồi ROLLBACK đạt 7 tình huống: chưa trả, trả trước hoàn tất, chống nhận lại/in lại/hoàn tất, hủy thu hồi, đối tác tự cộng khi chuẩn bị, đối tác thiếu số/chờ đối soát rồi nhận QR, giữ trạng thái đã nhận sau hết hạn.
4. Đang bổ sung kiểm tra quyền khách vãng lai, đường in và UI; chưa kích hoạt production.

## Kiểm tra bắt buộc trước kích hoạt

- Sai token; bill chưa trả; bill hủy/hoàn tiền; hết hạn; thiếu đối soát.
- Nhận lần hai bằng số khác, tự động rồi QR, quầy rồi QR, hoàn tất sau thanh toán, in lại.
- Không lộ SĐT đầy đủ, địa chỉ, lịch sử hoặc token qua thống kê truy cập.
- Có ghi nhận lỗi để vận hành xử lý; lỗi loyalty không được làm hỏng luồng bán hàng.
- Build/encoding/lint và kiểm tra UI local. Tách rõ kiểm tra phần mềm, deploy và giấy in thực tế.

## Triển khai

Chưa kích hoạt. Mọi checkpoint phải ghi commit, kiểm tra và trạng thái deploy ở đây.
