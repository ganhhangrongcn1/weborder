# Phễu Vietsing: Supabase và web GHR

## Đã triển khai

- Supabase project `qjaklysckgzdfjthzkzu`.
- `grab-vietsing-pilot` v22: thêm collector phễu chỉ cho Vietsing; dùng cùng lịch sync mỗi giờ đã có, không thêm job.
- `partner-review-source-api` v53: action `funnel_report` sau kiểm tra admin active và phạm vi chi nhánh. Triển khai dựa trên v52 đang chạy, chỉ thêm import và nhánh đọc phễu; không đưa các sửa Marketing khác trong worktree lên production.
- Vercel production `dpl_4ivVZZWPTZp6DQTxQnvzKGfHW9y2`, commit `ff31d060b4e2d1c56ae7b1765cca1add4131276f`, base production `f2f431cacf4bf20cdafa079720399d2da38bfab3`. Chỉ 5 file frontend được phát hành trên nhánh `codex/vietsing-grab-funnel-20261017`.
- Giao diện: `https://ganhhangrong.vn/admin/grab-finance`, khối **Phễu chuyển đổi · Vietsing**. Bộ lọc ngày riêng, mặc định đầu tháng đến hết hôm qua; có chi tiết theo ngày, cập nhật gần nhất, cảnh báo thiếu dữ liệu/lỗi/cũ. Trang đang mở tự tải lại dữ liệu đã lưu mỗi 5 phút khi tab hiển thị.

## Đồng bộ và ý nghĩa dữ liệu

Collector gọi summary và daily bằng cookie Vault và scope v2 đã xác minh của Vietsing. Mỗi lượt lấy tối đa 31 ngày đã kết thúc, không sớm hơn 01/10/2026. Ngày cũ giữ trong database. Hai request đọc báo cáo bổ sung, một upsert; không thêm dịch vụ, dependency hay gói trả phí. Không gọi Browserless khi phiên còn dùng được.

Chỉ sau khi đủ ngày, số nguyên không âm, không trùng ngày và tổng daily khớp summary mới upsert theo `(source_id, metric_date)`. Dữ liệu sai/thiếu không ghi đè bản tốt bằng số 0. Lỗi phễu được ghi riêng, giữ luồng đánh giá/tài chính; dành thời gian cuối lượt cho lưu dữ liệu và trả lease. HTTP 403/429 không kích hoạt đăng nhập; 401 có thể dùng lại cơ chế Browserless Free tối đa một lần trong lượt, theo cooldown và ngân sách thời gian sẵn có.

Bảng `partner_grab_conversion_funnel_daily` đã tồn tại và đang trống trước triển khai. Dùng lại cấu trúc và RLS deny-direct-access, không tạo bảng trùng hoặc sửa quyền. Các cột reach/visit/basket/order tương ứng lượt xem quán/thực đơn/giỏ/checkout; `order_count` của bảng này không được hiển thị như số đơn hoàn tất.

Tỷ lệ trên web = tỷ số tổng các lượt của những ngày đã đồng bộ, làm tròn hai số lẻ. Không lấy trung bình tỷ lệ từng ngày. Khi mẫu số bằng 0 hiển thị dấu gạch; khi thiếu ngày có cảnh báo phạm vi. Đây không phải số khách riêng biệt của màn hình mobile 30/4. Không đồng bộ bảng theo kênh vì chưa xác minh quy tắc cộng/khử trùng lặp.

## Kiểm chứng thực tế

- Lượt cloud ngày 17/10/2026, 10:02 giờ Việt Nam: HTTP 200, ok=true, stored_session, 8 đánh giá, 2 snapshot tài chính, remaining=0; phễu 16 ngày từ 01–16/10. Không có đăng nhập Browserless trong lượt này.
- Query database sau lượt cloud: 70.520 lượt xem quán, 1.860 xem thực đơn, 507 tới giỏ, 171 checkout; một nguồn Vietsing. Tổng khớp API đã kiểm tra trước đó.
- Mở production bằng phiên admin thật: hiển thị đúng các số trên và tỷ lệ 2,64% / 9,19% / 0,24%. Chọn nguồn khác hiển thị chưa bật, không hiện số Vietsing; chọn lại Vietsing dữ liệu tải đúng.
- API report bằng anon bị HTTP 403; đọc thẳng bảng bằng anon bị HTTP 401. Không xuất cookie/password/token ra frontend.
- Build workspace và bản tách từ production thành công; lint 4 file JS/JSX liên quan qua; 43 kiểm thử worker/collector/quyền/trạng thái qua.
- Lịch hourly đang active; đã chứng minh lượt thực thi cloud thủ công. Không cần chờ máy người dùng mở và không bật lại task Windows. Chưa chờ một chu kỳ cron kế tiếp và chưa ép phiên hết hạn mới để thử riêng Insights trên production.

## File thêm

- `supabase/functions/grab-vietsing-pilot/funnel.ts`
- `supabase/functions/partner-review-source-api/funnelReport.ts`
- `src/services/grabConversionFunnelService.js`
- `src/hooks/useGrabConversionFunnel.js`
- `src/pages/admin/partner-reviews/GrabConversionFunnel.jsx`
- `src/styles/admin/grab-funnel.css`
- `scripts/grab-conversion-funnel.test.mjs`
- `docs/supabase-sql/20261017_grab_funnel_checks.sql` (chỉ đọc)
- Tài liệu này.

## File cập nhật

- `supabase/functions/grab-vietsing-pilot/index.ts`
- `supabase/functions/partner-review-source-api/index.ts`
- `src/pages/admin/pages/AdminGrabFinancePage.jsx`

## Rollback

Web: phục hồi deployment production trước `dpl_3qaKV6Kj9dR4a3wLtnC8ekbBc2kW` nếu cần. Worker: phục hồi bundle v21; domain API: bundle v52. Giữ bảng dữ liệu và các lịch cũ. Không bật worker Windows song song. Tất cả thay đổi ngoài phạm vi trong worktree vẫn giữ nguyên.
