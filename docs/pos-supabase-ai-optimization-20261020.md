# Rà soát POS với Supabase AI — 20/10/2026

## Nguồn và phạm vi

- Đã fetch `origin/codex/pos-order-receive-regression-20261020`, HEAD ban đầu đúng `50f7ec18f420f794b216c05cd2ab4719bd60a8ad`, đọc AGENTS.md trên nhánh này và hai tài liệu bàn giao.
- Làm trong checkout riêng vì workspace chính ở nhánh cũ và có thay đổi POS/Grab chưa commit. Không đưa các thay đổi đó vào nhánh này.
- Trao đổi bằng trình duyệt đã đăng nhập tại dự án [weboder](https://supabase.com/dashboard/project/qjaklysckgzdfjthzkzu), cuộc chat **Website POS Bottleneck Review**. Hai lượt: yêu cầu số liệu chỉ đọc, rồi phản biện khuyến nghị bằng code thực tế.
- Chỉ chạy SELECT thống kê/catalog/publication sau khi đọc SQL; không tạo đơn hoặc lệnh in, không sửa database/RLS/function/publication. Không chạy lại migration `20261020122126_paid_website_receipt_stamps.sql`.
- Không đọc/xuất secrets hoặc dữ liệu cá nhân trong các kết quả thống kê. Báo cáo chỉ giữ số liệu tổng hợp; không commit ảnh dashboard có thông tin tài khoản.

## Số liệu quan sát

Đây là số liệu Supabase AI đọc qua công cụ trong dashboard, đối chiếu với kết quả SELECT hiển thị. Không phải telemetry từ máy POS tại quán.

| Nguồn / cửa sổ | Kết quả | Giới hạn |
| --- | --- | --- |
| Request logs: 19/10 13:02:52 đến 20/10 13:02:52 UTC (20:02:52 giờ Việt Nam) | GET orders: 24.446; order_items: 4.705; print_jobs: 7.700; các GET trên trả 200 | Toàn project, không tách POS/web/thiết bị/version; không có latency theo endpoint. HTTP 200 không chứng minh máy quán nhận/hiển thị/in được. |
| Cùng cửa sổ log | Một POST print_jobs trả 409 | Chưa xác định caller hoặc nguyên nhân; không tự quy là lỗi hay trùng bill. |
| pg_stat_statements, reset 15/10/2026 08:57:15 UTC | Một mẫu 263 ms/43 calls; mẫu 48 ms/1.359 calls, max 2,31 s; mẫu 9,09 ms/15.926 calls, max 2,03 s | Các statement nhắc orders/order_items/print_jobs, không ánh xạ chính xác client/endpoint. Không phải thời gian request đầu-cuối. |
| Table/index counters, thời điểm reset không xác định (`pg_stat_database.stats_reset = NULL`) | orders: 789 seq scans, khoảng 13,58 triệu tuple đọc; order_items: 0 seq scans; print_jobs: 1.172 seq scans, 926.891 tuple đọc, ước lượng 669 row | Tích lũy, không được coi là 24 giờ hoặc chỉ POS. |
| Index counters cùng snapshot | orders.created_at: 70.795 scans; orders_open_pos_pager_created_id_idx: 28.706; orders_pos_shift_id_created_at_idx: 55.726; order_items_order_id_idx: 2.089.396; print_jobs_branch_status_idx: 10.709 | Index đang được dùng; chưa có query plan của request máy quán để quyết định thêm index. |
| Publication supabase_realtime | Có orders, print_jobs; không có order_items | Đường danh sách website hiện nghe orders, phù hợp publication. Không thêm publication chỉ vì khuyến nghị chung. |
| Log 24 giờ | Realtime: 29 INFO; postgres_logs: 397 ERROR, phân loại thấy 5 statement timeout và 48 permission denied | Số bản ghi log không phải số realtime events/độ trễ. Chưa gán lỗi này cho POS hoặc bản 0.4.29. |

Dashboard overview ở lần mở hiển thị Healthy, CPU 7%, RAM 75%, disk 59%, 26/60 connections. Đây là snapshot tổng quan, không loại trừ sự cố mạng/session riêng của máy quán.

AI còn báo RLS SELECT permissive có điều kiện `true` ở các bảng liên quan. Chưa audit đầy đủ grants/policy và chưa đổi quyền trong tác vụ hiệu năng này; cần rà soát bảo mật riêng trước khi kết luận phạm vi dữ liệu từng role được đọc.

## Đối chiếu khuyến nghị với code

1. **Giảm tải đọc orders / cân nhắc cursor:** `readWebsiteOrders` đã select danh sách cột cụ thể, lọc OR ba UUID chi nhánh, giới hạn ngày, sort `created_at DESC, id DESC`, phân trang 80 row/lượt. Vẫn đọc hết đơn trong ngày rồi loại counter ở client để không làm mất đơn website phía sau. Chuyển cursor hoặc lọc nguồn phía server cần kiểm chứng riêng cả phone/nguồn cũ và phân trang; chưa làm trong bản vá nhỏ này.
2. **Batch order_items:** đường tải danh sách website không đọc `order_items`; đề xuất này không phải cách sửa trực tiếp đường đang treo. Không thêm truy vấn items vào danh sách.
3. **Thu hẹp print_jobs:** trạm in đã lọc branch, pending, printer `cashier-80mm`, hai job types, cửa sổ 5 phút, limit 3, realtime INSERT theo branch và polling dự phòng 30 giây. Không thay luồng tạo/claim/retry/in hoặc tem.

Điểm xác định được từ code: polling website đã kiểm tra foreground, nhưng realtime callback và timer throttle 150 ms có thể tiếp tục gọi tải mới khi app ở nền. Đây là tải không cần thiết có thể tái hiện bằng test; chưa đo được nó chiếm bao nhiêu request production hoặc gây triệu chứng ở quán.

## Bản vá ứng dụng

Chỉ thay lifecycle của `usePosWebsiteOrderSync`: không bắt đầu lượt tải mới khi AppState không active; kiểm tra khi nhận realtime và trước khi thực hiện lượt chờ. Foreground vẫn yêu cầu snapshot ngay, vì vậy sự kiện bỏ qua khi chạy nền được tải bù từ server. Giữ một request đang chạy + một lượt pending, deadline 10 giây, abort khi logout/đổi chi nhánh, giữ danh sách khi lỗi. Không hủy thêm request đang chạy chỉ vì app xuống nền.

Không cần cờ dirty riêng vì listener foreground luôn gọi refresh, kể cả không nhận được realtime event trong lúc nền. Nếu đang có request thì refresh đó đi vào pending hiện có.

Supabase AI đồng ý phạm vi và lưu ý race trong 150 ms, tải bù foreground, request đang chạy/timeout. Các nhận xét này là review, không thay thế kiểm thử.

## Kiểm thử

- **Trước vá:** 3 regression mới thất bại trên hook gốc của `50f7ec1` (9 test cũ trong suite vẫn qua). Tái hiện realtime burst khi background, timer active chuyển inactive trước 150 ms, và pending tiếp tục tải ở nền sau timeout.
- **Sau vá:** toàn bộ native **151/151 test, 34/34 suite qua**, không bỏ qua test. Giữ cấu hình timeout mặc định. Lượt toàn suite đầu có một test ghi chú món cũ quá 5 giây trên môi trường Windows; chạy lại riêng qua, rồi chạy lại toàn suite qua trong 5,504 giây. Không sửa test ghi chú món hoặc tăng timeout để né lỗi.
- Website pagination + Kitchen refresh queue: **8/8 qua**.
- ESLint đúng hai file native thay đổi: qua, exit 0.
- `npm.cmd run build`: qua (encoding 689 file, Vite 5.4.19). Có cảnh báo chunk lớn và Browserslist cũ; không lỗi build.
- Kiểm tra UTF-8 nghiêm ngặt cho hook, test và báo cáo; `git diff --check`: qua.
- Dùng dependencies native local sau khi xác nhận hai lockfile cùng SHA-256 `3118E65F1100AAF34E77073EEC59C9DDC95ABD33D5A8C4E01EA4B04B02B21A3C`. Không thay package/lockfile; không commit dependencies hoặc dữ liệu cài dở.

Lệnh chạy lại:

```powershell
npm.cmd --prefix ghr-pos-mobile-native test -- --runInBand
node --test scripts/pos-website-queue.test.mjs scripts/kitchen-refresh-queue.test.mjs
Push-Location ghr-pos-mobile-native
.\node_modules\.bin\eslint.cmd src/features/pos/hooks/usePosWebsiteOrderSync.js __tests__/posWebsiteOrderSync.test.js
Pop-Location
npm.cmd run build
git diff --check
```

Đây là test renderer/mocks và build, không phải chạy APK trên thiết bị quán. Không sửa SQL/print pipeline trong lượt này; không chạy lại migration hay gửi lệnh in để kiểm thử.

## Bàn giao Cloud / Android

- Giữ 0.4.29/versionCode 60 vì chưa có APK bản này được build/giao theo bàn giao. APK 0.4.28 đã giao không có bản vá timeout 10 giây hoặc bản vá lifecycle lần này.
- Không merge main; Cloud tiếp tục lấy nhánh `codex/pos-order-receive-regression-20261020`.
- Giữ nguyên `.github/workflows/pos-android-release.yml`, khóa ký và guard `github.sha == vars.POS_RELEASE_APPROVED_SHA`. Biến phải bằng đúng SHA commit cần build; không bỏ guard để né lỗi 403 ở Cloud.
- Tác vụ này chuẩn bị source và kiểm thử để Cloud build bằng GitHub Actions; không build APK local, không dispatch workflow khi SHA chưa được duyệt.
- Sau khi cài APK mới: kiểm tra máy quán nhận một đơn website thật ở foreground, xuống nền rồi mở lại, phục hồi sau lỗi mạng, và bill sau thanh toán có tem. Chưa có bằng chứng thiết bị/máy in trong lượt này.

## Tệp của lượt này

- Cập nhật `ghr-pos-mobile-native/src/features/pos/hooks/usePosWebsiteOrderSync.js`.
- Cập nhật `ghr-pos-mobile-native/__tests__/posWebsiteOrderSync.test.js`.
- Tạo `docs/pos-supabase-ai-optimization-20261020.md`.
