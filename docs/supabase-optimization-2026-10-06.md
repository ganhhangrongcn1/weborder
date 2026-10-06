# Tối ưu Supabase an toàn — 06/10/2026

## Kết quả cập nhật sau đợt kiểm chứng tiếp theo

| Hạng mục | Đã tối ưu | Trạng thái |
|---|---|---|
| KPI Dashboard | Tạm dừng khi ẩn/mất mạng; gộp sự kiện quay lại; chống gọi chồng | Đã kiểm tra và triển khai website production |
| Món phổ biến | Cache/in-flight theo từng bộ lọc, giới hạn 64 mục, cooldown lỗi và chống phản hồi cũ | Đã kiểm tra và triển khai website production |
| Báo cáo kinh doanh | Nối UUID đúng kiểu để dùng chỉ mục món đối tác | Đã áp dụng trên Supabase và ghi migration |
| Quyền truy cập | Đã xác nhận rủi ro và đường gọi cần giữ | Chưa thay đổi; xem kế hoạch ma trận vai trò riêng |

Frontend commit `4d188537532157bb12ae9b69f5a6a08acafb87c2` chỉ chứa 5 file nguồn/test liệt kê bên dưới; đã push main và HEAD khớp origin/main. Bản thử `dpl_F1sQH5pUfao6nFJF78s2QECV4WaP` đã được kiểm tra sau khi người dùng đăng nhập Vercel. Vercel production `dpl_EN9ZtH7pJdwtVkhFmtFQcZbL5w4x` READY, build 30 giây, hoàn tất khoảng 14:43 ngày 06/10/2026 (GMT+7), đúng commit và source main. Domains gồm ganhhangrong.vn và www.ganhhangrong.vn. Bản production trước `dpl_7efaBrorYCwzPt1avNqmCq8xFBg5` / commit `c132988` vẫn là điểm khôi phục.

Bước đăng nhập đã được người dùng hoàn thành. Không tạo bypass, không tắt bảo vệ. Đã kiểm tra trang chủ/menu trên bản thử; quản trị hiển thị form Supabase Auth đúng cách. Sau đó phát hành từ main để dùng cấu hình production, không promote trực tiếp cấu hình preview.

## Phạm vi đã sửa tại máy

- Dashboard: chỉ cập nhật định kỳ khi trang hiện và có mạng; gộp các sự kiện quay lại trang, tránh yêu cầu chồng nhau. Giữ khoảng cập nhật 60 giây, thử lại sau lỗi 30 giây; dọn bộ hẹn giờ và sự kiện khi rời trang.
- Món phổ biến: bộ nhớ đệm và yêu cầu đang chạy tách theo số ngày/số món. Kết quả thành công giữ 15 phút; thiếu RPC giữ 5 phút; lỗi khác thử lại sau 30 giây. Giới hạn 64 mục và ngăn kết quả cũ quay lại sau khi xóa cache.
- Không thay đổi đơn hàng, thanh toán, Kitchen, in bill, đồng bộ NexPOS, RLS hoặc dữ liệu nghiệp vụ.
- Frontend đã push main và triển khai production. SQL báo cáo đã áp dụng đúng một dòng sau các kiểm chứng bổ sung.

## Các file

Đã cập nhật:
- `src/pages/admin/state/useAdminOrderCrmState.js`
- `src/services/popularProductService.js`

Đã tạo:
- `src/services/foregroundRefreshService.js`
- `src/services/keyedReadCache.js`
- `scripts/supabase-read-load.test.mjs`
- `docs/supabase-sql/2026-10-06-analytics-uuid-join-candidate.sql`
- `docs/supabase-optimization-ai-review-2026-10-06.jpg`
- Báo cáo này.
- `docs/supabase-browser-verification-2026-10-06.jpg`
- `docs/supabase-security-rollout-2026-10-06.md`
- `docs/supabase-sql/2026-10-06-analytics-uuid-join-validation.sql`
- `docs/supabase-sql/2026-10-06-analytics-uuid-join-applied.sql`
- `docs/supabase-sql/2026-10-06-analytics-uuid-join-rollback.sql`
- `supabase/migrations/20261006073603_optimize_analytics_partner_uuid_join.sql`
- `docs/supabase-production-release-2026-10-06.jpg`

