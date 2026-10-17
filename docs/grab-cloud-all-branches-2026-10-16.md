# Đồng bộ Grab trên cloud cho toàn bộ gian hàng

Phạm vi được người dùng cho phép: chuyển các gian hàng còn lại giống Vietsing; sử dụng tài khoản/mật khẩu trong Vault qua Browserless Free để kiểm tra đăng nhập mới, đánh giá và tài chính. Không mua gói hoặc thêm dịch vụ trả phí.

## Thiết kế

- Giữ endpoint `grab-vietsing-pilot` để tương thích lịch Vietsing hiện tại. Thêm `account_key` với allowlist cố định gồm 5 cặp source UUID / Merchant ID; không chấp nhận tài khoản ngoài danh sách.
- Nguồn Đường 30/4 có hai gian hàng Grab riêng; Lê Hồng Phong, Thích Quảng Đức và Vietsing mỗi nơi một gian hàng.
- Mỗi lượt chỉ xử lý một gian hàng, dùng lease hiện hữu của domain API để ngăn hai worker ghi đồng thời. Không thay đổi worker cục bộ, Marketing hay điều khiển Bận.
- Lượt sync dùng cookie đang lưu. Chỉ `GRAB_SESSION_EXPIRED` (HTTP 401 từ đánh giá hoặc tài chính) mới được phép mở Browserless để đăng nhập mới một lần. HTTP 403, lỗi mạng và lỗi nghiệp vụ không kích hoạt đăng nhập lại.
- Đăng nhập phục hồi cách nhau ít nhất 6 giờ; ngừng lượt khi gặp OTP/CAPTCHA/429. Chỉ dùng Chrome tiêu chuẩn, đóng trình duyệt sau lượt chạy, không proxy hoặc CAPTCHA solver.
- Phép thử `browserless_probe` có chủ đích tạo context trống để chứng minh đăng nhập mới; đây là ngoại lệ kiểm thử thủ công, không phải hành vi của lịch sync khi phiên còn hạn.
- Cookie mới chỉ được lưu sau khi kiểm tra đọc đúng gian hàng và đồng bộ dữ liệu. Đăng nhập thất bại giữ phiên đã lưu trước đó.
- Mỗi lượt đọc đánh giá 48 giờ gần nhất, tổng hợp và danh sách/chi tiết tài chính hôm nay và hôm qua theo giờ Việt Nam. Dữ liệu lịch sử đã lưu được giữ nguyên. Chi tiết giao dịch đã có và không đổi được bỏ qua theo kế hoạch của domain API; số giao dịch mới bằng 0 không có nghĩa là không đọc được tài chính.

## Xử lý lỗi phát hiện khi mở rộng

Các màn hình Grab có thể thay input mật khẩu trong lúc khởi tạo challenge, làm ElementHandle bị tách khỏi DOM. Đã chuyển thao tác điền mật khẩu sang Puppeteer Locator để chờ input ổn định và chọn lại phần tử mới. Chỉ cho phép thử lại sớm một lần với kết quả cũ ghi rõ `Node is detached from document`, chưa gửi mật khẩu và chỉ nhận challenge `PWD_V2`; không bỏ qua 429 hoặc lần xác thực mật khẩu đã gửi.

## Lịch dự kiến

| Gian hàng | Phút mỗi giờ |
|---|---:|
| Vietsing | 00 (giữ lịch hiện có) |
| Đường 30/4 - gian hàng 1 | 05 |
| Đường 30/4 - gian hàng 2 | 10 |
| Lê Hồng Phong | 15 |
| Thích Quảng Đức | 20 |

Secret xác thực lịch vẫn lấy từ Vault lúc chạy, không ghi giá trị vào SQL, mã nguồn hoặc báo cáo.

## Kiểm tra

