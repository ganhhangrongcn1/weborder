# Thử nghiệm worker Grab Vietsing trên Supabase

## Phạm vi và trạng thái

- Chỉ nguồn `grab_vietsing`, CN04, Merchant ID `5-C8EKJAE1WCADLA`.
- Function `grab-vietsing-pilot`, xác thực bằng header bí mật, không public dữ liệu.
- Lịch Supabase Cron `grab-vietsing-pilot-hourly` (job 13): `0 * * * *`, mỗi giờ.
- Mỗi lượt lấy đánh giá và tài chính của hai ngày gần nhất, dùng API lưu/upsert hiện có.
- Dùng chung lease với worker máy tính để tránh chạy đồng thời trên cùng nguồn.
- Worker máy tính vẫn là dự phòng. Không bật Bận, không thay đổi nhận đơn, không chạy Marketing.

## Bằng chứng ngày 16/10/2026, giờ Việt Nam

- Gọi trực tiếp trên Supabase thành công: 4 đánh giá, 2 tổng hợp tài chính; 0 giao dịch mới vì đã lưu trước đó.
- Lịch Cron thực sự kích hoạt lúc 09:19; metadata lưu worker ID bắt đầu bằng `supabase:grab-vietsing:`, trạng thái thành công và thời gian xử lý khoảng 2 giây.
- Bản triển khai cuối tiếp tục đồng bộ thành công khoảng 4 giây.
- Gọi function không có khóa trả HTTP 401.
- 6 bài kiểm tra tự động qua: giới hạn đăng nhập, OTP, cookie host-only, phân biệt 401/403, bảo vệ truy cập.
- `npm.cmd run build` thành công; kiểm tra encoding qua 664 file nguồn, không lỗi import/JSX. Các file mới cũng đã kiểm tra UTF-8 nghiêm ngặt.

## Tự đăng nhập lại: chưa chứng minh thành công

- Bài thử dùng cookie trống, giữ nguyên phiên thật đang hoạt động.
- Grab trả HTTP 429 ngay bước lấy thử thách; không gửi tiếp mật khẩu, không thử dồn dập.
- Ghi nhận `supabase_pilot_auth_probe` trong metadata nguồn, không lưu bí mật trong log.
- Thời gian chờ sau lần thử thất bại: 6 giờ. Đã xác minh yêu cầu thử lại bị chặn tại function, không gọi Grab.
- Khi đồng bộ gặp HTTP 401: thử đăng nhập một lần nếu đã hết thời gian chờ; chỉ lưu phiên mới sau khi đọc được đánh giá đúng gian hàng.
- HTTP 403 không kích hoạt đăng nhập lại. OTP/Hydra hoặc thử thách khác yêu cầu hỗ trợ xác thực.
- Vì đăng nhập hiện tại trên máy tính cần Chrome tạo Hydra, chưa thể coi pilot là thay thế hoàn toàn worker máy tính sau khi phiên hết hạn.

## File

Mới:

- `supabase/functions/grab-vietsing-pilot/index.ts`: xác thực, lease, luồng chạy và bằng chứng vận hành.
- `supabase/functions/grab-vietsing-pilot/collectors.ts`: hợp đồng API và chuẩn hóa từ worker hiện tại, giới hạn thời gian/phân trang.
- `supabase/functions/grab-vietsing-pilot/session.ts`: khôi phục/lưu cookie và thử đăng nhập không trình duyệt.
- `supabase/functions/grab-vietsing-pilot/csrf.ts`: lấy CSRF từ phiên đúng URL.
- `scripts/grab-vietsing-pilot.test.mjs`: kiểm tra các nhánh bảo vệ.
- `docs/supabase-sql/20261016_vietsing_supabase_grab_pilot.sql`: lịch chạy và lệnh dừng riêng pilot.
- Tài liệu này.

Cập nhật:

- `supabase/config.toml`: cấu hình function sử dụng xác thực riêng trong handler.

## Dừng thử nghiệm / khôi phục

Chạy lệnh rollback đã chú thích trong file SQL để tắt duy nhất job pilot. Không xóa nguồn, dữ liệu đánh giá, tài chính hay phiên. Worker máy tính vẫn có thể đồng bộ bằng cấu hình hiện có.

