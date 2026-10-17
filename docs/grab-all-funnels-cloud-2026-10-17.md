# Phễu Grab toàn bộ gian hàng · 17/10/2026

## Phạm vi triển khai

Mở đồng bộ phễu cho 5 gian hàng thuộc 4 chi nhánh: Vietsing, hai gian hàng 30/4, Lê Hồng Phong và Thích Quảng Đức. Các GPID/GFID/merchant group đều đã đối chiếu qua merchant-selector, permission statements và store profile của chính tài khoản tương ứng. Không dùng ánh xạ suy đoán hoặc dữ liệu màn hình điện thoại.

- Supabase `qjaklysckgzdfjthzkzu`: worker `grab-vietsing-pilot` v23; domain API `partner-review-source-api` v54.
- Giữ nguyên các lịch đồng bộ mỗi giờ tại phút 00/05/10/15/20. Không thêm cron hay dịch vụ. Các lịch trạng thái cửa hàng giữ nguyên.
- Mỗi lượt thêm 2 request Insights (summary và daily), vẫn dành 25 giây cuối cho lưu đánh giá/tài chính và trả lease.
- Không thay đổi bảng hoặc RLS. Dùng lại `partner_grab_conversion_funnel_daily`, idempotent theo `(source_id, metric_date)`.
- API tổng hợp chỉ lấy nguồn trong allowlist; lọc chi nhánh bằng quyền Admin ở server. Từng dòng phải khớp cả source và branch trước khi tổng hợp.
- Tỷ lệ = tổng tử số / tổng mẫu số; không lấy trung bình tỷ lệ từng quán/ngày. Hai gian hàng 30/4 có thể xem riêng hoặc tổng hợp theo chi nhánh.
- Coverage tính cả số ngày và số gian hàng; thiếu một gian hàng/ngày không được báo đủ dữ liệu.

## Kiểm chứng

Đã gọi API summary/daily trực tiếp và kiểm tra tổng daily khớp summary cho cả 5 gian hàng. Sau triển khai, chạy cloud thật tuần tự ngày 17/10/2026 lúc 10:23 giờ Việt Nam, mỗi lượt HTTP 200, `funnel.ok=true`, 16 ngày 01–16/10. Cả 5 dùng `stored_session`, không gọi Browserless. Mỗi lượt vẫn lưu 2 snapshot tài chính và đánh giá, remaining=0.

| Gian hàng | Ngày | Xem quán | Thực đơn | Giỏ | Checkout |
| --- | ---: | ---: | ---: | ---: | ---: |
| Vietsing | 16 | 70.520 | 1.860 | 507 | 171 |
| 30/4 chính | 16 | 13.366 | 1.982 | 818 | 320 |
| 30/4 phụ | 16 | 11.824 | 1.415 | 479 | 177 |
| Lê Hồng Phong | 16 | 20.818 | 4.065 | 1.713 | 752 |
| Thích Quảng Đức | 16 | 91.892 | 4.007 | 1.827 | 827 |

Database sau chạy có đủ 80 bản ghi ngày. Đây là lượt xem và checkout, không phải khách duy nhất hoặc đơn hoàn tất. Lượt cloud thủ công đã được chứng minh; không ép hết phiên trên production. Kiểm thử mô phỏng có kiểm tra khôi phục 401 cho cả 5 tài khoản; 403/429 không kích hoạt đăng nhập.

54 kiểm thử collector, quyền chi nhánh, tổng hợp, recovery và trạng thái cửa hàng đạt. Build, encoding và lint component đạt. Live anon action bị 403, đọc thẳng bảng bị 401.

## Giao diện

Thẻ Phễu khách hàng nằm riêng dưới báo cáo Tài chính Grab, bốn tầng có chiều rộng và diện tích tỷ lệ đúng với số lượt, chung một thang tuyến tính. Các tầng căn giữa để thể hiện phễu; nhãn số và phần trăm đặt ngoài vùng tô để không bị ép rộng cho vừa chữ. Không dùng độ rộng cố định, min-width, làm tròn hình vẽ hoặc thang log. Tỷ lệ trên tầng lấy lượt xem quán làm mốc 100%; các tỷ lệ chuyển bước vẫn ở bên cạnh. Bộ lọc gian hàng/chi nhánh hiện có áp dụng cho phễu; ngày phễu độc lập với ngày tài chính. Bảng chi tiết hiển thị số gian hàng có dữ liệu từng ngày.