- 27 bài kiểm tra qua, gồm cả 5 gian hàng ở trạng thái phiên còn hạn (không gọi Browserless) và hết hạn (gọi đúng một lần, lưu đúng source/merchant).
- Build React và kiểm tra encoding thành công. Không sửa frontend.
- Kết quả vận hành và lịch thực tế được ghi tiếp sau khi hoàn tất kiểm chứng từng gian hàng.

## File

Mới: `supabase/functions/grab-vietsing-pilot/accounts.ts`, `docs/supabase-sql/20261016_grab_cloud_all_branches.sql`, báo cáo này.

Cập nhật: `supabase/functions/grab-vietsing-pilot/index.ts`, `browserless.ts`, `diagnostics.ts`, `scripts/grab-vietsing-pilot.test.mjs`, `scripts/grab-vietsing-browserless.test.mjs`.

Rollback: tắt đúng bốn cron mới theo SQL đã lưu. Không xóa dữ liệu hoặc secret; lịch Vietsing và worker cục bộ được giữ nguyên.

## Kết quả triển khai thực tế

Đã triển khai Edge Function v19 và áp dụng bốn lịch mới; Vietsing giữ job 13. Các job 14–17 đều active, lần lượt phút 05/10/15/20 mỗi giờ. Không thay đổi secret hoặc dữ liệu của chi nhánh ngoài phạm vi.

| Gian hàng | Đăng nhập mới cloud | Đánh giá đọc/lưu | Tổng hợp tài chính | Giao dịch mới cần ghi | Chi tiết còn thiếu |
|---|---|---:|---:|---:|---:|
| Đường 30/4 - gian hàng 1 | Thành công, 38.560 giây | 4 | 2 | 0 | 0 |
| Đường 30/4 - gian hàng 2 | Thành công, 38.549 giây | 1 | 2 | 0 | 0 |
| Lê Hồng Phong | Thành công, 38.227 giây | 6 | 2 | 0 | 0 |
| Thích Quảng Đức | Thành công, 38.486 giây | 8 | 2 | 0 | 0 |

Mỗi lượt tạo browser context trống, không nạp cookie Grab cũ. Kết quả `auth.stage=browserless_fresh_session`, `ok=true`, `remaining=0`; phiên mới được lưu qua domain API. Giao dịch không cần ghi mới vì đã có trong dữ liệu lịch sử, không phải lỗi truy cập tài chính.

Tồn kho dữ liệu trước bước cuối: gian hàng 30/4 thứ nhất 191 đánh giá / 1.946 giao dịch; 30/4 thứ hai 97 / 984; Lê Hồng Phong 272 / 3.524; Thích Quảng Đức 270 / 3.459. Mỗi gian hàng có 97 ngày tổng hợp tài chính. Vietsing giữ 20 đánh giá / 217 giao dịch / 16 ngày tổng hợp. Đây là số bản ghi đã lưu, không phải khẳng định đã đối soát toàn bộ lịch sử ngoài cửa sổ đồng bộ hai ngày.

Giới hạn bằng chứng: đã chứng minh đăng nhập mới hoàn toàn và đọc/lưu dữ liệu trên cloud; việc phiên thật tự hết hạn theo thời gian chưa được quan sát. Nhánh phục hồi khi 401 và bỏ qua Browserless khi phiên còn hạn đều có kiểm thử cho cả năm account. Nếu Grab yêu cầu OTP/CAPTCHA hoặc Browserless hết quota, lượt bị dừng; không tự mua/nâng gói.

Kiểm tra cuối từ chính Supabase qua pg_net với secret trong Vault: request 1863–1867 cho cả 5 account đều HTTP 200, `ok=true`, `auth.stage=stored_session`, `remaining=0`, không timeout; mỗi lượt khoảng 1,8–2,0 giây. Đây là phép gọi thủ công từ database cùng URL/body/xác thực như lịch cron, xác nhận không cần máy người dùng và không mở Browserless khi phiên còn hạn. Các lượt kích hoạt cron theo giờ kế tiếp chưa được chờ quan sát trong phiên làm việc này.