## Kiểm tra tiếp

Theo dõi lượt chạy theo giờ và thử lại đăng nhập sau khi Grab hết giới hạn. Thành công với phiên hiện tại không chứng minh đăng nhập từ phiên trống thành công. Không tắt worker dự phòng cho các nguồn khác.

## Điều tra tiếp về đăng nhập tự động

- Đọc lại `scripts/grab-direct-auth.mjs`: `loginGrabDirect` gọi `captureHydraFingerprint`, mở Chrome để nhận `x-hydraweb-jwt` và `x-tracking-id` trước khi gọi API mật khẩu. Vì vậy tên "direct" không có nghĩa là độc lập trình duyệt.
- Kiểm tra mã JavaScript công khai của portal Grab hiện tại: có cơ chế tài khoản đã lưu; chưa tìm thấy endpoint gia hạn phù hợp để khẳng định phục hồi được phiên Merchant này.
- Chỉ kiểm tra tên/thời hạn cookie, không xuất giá trị. Hai cookie `mexusers_authn_token` và `mexusers_authn_token_jti` đang có hạn đến 18/10/2026; cookie tài khoản đã lưu `sa_MEXUSERS_*` có hạn lâu hơn, nhưng không phải bằng chứng nó có thể cấp lại phiên.
- Phép thử HTTP trên máy thực thi: lấy bản sao jar trong RAM, bỏ đúng hai cookie Merchant, giữ cookie tài khoản đã lưu, GET trang đăng nhập Grab chính thức và theo chuyển hướng trong ba hostname Grab cho phép. Kết quả HTTP 200 ở `/merchant/login`, không khôi phục cookie đăng nhập. Không gửi mật khẩu, không gọi lại endpoint đăng nhập đang bị giới hạn, không lưu đè bản sao lên phiên thật. Đây là bằng chứng của phép thử HTTP, không phải phép thử hết hạn thực sự trên cloud.
- Không thử lặp lại đăng nhập mật khẩu trong thời gian chờ 6 giờ. HTTP 429 chưa đủ bằng chứng để phân biệt giới hạn tài khoản, IP hay bước bảo vệ xác thực; không kết luận chắc nguyên nhân chi tiết.
- Tài liệu Supabase về Puppeteer dùng Browserless qua WebSocket: https://supabase.com/docs/guides/functions/examples/screenshots . Đó là trình duyệt bên ngoài Supabase, không đáp ứng điều kiện chỉ dùng Supabase.
- SDK chính thức của Grab có OAuth dành cho ứng dụng tích hợp: https://github.com/grab/grabfood-api-sdk-python/blob/main/docs/GrabOauthRequest.md . Chưa xác minh người dùng có quyền ứng dụng/client credentials, hoặc quyền API đủ cho đánh giá và tài chính. Không tự sử dụng thông tin đăng nhập Merchant làm client credentials.

Kết luận hiện tại: chưa chứng minh được tự đăng nhập lại hoàn toàn trong Supabase hosted. Hướng chạy trình duyệt cloud vẫn cần người dùng chấp nhận thêm dịch vụ; không tạo tài khoản, mua gói hay gửi thông tin Grab cho dịch vụ ngoài trong giai đoạn điều tra này.

Người dùng đã chọn **chỉ dùng Supabase, không thêm dịch vụ**. Vì vậy không triển khai Browserless, VPS hay trình duyệt cloud bên thứ ba. Mục tiêu tự đăng nhập hoàn toàn vẫn chưa đạt; giữ nguyên pilot đồng bộ bằng phiên hiện có. Hướng tích hợp OAuth chính thức chỉ được xem xét khi có client credentials và quyền API phù hợp, chưa có bằng chứng các quyền này sẵn có hoặc bao phủ đủ đánh giá/tài chính.

## Thử Browserless Free theo yêu cầu mới