Các đường dẫn trên tính từ thư mục `D:\Ganh Hang Rong\Webapp\GHR VER 5`. Bản thử trình duyệt và bản sao trước sửa nằm trong `.local-backups/supabase-optimization-20261006/`, không được đưa vào commit frontend. SQL ứng viên cũ được cập nhật chú thích lịch sử; dùng migration đã ghi nhận, không chạy ứng viên cũ.

## Kiểm tra

- 5 nhóm kiểm tra tự động đạt: trang ẩn/mất mạng, quay lại dồn dập, yêu cầu đang chạy, dọn khi rời trang, lỗi/thử lại, nhiều khóa cache, thời hạn cache, xóa cache khi phản hồi chưa về.
- Kiểm tra trên trình duyệt bằng hook/service thực, RPC giả lập: KPI ready với 12 đơn/345.000 đồng; quay lại 10 lần trong thời gian còn mới vẫn chỉ 1 yêu cầu summary. Ba component món phổ biến với hai bộ lọc chỉ tạo 2 yêu cầu, hiển thị đúng từng bộ lọc. Sau khi ẩn mô phỏng quá 60 giây, summary giữ 1 lần gọi; khi hiện lại tăng đúng 1 lần. Không gọi database, không tạo đơn thật trong kiểm tra này.
- Bản Vercel READY xác nhận build từ commit cô lập, không bao gồm các thay đổi kho/POS/worker đang có tại máy. Bản thử và ganhhangrong.vn tải trang chủ và menu đủ 43 món/10 danh mục; tiếng Việt đúng, không thấy lỗi console trong lượt kiểm tra. Cổng quản trị cả bản thử và production vẫn hiển thị form đăng nhập đúng cách, không có lỗi console trong lượt kiểm tra. Không có tài khoản admin ứng dụng trong phiên này để đo Dashboard thật; hành vi refresh/cache đã kiểm tra bằng hook/service thực với RPC giả lập. Không tạo đơn, thanh toán hoặc in thật để kiểm tra.
- ESLint các file liên quan: không lỗi; 2 cảnh báo biến chưa dùng có sẵn trong hook.
- Kiểm tra diff: không lỗi khoảng trắng.
- Build thành công; kiểm tra encoding đạt 656 file nguồn. Có cảnh báo kích thước bundle và Browserslist cũ; không có lỗi build.
- Smoke luồng chính dừng ở `Admin sidebar layout missing`: script tìm chuỗi class cố định, trong khi sidebar dùng class động. Sidebar không thay đổi so với HEAD; đây là giới hạn kiểm tra có sẵn, chưa sửa ngoài phạm vi.

## Truy vấn báo cáo — đã áp dụng

Phát hiện phép nối ép `partner_order_items.partner_order_id` từ UUID thành text trong `get_admin_business_analytics`, khiến chỉ mục UUID không được dùng trực tiếp trong phép nối đại diện.

Chỉ đổi phép nối thành `o.order_id::uuid = poi.partner_order_id`, giữ nguyên kiểu đầu ra, công thức và quyền. Supabase AI đã phản biện phương án. `o.order_id` ở phép nối này xuất phát từ `po.id::text`, nên ép ngược UUID không nhận chuỗi tự do từ người dùng. PostgreSQL luôn xuất UUID theo dạng chuẩn: https://www.postgresql.org/docs/17/datatype-uuid.html.

