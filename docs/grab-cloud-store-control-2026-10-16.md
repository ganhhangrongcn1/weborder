# Điều khiển Bận và theo dõi trạng thái Grab trên cloud

Người dùng yêu cầu chuyển phần tự kéo Bận lên cloud, chỉ sử dụng gói miễn phí. Người dùng xác nhận lựa chọn: khi nhân viên chuyển từ Bận về Bình thường trên Grab thì tôn trọng thao tác đó và tự tắt công tắc kéo Bận.

## Hành vi đã triển khai

- Năm cron mới (job 18–22) gọi `store_sync` mỗi 5 phút, riêng với lịch đánh giá/tài chính mỗi giờ. Các lịch Bận tránh trùng phút với lịch đánh giá của cùng gian hàng.
- Dùng phiên Vault hiện có để đọc `GET /food/merchant/v3/open-status`. Không mở Browserless khi phiên còn hạn; chỉ HTTP 401 được phép gọi đăng nhập cloud một lần, dùng chung giới hạn thử lại 6 giờ. HTTP 403/429 không gây đăng nhập lặp.
- Công tắc tự kéo Bận tắt: chỉ đọc và ghi nhận trạng thái; không đổi cửa hàng.
- Công tắc bật, cửa hàng mở bình thường và chưa có dấu hiệu nhân viên vừa bỏ Bận: gửi lệnh BUSY với `busyModeFoodPrepareTime:15`, rồi đọc lại trạng thái để xác nhận. Đang BUSY thì không gửi lại lệnh thừa. 15 phút là thời gian chuẩn bị đơn mới, không phải thời hạn BUSY.
- Cloud đã quan sát BUSY khi công tắc bật, sau đó thấy NORMAL: tự tắt `busy_enabled`, ghi lý do và không gửi lệnh kéo Bận. API trạng thái không chỉ ra ai đã thao tác, nên mọi chuyển đổi quan sát được từ BUSY về NORMAL đều được tôn trọng.
- Giữ nguyên cửa hàng đang đóng hoặc tạm nghỉ khi chạy tự động; không tự mở lại.
- Các lệnh Bận / Mở bình thường đã xếp hàng trong Admin cũng được cloud xử lý. Dùng CAS và định danh requested_at để tránh ghi đè lệnh mới; lệnh running cũ hơn hai phút có thể phục hồi ở lượt kiểm tra sau.
- Dùng lease chung với đồng bộ đánh giá/tài chính. Phiên chỉ được ghi lại khi thực sự đổi cookie hoặc vừa đăng nhập mới.

## Hiển thị Admin

Trước đây nút chọn phản ánh kết quả lệnh gần nhất, không chứng minh trạng thái hiện tại. Nay API trả snapshot `store_status` và thời điểm kiểm tra. Giao diện hiển thị Mở bình thường / Bận / Đóng / Tạm nghỉ theo snapshot, không tô nút dựa vào quan sát quá 10 phút. Trang đang mở tải lại danh sách mỗi phút khi nhàn rỗi, nhanh hơn khi có lệnh đang chờ.

Thay đổi trạng thái trên Grab được phát hiện ở lượt cloud kế tiếp, thường trong khoảng 5 phút; giao diện cập nhật ở lần tải danh sách tiếp theo. Các thao tác đổi qua lại hoàn toàn giữa hai lần kiểm tra không thể được suy ra từ snapshot.

## Triển khai và kiểm chứng

- `grab-vietsing-pilot` v21 ACTIVE; `partner-review-source-api` v52 ACTIVE. Giữ xác thực x-automation-secret / Admin Auth hiện có, không thay RLS hoặc tạo secret mới.
- Đọc thực tế từ cloud cả 5 gian hàng: HTTP 200, NORMAL, dùng stored_session. Chạy `store_sync` cả 5: ok=true, busy_result.reason=disabled, không thay trạng thái cửa hàng.
- Cả 5 công tắc Bận đang tắt; giữ nguyên lựa chọn hiện tại, không bật thử Bận trên cửa hàng thật.
- Lịch cron đã tự chạy và cập nhật snapshot. Cấu hình miễn phí hiện có được giữ nguyên; không mua hoặc nâng gói.
- 46 bài kiểm tra qua, gồm lệnh BUSY chuẩn bị 15 phút, đọc xác nhận, đóng/tạm nghỉ không bị mở, nhân viên bỏ Bận tự tắt công tắc, phiên còn hạn không đăng nhập, 401 đăng nhập một lần, 403/429 không đăng nhập, lease bị thay và hiển thị snapshot mới hơn lịch sử lệnh.
- Build React và kiểm tra UTF-8 thành công. Vercel production READY, deployment `dpl_buMHWUuYXP5hv5Wy2N8RBFC8k25k`, commit `4003424e42d1bea07b32737dd820b91bac625ea1`, nhánh `codex/grab-cloud-store-control-20261016`.
- Commit giao diện dựa trên đúng production `ee0ccfac788245dc63865bc8b1cb5c3bd5890263`, chỉ cập nhật bốn file Admin; không triển khai toàn bộ nhánh local. Asset Admin production HTTP 200 có các trường trạng thái và hướng dẫn mới.
- Chưa kiểm tra trang Admin sau đăng nhập vì tab Chrome hiện ở màn hình đăng nhập. Chưa phát lệnh BUSY trên cửa hàng thật hoặc quan sát nhân viên bỏ Bận thật; các nhánh ghi đã được kiểm thử với API giả lập, không tuyên bố đây là bằng chứng thao tác thật.

## File

Mới:

- `supabase/functions/grab-vietsing-pilot/storeControl.ts`
- `scripts/grab-cloud-store-control.test.mjs`
- `scripts/grab-cloud-store-ui.test.mjs`
- `docs/supabase-sql/20261016_grab_cloud_store_control.sql`
- Báo cáo này.

Cập nhật:

- `supabase/functions/grab-vietsing-pilot/index.ts`
- `supabase/functions/partner-review-source-api/index.ts`
- `src/pages/admin/pages/AdminPartnerReviewsPage.jsx`
- `src/pages/admin/partner-reviews/PartnerReviewOperations.jsx`
- `src/pages/admin/partner-reviews/partnerReviewUi.js`
- `src/pages/admin/partner-reviews/PartnerReviewSourceForm.jsx`

Rollback: tắt đúng năm job `grab-cloud-store-*` theo SQL đã lưu; lịch đánh giá/tài chính vẫn hoạt động. Giao diện có thể rollback về deployment `dpl_4vaRpingYAQ8K74TbgykgymSUKsu`. Không xóa session, dữ liệu hoặc cấu hình của các gian hàng. Worker trên máy chưa bị dừng hoặc gỡ cài đặt trong lượt này; người dùng có thể tắt worker sau khi chuyển các chức năng trên.