- Người dùng đã đổi phạm vi: cho phép thử Browserless miễn phí riêng Vietsing, tuyệt đối chưa mua gói trả phí.
- Người dùng đã xác nhận rõ cho Supabase sử dụng tài khoản/mật khẩu Grab Vietsing trong Vault để đăng nhập qua Browserless Free.
- Tài khoản Browserless đã đăng nhập, giao diện hiển thị 0/1.000 units. Không chọn nâng cấp, không nhập thẻ.
- Bổ sung `browserless.ts`: kết nối Chrome tiêu chuẩn, tạo context trống, đăng nhập bằng giao diện Grab, đóng browser sau lượt thử; không dùng proxy, CAPTCHA solver hoặc thủ thuật vượt xác thực.
- Chế độ `browserless_probe` chạy thủ công và kiểm tra cả đánh giá/tài chính bằng phiên mới trước khi lưu. Không tự mở Browserless từ Cron hiện tại.
- Giới hạn browser phía dịch vụ 90 giây và phía function 85 giây; một lượt thất bại không tự lặp lại. Tách thời gian chờ của thử nghiệm Browserless khỏi phép thử không trình duyệt trước đó.
- Chưa có `BROWSERLESS_API_TOKEN` trong môi trường Supabase. Lượt kiểm tra cấu hình trả 503 `BROWSERLESS_NOT_CONFIGURED`, không mở browser hay gửi thông tin Grab ra ngoài.
- API key Browserless được giữ trong bộ nhớ thao tác UI, không ghi mã nguồn hoặc báo cáo. Đang chờ đăng nhập Dashboard Supabase để lưu vào Edge Function Secrets.
- 11 bài kiểm tra tự động qua. Chưa được coi là đăng nhập Grab thật thành công cho đến khi có bằng chứng `browserless_probe` và dữ liệu đã lưu.
- Bản triển khai v4 đã hoạt động; lượt `sync` kiểm tra trả HTTP 200 và lưu thành công 4 đánh giá / 2 tổng hợp tài chính bằng phiên cũ. Build toàn dự án thành công, không lỗi encoding.
- Blocker hiện tại: Dashboard Supabase yêu cầu đăng nhập; giao diện báo không hoàn tất được kiểm tra bảo mật. Đã bàn giao tab cho người dùng. Chưa lưu Browserless API key vào Edge Function Secrets, chưa mở trình duyệt Browserless và chưa gửi thông tin Grab sang Browserless. Không có khoản mua gói trả phí.

File mới của bước này: `supabase/functions/grab-vietsing-pilot/browserless.ts`, `scripts/grab-vietsing-browserless.test.mjs`. Cập nhật `supabase/functions/grab-vietsing-pilot/index.ts` và tài liệu này.

## Kết quả sau khi đăng nhập Dashboard Supabase

- Đã lưu `BROWSERLESS_API_TOKEN` vào Supabase Edge Function Secrets, không lưu giá trị vào mã nguồn, báo cáo hoặc chat.
- Đã sửa kết nối Puppeteer dùng browser entry và WebSocket native của Supabase để tránh phụ thuộc adapter Node.js.
- Lượt `browserless_check` từ Supabase gọi Browserless để mở trang công khai example.com: HTTP 200. Không gửi dữ liệu Grab trong phép kiểm tra này.
- Lượt `browserless_probe` từ Supabase đã mở Chrome cloud, tạo context mới không nạp cookie Grab cũ, mở trang Grab và tới bước mật khẩu. Grab trả HTTP 400, không có cookie đăng nhập mới. Kết quả lưu lúc 09:46:54 ngày 16/10/2026: `ok:false`, `stage:password`, `code:GRAB_BROWSER_LOGIN_INCOMPLETE`.
- Không đủ bằng chứng để kết luận sai mật khẩu hoặc khẳng định đây là lỗi 429. Chưa thu được mã lỗi chi tiết của phản hồi Grab trong lượt này.
- Không lưu đè phiên cũ; nguồn Vietsing vẫn `auth_status:ready`, `sync_status:success`, đồng bộ bật, Bận tắt.
- Nhật ký Browserless: lượt kiểm tra trang công khai tốn 1 unit; lượt Chrome Grab tốn 2 units trong 48 giây. Tổng quan sát được 3 units trong gói miễn phí 1.000 units; không nhập thẻ, mua gói, bật proxy hay CAPTCHA solver.
- Không có Session Replay cho lượt này. Không đăng nhập dồn để cố vượt lỗi; áp dụng thời gian chờ thử lại 6 giờ cho kết quả thất bại ở bước đăng nhập.
- Chưa chứng minh được lấy đánh giá/tài chính bằng phiên Browserless mới vì bước cấp phiên chưa thành công. Cron hiện tại vẫn chỉ dùng phiên đang hoạt động, không tự mở Browserless.