Phép đối chiếu toàn dữ liệu ban đầu bị giới hạn 8 giây và hết thời gian; không tăng giới hạn hoặc chạy lại truy vấn nặng. Thay bằng CTE dữ liệu mẫu giới hạn nguồn và items theo FK, cùng snapshot chỉ đọc; so sánh toàn bộ 7 cột JSON đầu ra của cả thân SQL cũ/mới. Đạt với mẫu 100 đơn web + 100 đơn đối tác/218 dòng món đối tác; mẫu 1000 + 1000/1874 dòng món; bộ lọc chi nhánh/ngày khác (632 đơn hợp lệ trong snapshot kiểm tra); và mẫu rỗng. Dữ liệu mẫu là dữ liệu thực chỉ dùng nội bộ truy vấn, kết quả xuất ra chỉ có equality/counts.

Áp dụng trong transaction, chặn chờ khóa sau 2 giây và giới hạn lệnh 5 giây. Kiểm tra hash trước sửa để không ghi đè thay đổi khác; chỉ thay một biểu thức. OID `2223212`, owner `postgres`, SECURITY INVOKER, STABLE, cấu hình và ACL không đổi. Hash trước `161492305a6f51cad1ae199771e4a2fe`, sau `07db4292ce164653cf84794009153cc5`. Migration remote `20261006073603_optimize_analytics_partner_uuid_join` đã được ghi nhận; file local khớp version remote.

EXPLAIN không ANALYZE của toàn thân SQL, cùng tham số 01–07/10 và không lọc chi nhánh: chi phí ước tính cũ **43811.27**, mới **14243.46**; nhánh món đối tác từ Seq Scan thành Index Scan với điều kiện UUID. Đây là **ước tính planner**, không phải mức giảm thời gian/CPU thực tế. Không thêm chỉ mục, không tăng timeout của ứng dụng hoặc nâng gói.

Sau áp dụng, RPC thật chạy thành công với role `authenticated` ở khoảng ngày không có đơn; đối chiếu mẫu lớn được chạy lại và vẫn đạt. Điều này xác minh hàm/metadata và mẫu, không thay thế kiểm tra mọi vai trò/chi nhánh hay benchmark toàn tải thực.

Advisors hiệu năng vẫn ghi nhận các nhóm cảnh báo có sẵn như index trùng, policy permissive, khóa ngoại thiếu index và index ít dùng. Không sửa hàng loạt theo các cảnh báo này; cần kiểm chứng từng workload.

## Khôi phục và giới hạn

Nhánh làm việc: `codex/supabase-safe-optimization-20261006`. Giữ nguyên các thay đổi khác đang có trong workspace. Bản sao trước sửa của hai file và hàm SQL nằm trong `.local-backups/supabase-optimization-20261006/`; đây là bản sao phục hồi cục bộ, không phải backup toàn database.

Nếu cần hoàn tác phần frontend, khôi phục riêng hai file từ bản sao và bỏ hai helper mới sau khi kiểm tra không còn import. Không reset toàn nhánh vì có thay đổi khác của dự án.

Các vấn đề quyền truy cập đã ghi trong báo cáo audit vẫn chưa được sửa. Cần đối chiếu vai trò và các luồng ghi thực tế trước khi siết quyền để tránh chặn vận hành.

Rollback SQL dùng `docs/supabase-sql/2026-10-06-analytics-uuid-join-rollback.sql`, chỉ chạy khi hash vẫn đúng phiên bản tối ưu này. Không dùng reset database hay phục hồi toàn workspace. Giữ deployment production cũ nêu trên để khôi phục riêng website khi cần.
# Cập nhật đợt 2 — 06/10/2026

Đã áp dụng migration `20261006075230_optimize_customer_count_filter_before_status`: lọc đúng khách trước khi xử lý trạng thái đơn đối tác, chỉ giữ status cần dùng từ raw_data. 9 đối chiếu output đều bằng nhau; RPC authenticated/phone NULL gọi thành công; metadata và ACL giữ nguyên. Chưa có số đo giảm latency/CPU thực tế. Xem [báo cáo đợt 2](supabase-optimization-phase2-2026-10-06.md) để biết phạm vi, file kiểm chứng và hoàn tác. Không sửa frontend/Android trong đợt này.