Frontend commit `81bdf9da3c4cf527226ea9017995a91303db972f`, trên nhánh `codex/vietsing-grab-funnel-20261017`, base production `6cf23a98ef78b3fd0b205398b55bdcdb94b193ab`. Chỉ 2 file giao diện được push. Backend đã deploy Supabase; mã nguồn và kiểm thử được bổ sung vào nhánh GitHub theo tài liệu `grab-cloud-source-release-2026-10-17.md`. Các thay đổi khác trong worktree được giữ nguyên.

Production `dpl_HVC86pMiVDFqtn9npj9j59drM4nh` READY, alias `ganhhangrong.vn`. Web Admin thật đã hiển thị tổng 208.420 / 13.329 / 5.344 / 2.247 và tỷ lệ 6,4% / 16,86% / 1,08%. Chọn Thích Quảng Đức đúng số riêng; chi nhánh 30/4 gộp 25.190 / 3.397 / 1.297 / 497, chọn riêng gian hàng thứ hai còn 11.824 / 1.415 / 479 / 177.

## File cập nhật

- `supabase/functions/grab-vietsing-pilot/accounts.ts`
- `supabase/functions/grab-vietsing-pilot/funnel.ts`
- `supabase/functions/grab-vietsing-pilot/index.ts`
- `supabase/functions/partner-review-source-api/funnelReport.ts`
- `src/pages/admin/partner-reviews/GrabConversionFunnel.jsx`
- `src/styles/admin/grab-funnel.css`
- `scripts/grab-conversion-funnel.test.mjs`
- `scripts/grab-vietsing-pilot.test.mjs`

## File mới

- Tài liệu này.
- `docs/supabase-sql/20261017_grab_all_funnels_checks.sql` (chỉ SELECT).

## Khôi phục

Web: production trước là `dpl_Cb6y5ChoxZqvsVMzee5CwR3gCCDq`. Worker v22, domain API v53 là bản trước khi mở rộng. Giữ các bản ghi phễu đã lưu và lịch cron. Không cần bật worker Windows.

## Sửa độ rộng biểu đồ theo số liệu thực

Bản infographic đầu dùng độ rộng 100/83/67/53% cho bố cục, không thể hiện tỷ lệ thật; người dùng yêu cầu sửa. Bản mới commit `d9c1bac88d6b4c222cf2015310dd8afecfbb55ba` dùng width = value / max(stage values) * 100, cùng chiều cao nên cả diện tích và chiều rộng tỷ lệ với số lượt. Phần trăm nhãn = value / reach * 100. Với dữ liệu hiện tại reach là lớn nhất: 100% / 6,40% / 2,56% / 1,08%. Nếu dữ liệu không giảm dần vẫn giữ số thật, không ép thành hình phễu giả; mẫu số 0 hiển thị gạch và số 0 không tô diện tích.

File cập nhật lần sửa này: `src/pages/admin/partner-reviews/GrabConversionFunnel.jsx`, `src/styles/admin/grab-funnel.css`, tài liệu này. File mới: `src/utils/grabFunnelChart.js`, `scripts/grab-funnel-chart.test.mjs`. Bốn kiểm thử tỷ lệ biểu đồ, build và lint đã qua. Không sửa worker hoặc dữ liệu Supabase.

Bản sửa tỷ lệ đã triển khai production `dpl_4EnNLDUmnUPfwEHc89aKWGAvckwB` READY và kiểm tra trên `ganhhangrong.vn`: CSS width lần lượt 100%, 6.39526%, 2.56405%, 1.07811%. Đã đo DOM chiều rộng tô màu thực tế, khớp trong sai số làm tròn dưới pixel của trình duyệt. Ảnh xác minh: `output/grab-funnel-exact-proportions-20261017.jpg`.