File cập nhật trong lượt này: `supabase/functions/grab-vietsing-pilot/browserless.ts`, `supabase/functions/grab-vietsing-pilot/index.ts`, và báo cáo này. 11 bài kiểm tra tự động đều qua; các kiểm tra này không thay thế bằng chứng đăng nhập Grab thật.

Kiểm tra sau cùng: `npm.cmd run build` thành công. Lượt `sync` từ Supabase sau phép thử vẫn trả HTTP 200, 4 đánh giá, 2 tổng hợp tài chính và 0 giao dịch mới do các giao dịch đã lưu trước đó. Đã xóa API key khỏi các biến thao tác trình duyệt sau khi cấu hình xong.

## Điều tra HTTP 400 và bật phục hồi cloud (kết quả mới nhất)

- HTTP 400 ở `/grabid/v1/authnv4/login` trả challenge `PWD_V2` và có challenge session: đây là yêu cầu nhập mật khẩu, chưa phải từ chối mật khẩu. Không có bằng chứng lỗi 429 trong các lượt Browserless này.
- Bộ chọn cũ có thể chọn nhầm input; bằng chứng form có ô password trống và Continue disabled. Đã giới hạn đúng `input[type=password]` đang bật, click trước khi nhập, chờ Continue thực sự được bật rồi click.
- Lượt thật trên Supabase v15: Browserless context trống, không dùng cookie cũ; đăng nhập mới thành công trong 39.514 giây. Phiên mới lấy/lưu 4 đánh giá và 2 tổng hợp tài chính, remaining=0. Giao dịch mới cần ghi là 0 vì dữ liệu đã có.
- Đã triển khai v16: lịch Vietsing dùng phiên đã lưu; khi API đánh giá hoặc tài chính trả 401 thì gọi Browserless một lần, lấy lại cả hai tập dữ liệu và chỉ lưu phiên sau khi kiểm tra thành công. HTTP 403 không kích hoạt đăng nhập lại.
- Giới hạn lượt đăng nhập phục hồi cách nhau ít nhất 6 giờ. Gặp 429/OTP/CAPTCHA hoặc lỗi đăng nhập thì dừng lượt, không vòng lặp và không dùng proxy/gói trả phí. Lịch chạy bình thường không mở browser.
- Lượt sync thật sau v16: HTTP 200, ok=true, 4 đánh giá / 2 tổng hợp tài chính / 0 giao dịch mới; sử dụng lại phiên Browserless vừa lưu, thời gian 3.361 giây.
- 17 bài kiểm tra qua, gồm luồng sync giả lập phiên hết hạn -> Browserless -> lấy lại cả hai tập dữ liệu -> lưu phiên mới. Chưa quan sát một lần phiên thật tự hết hạn theo thời gian; đăng nhập mới hoàn toàn và sử dụng lại phiên mới đã được chứng minh trên cloud.
- Không mua gói, nhập thẻ hoặc thêm dịch vụ khác. Gói Browserless Free vẫn chịu hạn mức của tài khoản; nếu hết quota hoặc Grab yêu cầu OTP thì đồng bộ cần được xử lý tiếp, không tự nâng cấp.

File mới trong lượt điều tra: `supabase/functions/grab-vietsing-pilot/diagnostics.ts`.
File cập nhật: `supabase/functions/grab-vietsing-pilot/browserless.ts`, `index.ts`, `collectors.ts`, `scripts/grab-vietsing-browserless.test.mjs`, `scripts/grab-vietsing-pilot.test.mjs`, và báo cáo này. Build React thành công và kiểm tra encoding qua; thay đổi sau build chỉ thuộc Edge Function và bài kiểm tra, không thay frontend.
