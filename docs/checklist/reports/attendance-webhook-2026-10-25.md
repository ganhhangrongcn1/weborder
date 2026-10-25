# Webhook rút đồng ý — 25/10/2026

Theo yêu cầu chủ app, đã triển khai Edge Function `attendance-zalo-consent` v1, verify_jwt=false vì tự xác thực chữ ký Zalo. URL: https://qjaklysckgzdfjthzkzu.supabase.co/functions/v1/attendance-zalo-consent

## Trạng thái thực tế

**Kết quả cuối:** API key và URL webhook đã được lưu trên Zalo, secret đã được lưu trên Supabase, kiểm thử HTTP/ghi DB/idempotency thành công. Không thuê VPS. Chưa quan sát sự kiện thật từ nền tảng, chưa có xóa dữ liệu tự động.

- Đã tạo inbox `public.attendance_zalo_consent_requests`, RLS bật, không cấp quyền anon/authenticated. Chỉ lưu tối thiểu ID Zalo, mã sự kiện, timestamp và trạng thái xử lý; không lưu payload thô/chữ ký/khóa.
- Xác thực SHA256 theo tài liệu Open API Zalo, giới hạn đúng Mini App 2442731166050783503 và sự kiện user.revoke.consent, giới hạn body 16KB, ghi bền vững trước trả HTTP200, chống bản ghi trùng theo identity/event/timestamp.
- Đã lấy được API key: nhập URL webhook thực rồi bấm Cập nhật trên parent app3747705232621393197, để trống IP Access. Zalo chấp nhận và tạo key. Không cần thuê VPS để hoàn thành luồng webhook inbound này. Nhận định trước đó rằng phải có IP cố định mới lấy được key là chưa đúng với thao tác thực tế.
- Đã lưu key vào Supabase Edge Function Secret `ZALO_MINIAPP_OPEN_API_KEY` bằng CLI env-file, không in khóa ra hội thoại, không đưa vào frontend/Git. File secret tạm đã xóa sau kiểm tra. Key được ẩn lại trên giao diện Zalo.
- Đã rời trang rồi mở lại Open APIs: URL webhook giữ đúng endpoint, API key vẫn tồn tại, IP Access không có mục, scopes apps.get.stats/apps.send.notification giữ nguyên như trước. Không Reset API Key.
- Cấu hình môi trường kiểm tra được chỉ dẫn tới Supabase, chưa xác định VPS/Gateway IP cố định. Supabase Edge Functions không cung cấp IP egress cố định. Không dùng IP máy cá nhân/DNS của Supabase thay IP server.

## Giới hạn xử lý dữ liệu

Demo chưa có Zalo-to-Auth identity binding. Sự kiện hợp lệ chỉ vào trạng thái `pending_identity_review`; HTTP200 nghĩa là ghi nhận, KHÔNG đồng nghĩa xóa xong. Chưa có worker/notification hoặc công cụ xử lý inbox tự động. Chưa xóa dữ liệu chấm công, hồ sơ nhân sự, Auth, đơn hàng hoặc POS. Trước vận hành chính thức cần có quy trình đối chiếu/xử lý yêu cầu, thời hạn và người phụ trách; trước tích hợp dữ liệu thật cần mapping xác thực và xử lý xóa theo phạm vi.

Đã cập nhật Điều khoản trên Zalo và file nguồn: công khai dữ liệu tối thiểu của inbox, xác thực chữ ký/ghi nhận yêu cầu và giới hạn chưa xóa tự động. Đóng rồi mở lại editor để xác minh cả ba nội dung vẫn được lưu. API frontend vẫn demo, không bật gọi quyền Zalo thật. Trang Review hiện ghi chưa có phiên bản đang đợi xét duyệt; chưa gửi duyệt phát hành.

## Kiểm tra

4 nhóm kiểm thử Node đã đạt: chữ ký hợp lệ và khóa chống trùng; chữ ký sai/app sai/event sai/ID sai; thiếu secret hoặc storage lỗi; timestamp tùy chọn và trường lồng nhau.

