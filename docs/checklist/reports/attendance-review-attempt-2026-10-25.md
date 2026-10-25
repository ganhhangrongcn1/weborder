# Bản Testing7 và bước gửi xét duyệt — 25/10/2026

Theo yêu cầu trực tiếp của chủ app, chuẩn bị gửi xét duyệt phiên bản mới, chưa Publish/Live.

**Kết quả cuối ngày25/10/2026:** đã hoàn tất bước3và4, nộp xét duyệt phát hành Version7 thành công. Giao diện Zalo xác nhận “Phiên bản 7 của bạn đang được xét duyệt”, thời gian submit08:40:03 25/10/2026 do Zalo hiển thị. Chưa được duyệt, chưa Publish/Live. Các mục blocker bên dưới là lịch sử trước khi hoàn thiện email, webhook và Điều khoản.

Ảnh xác nhận: [Version7 đang xét duyệt](assets/attendance-review-2026-10-25/version7-submitted.jpg).

## Mô tả lần xét duyệt đầu

Theo hướng dẫn mới của chủ app, mô tả tính năng ứng dụng thay cho danh sách cập nhật, văn phong ngắn và tự nhiên. Nội dung cuối nhập vào bước3 (237ký tự,304byte UTF8):

> App dành cho nhân viên Gánh Hàng Rong chấm công, xem giờ làm, gửi yêu cầu sửa giờ công và xem tài liệu đào tạo của quán. Đây là bản thử nghiệm, các thao tác dùng quyền Zalo đang được mô phỏng. Tài khoản bên dưới dành cho kiểm duyệt viên.

Đã nhập tài khoản thử riêng vào các trường dành cho kiểm duyệt viên, không ghi mật khẩu vào báo cáo. Không điền campaign vì ứng dụng không phải campaign có ngày kết thúc. Đã gửi và đối chiếu trạng thái bước4: Version7 đang được xét duyệt. Bản mô tả dài trước đó bị backend từ chối dù frontend bật nút; mô tả ngắn cuối cùng được chấp nhận. Không có bước chấp nhận thỏa thuận mới, không bật tự Publish.

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

## Email và Điều khoản sử dụng

Tiến độ webhook mới nhất: xem [báo cáo webhook](attendance-webhook-2026-10-25.md). Đã lấy API key bằng cách lưu URL webhook thực và để trống IP Access trên Zalo; đã lưu secret Supabase và kiểm thử chữ ký đúng200/sai401/sai app403/gửi lặp chỉ1bản ghi. Không thuê VPS. Đã cấu hình URL, chưa hoàn tất xét duyệt phát hành; chưa có luồng xóa tự động theo tài khoản.

Theo yêu cầu chủ app, dùng email do anh cung cấp và soạn Điều khoản. Zalo đã gửi link xác thực email hạn24giờ. Sau đó UI email chuyển sang disabled và không còn nút Xác thực, cần đối chiếu trạng thái khi tiếp tục.

Đã tạo docs/checklist/attendance-miniapp-terms-2026-10-25.md và nhập/lưu nội dung vào Điều khoản sử dụng trên Zalo. Đã đóng rồi mở Chỉnh sửa để xác minh nội dung vẫn có email, mục11quyền và mục7cuối cùng,5891ký tự plain text trong editor. Phần này đã lưu thành công dù modal không tự đóng sau Lưu. Không chấp nhận thay người dùng một thỏa thuận ràng buộc nào; đây là soạn/lưu nội dung điều khoản của chủ app theo yêu cầu.

Nội dung giới hạn thử nghiệm, không cam kết native đã hoạt động, không ghi webhook/xóa tự động đã triển khai. Webhook URL vẫn trống và Tiếp tục vẫn khóa. Chưa gửi duyệt phát hành bản7, chưa Live. Chưa đồng bộ thêm Cloud. Tham khảo hướng dẫn chính thức: https://miniapp.zaloplatforms.com/documents/tutorial/update-information-about-compliance-with-decree/granting-permission-consent
