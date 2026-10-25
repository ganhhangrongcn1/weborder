# Bản Testing7 và bước gửi xét duyệt — 25/10/2026

Theo yêu cầu trực tiếp của chủ app, chuẩn bị gửi xét duyệt phiên bản mới, chưa Publish/Live.

- Đã sửa attendance-miniapp/app-config.json: headerTitle rỗng, title Gánh Hàng Rong; giữ thanh điều hướng/Back. Build đạt573393byte. Chưa xác nhận header trống trên thiết bị; nếu runtime fallback title sẽ là thương hiệu thay vì Chấm công nhân viên.
- Chủ app quét xác nhận đăng nhập CLI, CLI báo Login Success. Upload thành công Testing Version7: demo-remove-native-header-title. Root manifest source được khôi phục.
- Trang quản lý xác nhận Version7 Testing. Chủ sở hữu Mini App/eKYC đã xác thực. Bước1 yêu cầu quyền báo không còn quyền cần cấp thêm; chưa coi đó là bằng chứng native đã chạy.
- Đã mở Submit for review cho bản7 và qua bước1 đến Thiết lập chung. CHƯA GỬI XÉT DUYỆT THÀNH CÔNG: nút Tiếp tục bị khóa, cần xác thực email, thiết lập Webhook xử lý rút đồng ý/xóa dữ liệu và Điều khoản sử dụng.
- Chưa nhập email hoặc URL giả, chưa thiết lập webhook/điều khoản, chưa gọi API Zalo thật, chưa Publish/Live. Đã hỏi chủ app email và các URL đang có để hoàn thiện.
- App vẫn DEMO_ONLY, đăng ký mô phỏng, chia sẻ SĐT/GPS/QR mẫu; hồ sơ gửi sau phải mô tả đúng thực tế. Không tự khai các quyền đã thực thi thật.

File sửa: attendance-miniapp/app-config.json. File mới: báo cáo này. Được đưa vào đợt đồng bộ Cloud theo yêu cầu cập nhật tiến độ sau đó.

## Bổ sung11quyền sau yêu cầu chủ app

Đã gửi lý do và một ảnh minh họa cho từng quyền qua form Cấp quyền trên trang xét duyệt Version7. Xác minh UI đủ11dòng đều Đợi xét duyệt: QR, vị trí, mạng, giữ sáng, rung, camera, chọn media, SĐT, lưu video, tải file, mở tài liệu. Đây là yêu cầu cấp quyền đã nộp, KHÔNG phải quyền đã cấp.

Mọi giải trình đều nêu Testing7 là demo, chưa gọi API Zalo thật và đề nghị quyền để tích hợp/kiểm thử; nêu hạn chế camera, rung, gallery, PDF khi liên quan. Ảnh từ bộ giao diện Testing6 cùng UIapp, chỉ headerTitle của7khác. Vị trí và SĐT đã có thêm nội dung xin đồng ý hiển thị người dùng, đúng mục đích chấm công và không bắt buộc SĐT.

Lần đầu màn quyền báo trống, chưa xác định nguyên nhân; không dùng thông báo đó để kết luận quyền đã được cấp. Sau khi mở form QR thấy đủ11quyền cần yêu cầu và đã hoàn tất. Bản thân phiên bản7 vẫn CHƯA gửi xét duyệt phát hành xong do thiết lập chung còn thiếu email xác thực, Webhook xử lý rút đồng ý/xóa dữ liệu, Điều khoản sử dụng. Không Publish/Live. Ảnh chứng minh trạng thái: [11 quyền đợi xét duyệt](assets/attendance-review-2026-10-25/permissions-11-pending.jpg).

## Điểm dừng theo yêu cầu chủ app

Ngày25/10/2026: tạm dừng phát triển, chờ Zalo phản hồi xét duyệt11quyền rồi chủ app sẽ yêu cầu làm tiếp. Không tự tích hợp API thật, sửa DB, triển khai webhook, hoàn tất hồ sơ phát hành hoặc Publish/Live khi chưa có yêu cầu tiếp theo. Không tự lập lịch theo dõi hoặc gửi thông báo.

Khi tiếp tục: đọc trạng thái trực tiếp từng quyền; không suy ra được cấp chỉ vì đã nộp. Xác nhận kết quả trên điện thoại cho header mới. Nếu hoàn thiện hồ sơ phát hành: cần email xác thực, Webhook thực xử lý rút đồng ý/xóa dữ liệu và Điều khoản sử dụng. Đăng ký vẫn chỉ demo, chưa tạo tài khoản thật. Phiên bản7 chưa vào hàng đợi xét duyệt phát hành.