Kiểm thử endpoint thực sau cấu hình secret: chữ ký đúng HTTP200; gửi lặp HTTP200 và SQL chỉ có1bản ghi; chữ ký sai HTTP401; payload được ký đúng nhưng sai app HTTP403. Tất cả dùng ID Zalo tổng hợp, không gửi dữ liệu thật. Đã xóa đúng bản ghi tổng hợp sau kiểm tra; không xóa tài khoản hoặc dữ liệu người dùng. Chưa quan sát sự kiện phát sinh trực tiếp từ Zalo/người dùng thật.

## Việc tiếp theo

**Trạng thái mới nhất:** phần API key + webhook trên Supabase đã cấu hình và kiểm thử thành công. Các mục xác minh IP bên dưới là lịch sử điều tra, không còn là blocker. Trước phát hành dữ liệu thật vẫn cần quy trình xử lý inbox và mapping đã xác minh; chưa có xóa tự động. Không gửi tin nhắn hỗ trợ, không thuê VPS, không Publish/Live hoặc gửi duyệt phát hành trong bước cấu hình webhook này.

### Làm rõ yêu cầu IP — kiểm tra bổ sung ngày25/10

Tài liệu Open API nói IP Access bắt buộc để truy cập các Open API; tài liệu webhook nói Zalo gửi sự kiện đến URL HTTPS và xác minh bằng Open API key. Chưa tìm thấy hướng dẫn chính thức cho việc tạo key ở chế độ chỉ nhận webhook, không gọi Open API. Vì vậy chưa đủ căn cứ kết luận phải thuê VPS/IP egress cố định để nhận webhook. Supabase vẫn là nơi nhận webhook phù hợp; câu hỏi còn thiếu là cấp key ở chế độ inbound-only. Đoạn phương án VPS bên dưới là phương án dự phòng, chưa phải yêu cầu đã xác nhận.

Chủ app trả lời “không cần đâu e” với đề nghị gửi hỗ trợ Zalo: dừng nhánh liên hệ, không gửi tin nhắn/OA/email. Không nhập IP giả, IP DNS/CDN của Supabase hoặc mở dải IP toàn Internet để vượt biểu mẫu. Chưa đổi cấu hình trên Zalo. Thao tác thử nút Cập nhật khi biểu mẫu trống đã bị auto-review chặn, chưa có thao tác lưu thành công.

Nội dung đề nghị hỗ trợ:

> Mini App ID2442731166050783503, Zalo App ID3747705232621393197. Chúng tôi chỉ cần nhận sự kiện user.revoke.consent qua webhook HTTPS trên Supabase Edge Functions, chưa gọi Open API thống kê/thông báo. Màn hình Open APIs chưa cấp API Key và hướng dẫn yêu cầu IP Access. Xin hướng dẫn cách cấp API key để xác minh X-ZEvent-Signature khi chỉ nhận webhook, không có IP outbound cố định. IP Access có bắt buộc trong trường hợp này không, có cấu hình webhook-only hoặc khóa xác minh riêng không? Chúng tôi muốn giữ kiểm tra chữ ký và không mở allowlist toàn Internet.

Xác định Gateway/VPS có IP public cố định (nếu phải mua dịch vụ thì cần chủ app chọn chi phí), cấu hình IP Access và URL để lấy API key, lưu secret server `ZALO_MINIAPP_OPEN_API_KEY`, kiểm thử chữ ký và idempotency trên endpoint thực, thiết lập quy trình xử lý inbox rồi mới bật webhook trên hồ sơ Mini App. Điều khoản hiện vẫn mô tả chưa kích hoạt webhook/xóa tự động, đúng trạng thái. Chưa gửi duyệt phát hành bản7 hoặc Publish/Live, không bật API Zalo trong frontend.

Tài liệu: https://docs.zaloplatforms.com/docs/MA/openApis/open/intergration-process ; https://docs.zaloplatforms.com/docs/MA/openApis/open/webhook/verifysignature ; https://supabase.com/kb/troubleshooting/why-supabase-edge-functions-cannot-provide-static-egress-ips-for-whitelisting
