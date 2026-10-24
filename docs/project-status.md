# Công việc còn dang dở của dự án Gánh Hàng Rong

Ngày rà soát: **22/10/2026**. Phạm vi: mã nguồn và tài liệu trong workspace cloud `/workspace/weborder`.

Danh sách này phân biệt phần đã viết nhưng chưa nối vào app, phần còn thiếu theo roadmap, công việc cần xác minh vận hành và tính năng đang tắt có chủ đích. Chưa kiểm tra lại database production, workflow n8n, bản web đang phục vụ hoặc máy POS tại quầy. Trạng thái production trong các báo cáo cũ chỉ là bằng chứng tại ngày báo cáo.

## Cập nhật mới nhất — 24/10/2026: Chấm công Zalo Mini App vẫn đang làm dang dở

- Đã đổi giao diện theo ảnh tham khảo, dùng logo/màu vàng Gánh Hàng Rong; có hiện/ẩn mật khẩu và mục Quyền riêng tư mở đọc được.
- Luồng mới: đăng nhập tài khoản trước, liên kết số điện thoại trong Thông tin tài khoản sau; không tự liên kết khi đăng nhập. Ghi chú cũ về liên kết trước đăng nhập là lịch sử.
- Supabase Auth và kho Testing riêng đã có; PDF/video qua Edge Function có xác thực. Không tích hợp nhân sự production hoặc tính lương.
- Zalo đang ở Testing Version 4 với giao diện cũ. Giao diện mới chỉ build/kiểm tra local, chưa upload lại Zalo.
- Chế độ demo chặn API Zalo thật; chưa xin quyền, gửi xét duyệt hoặc phát hành Live.
- Đã lưu bảng giải trình 11 mục và 12 ảnh. Ảnh điện thoại trước đăng nhập đã cũ; cần chụp lại theo luồng mới. Camera chưa có hình xem trước; chưa chứng minh rung, lưu file/gallery, native PDF hay thực thi quyền trên điện thoại.
- Kiểm tra local gần nhất: build subapp, 16 test, lint phạm vi sửa và UTF-8 đạt. Build không chứng minh chạy trên Zalo thật.
- Khi tiếp tục Cloud: cài dependency theo lock, cấu hình hai biến VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY trong môi trường riêng; không đưa mật khẩu, token hoặc .env vào Git. Tài khoản thử và QR tạm chỉ nằm trong tmp local, không đồng bộ.
- [Giao diện mới và file sửa](checklist/reports/attendance-login-redesign-2026-10-23.md); [bảng giải trình](checklist/reports/attendance-permission-explanations-2026-10-23.md); [Testing 4](checklist/reports/attendance-four-demo-flows-2026-10-23.md).

## 1. Phần đã làm một phần hoặc còn thiếu trong mã nguồn

**Testing 4 đã upload:** Bốn luồng demo đã có trong bản mới, PDF/video lấy qua Supabase, không còn cảnh báo định dạng bị Zalo bỏ qua. Không gọi API Zalo thật; chưa kiểm chứng native/điện thoại, chưa gửi xin quyền/xét duyệt/Live. Xem [kết quả và giới hạn kiểm thử](checklist/reports/attendance-four-demo-flows-2026-10-23.md).

**Bốn luồng demo theo yêu cầu mới nhất:** Đã thêm liên kết số mẫu trước đăng nhập, PDF xem/phóng trang, MP4 phát và lưu xem lại, giữ sáng bằng Web API hoặc mô phỏng khi quét. Không gọi API Zalo thật. [Báo cáo và phần còn thiếu bằng chứng](checklist/reports/attendance-four-demo-flows-2026-10-23.md). Chưa coi demo là chấm công production hoặc bằng chứng xin quyền native.

**Mốc Testing 3:** Bộ icon mới đã upload, chưa xét duyệt/Live. [Rà soát chức năng chấm công](checklist/reports/attendance-icons-readiness-2026-10-23.md) ghi rõ các phần còn thiếu trước sử dụng nhân sự thật: liên kết nhân viên/chi nhánh, GPS/QR thật, thời gian/quy tắc server, ca và duyệt quản lý, Storage bằng chứng; PDF/MP4 chưa hoạt động trên Zalo.

**Mốc Testing 23/10/2026:** Đã upload app chấm công **Testing Version 1** theo CLI, chưa gửi duyệt/Live. Đăng nhập Supabase và dữ liệu thử đã có; chưa kiểm chứng điện thoại Zalo, PDF/MP4 chưa được Zalo upload do định dạng không hỗ trợ. Cần host HTTPS cho tài liệu và kiểm tra native trước khi coi app hoàn thiện. Xem [báo cáo Testing](checklist/reports/attendance-supabase-testing-2026-10-23.md); các đoạn “đang chờ xác thực/chưa upload” phía dưới là trạng thái lịch sử trước mốc này.

**Cập nhật tiếp ngày 23/10/2026:** App chấm công vẫn dang dở, nhưng đã nối Supabase Auth và kho dữ liệu Testing riêng; đã kiểm tra đăng nhập/vào ca/ra ca/lưu lại qua browser. Người dùng cho phép upload bản Testing, chưa cho phép gửi xét duyệt/Live. Upload đang chờ xác thực Zalo; chưa chạy thực trên điện thoại. Ghi chú trước về “chưa nối database” là trạng thái lịch sử đã được thay bằng cập nhật này. Xem [báo cáo mới](checklist/reports/attendance-supabase-testing-2026-10-23.md).

**Bổ sung ngày 23/10/2026 — App chấm công Zalo Mini App đang làm dang dở.** Mã nguồn riêng tại `attendance-miniapp/`: đã có giao diện, tài khoản mẫu, các luồng chấm công/điều chỉnh và cấu hình build Mini App. Chưa nối database; chưa xác nhận chạy trong Zalo trên điện thoại hoặc simulator; chưa gửi xin quyền, xét duyệt hay xuất bản. Chưa cài Studio/VS Code Extension theo yêu cầu dừng của anh. Xem [trạng thái bàn giao](checklist/reports/attendance-zalo-miniapp-conversion-2026-10-23.md). Khi tiếp tục cần kiểm tra runtime Zalo trước, kết nối database làm sau theo yêu cầu.

| Mã | Hạng mục | Đã có và còn thiếu | Việc cần làm để đóng |
| --- | --- | --- | --- |
| DEV-01 | Theo dõi khắc phục sau giám sát | Có `CorrectiveActionsPanel`, hook, service và migration. Không tìm thấy caller của panel trong source; route `/giamsat` hiện mở màn kiểm tra, Admin giám sát có báo cáo/tài khoản/xu hướng nhưng chưa nối panel này. | Chốt điểm truy cập, nối màn vào Admin/giám sát; kiểm tra quyền theo chi nhánh, giao người phụ trách, hạn xử lý và chuyển trạng thái đến xác minh hoàn tất. |
| DEV-02 | Kiểm kê theo nhóm/khu vực | Màn tạo kiểm kê hiện lấy toàn bộ nguyên vật liệu đang hoạt động trong kho. Roadmap yêu cầu thêm chọn nhóm hàng/khu vực. | Chốt phạm vi nhóm/khu vực cần dùng, thêm bộ chọn và kiểm thử danh sách đưa vào phiếu, không làm rơi dữ liệu kiểm kê. |
| DEV-03 | Hoàn thiện đầu ra chứng từ và kiểm kê Kho | Roadmap còn mục ảnh chứng từ private, in/xuất phiếu và xuất Excel kiểm kê. Trong các màn chứng từ/kiểm kê đã rà chưa thấy đường in/xuất tương ứng. Một số báo cáo khác có thể có đầu ra riêng; không đồng nhất với xuất phiếu. | Xác định mẫu biểu và nhu cầu ảnh thực tế; bổ sung từng đầu ra cần dùng, kiểm tra quyền ảnh và số liệu xuất theo đúng bộ lọc. |
| DEV-04 | Lý do sai lệch sản xuất | Roadmap còn yêu cầu lý do khi thực dùng/sản lượng vượt ngưỡng. UI hoàn thành lệnh có số lượng thực tế, chưa thấy trường/ngưỡng giải trình chuyên biệt; `cancellationReason` là lý do hủy, không phải lý do sai lệch sản xuất. | Chốt ngưỡng và luồng phê duyệt, đối chiếu RPC hiện hành rồi bổ sung kiểm tra/giao diện nếu chưa có. Không tự đặt ngưỡng. |
| DEV-05 | Chuẩn hóa giao diện quản trị | Đã có UI primitives và nhiều màn được cải tiến, nhưng roadmap UI còn checklist App Shell/header/filter/trạng thái/responsive/CSS legacy chưa được nghiệm thu đồng bộ. Chưa có đủ bằng chứng để đánh dấu toàn bộ đã xong hoặc chưa làm. | Rà từng route và chốt bảng nghiệm thu theo màn; cập nhật checklist thay vì thực hiện lại toàn bộ thiết kế. |

Bằng chứng theo hạng mục:

- **DEV-01:** [Panel khắc phục](../src/features/supervision/CorrectiveActionsPanel.jsx), [hook](../src/hooks/useSupervisionCorrectiveActions.js), [service](../src/services/supervisionCorrectiveService.js), [route giám sát](../src/features/supervision/SupervisionRoute.jsx), [Admin giám sát](../src/pages/admin/pages/AdminSupervisionPage.jsx), [migration workflow](../supabase/migrations/20260729085334_checklist_corrective_workflow.sql).
- **DEV-02:** [Màn kiểm kê](../src/pages/admin/inventory/InventoryCountModal.jsx), [roadmap Kho, Phase 5](inventory/inventory-roadmap.md).
- **DEV-03:** [Danh sách chứng từ](../src/pages/admin/inventory/InventoryDocumentManager.jsx), [chi tiết chứng từ](../src/pages/admin/inventory/InventoryDocumentDetailModal.jsx), [danh sách kiểm kê](../src/pages/admin/inventory/InventoryCountManager.jsx), [roadmap Kho, Phase 4–5](inventory/inventory-roadmap.md).
- **DEV-04:** [Màn lệnh sản xuất](../src/pages/admin/inventory/InventoryProductionOrderModal.jsx), [service sản xuất](../src/services/inventoryProductionService.js), [roadmap Kho, Phase 6B](inventory/inventory-roadmap.md).
- **DEV-05:** [Roadmap UI quản trị](admin/admin-ui-ux-audit-and-roadmap.md).

## 2. Còn thiếu xác minh hoặc bàn giao vận hành

Các mục dưới đây không đồng nghĩa đang có lỗi; cần bằng chứng hiện tại để đóng.

| Mã | Hạng mục | Khoảng trống còn lại | Bằng chứng hoàn thành cần lưu |
| --- | --- | --- | --- |
| OPS-01 | Bàn giao các thay đổi trên cloud | Các lượt gom tài liệu, dọn code và sửa lint trong chat này đang ở workspace, chưa commit/push/deploy. | Commit/nhánh và diff đã review; nếu phát hành, ghi đúng SHA, nơi triển khai, kết quả kiểm tra và cách quay lại. |
| OPS-02 | Pilot Kho | Roadmap còn pilot một chi nhánh, nhập tồn đầu đối chiếu, chạy song song 7–14 ngày, kiểm tra mạng yếu/thao tác lặp/đổi ca. Chưa tìm thấy biên bản đóng pilot trong tập tài liệu đã rà. | Chi nhánh, thời gian chạy, đối soát chứng từ–movement–balance–tồn thực tế; giải thích hết chênh lệch và xác nhận đào tạo. |
| OPS-03 | Pilot checklist và điểm đánh giá | Code kiểm tra/báo cáo đã có; roadmap còn ít nhất hai vòng thử tại 1–2 cửa hàng, ảnh trên mạng di động, trường hợp bỏ dở và hiệu chỉnh điểm. | Biên bản thử thực tế, phiên bản checklist được duyệt, quyền người dùng và kết quả nộp/tiếp tục phiếu. |
| OPS-04 | POS, máy in và kết nối lại | Test mã nguồn đã có; các báo cáo trước vẫn ghi giới hạn thiết bị. Những lượt dọn hiện tại chưa chạy trọn bộ Jest native hoặc thao tác trên thiết bị. | Ghi phiên bản APK thực tế, chi nhánh, cash/QR, đơn offline đồng bộ lại, hàng đợi in, in lại, mất mạng và giấy in thật. |
| OPS-05 | Đối chiếu lỗi Supabase và release | Báo cáo 07/10 còn truy nguyên lỗi quyền/thiếu cột/timeout và đối chiếu phiên trình duyệt cũ với bản deploy. Không dùng số lỗi ngày 07/10 làm số lỗi hiện tại. | Kiểm tra chỉ đọc bằng cửa sổ thời gian mới, gắn lỗi với caller/role/phiên bản; xác minh bản sửa và đo lại cùng cách đo. |
| OPS-06 | Kiểm chứng phân quyền và giao dịch nhạy cảm | Báo cáo tổng thể còn role matrix và môi trường cô lập cho checkout, claim/hoàn điểm, idempotency, đổi phiên/chi nhánh. Unit test và smoke hiện tại chưa thay thế các ca này. | Kế hoạch kiểm thử cô lập, kết quả từng vai trò và ca retry/rollback; không tạo giao dịch production chỉ để thử. |
| OPS-07 | Baseline migration dựng database trắng | Roadmap Kho còn yêu cầu baseline chính thức trước khi dùng `db reset` dựng toàn hệ. Chưa chạy dựng database trắng trong lần rà này. | Môi trường cô lập dựng được schema/RPC/RLS theo tài liệu và kiểm thử; không sửa ngược migration cũ hoặc repair production chỉ để làm sạch danh sách. |
| OPS-08 | Caller bên ngoài và retention tài nguyên | n8n/POS phiên bản cũ, Storage, cron logs và SQL snippets chưa được xác nhận đầy đủ trong đợt dọn code. Không thể suy ra không còn dùng chỉ từ import của web. | Kiểm kê caller, phiên bản, tham chiếu file, thời hạn lưu và khả năng khôi phục trước khi xóa RPC/tài nguyên. |

Nguồn: [roadmap Kho](inventory/inventory-roadmap.md), [roadmap checklist](checklist/checklist-app-roadmap.md), [báo cáo tổng thể 07/10](supabase/reports/supabase-project-review-2026-10-07.md), [lộ trình tối ưu 07/10](supabase/reports/supabase-optimization-roadmap-2026-10-07.md), [báo cáo dọn cảnh báo](maintenance/unused-vars-cleanup-2026-10-22.md).

## 3. Đang tắt, chờ quyết định hoặc ngoài phạm vi hiện tại

Không tự bật các mục này chỉ vì chúng có code.

- **QR đặt tại quầy:** `enableQrCounterOrdering: false` trong [feature flags](../src/constants/featureFlags.js). Nếu muốn mở cần chốt rollout và kiểm thử thanh toán/bếp/in theo chi nhánh.
- **Lucky draw, comeback reward, customer tier:** các cờ tương ứng đang false. Đây là trạng thái cấu hình, chưa phải bằng chứng tính năng bị lỗi hoặc phải phát triển tiếp ngay.
- **Cài đặt voucher loyalty trong Admin:** `showLoyaltyVoucherSettings: false` chỉ ẩn khu cài đặt; không kết luận toàn bộ voucher runtime bị tắt.
- **Tích tem:** báo cáo triển khai 06/10 ghi chương trình tắt và chưa nghiệm thu thiết bị. Cần đọc cấu hình/live version hiện tại trước khi quyết định phần nào còn chờ; không ghi đây là trạng thái tắt hiện tại đã xác minh. Xem [rollout](loyalty/reports/stamp-program-rollout.md) và [cập nhật bill](loyalty/reports/stamp-confirmation-receipt-2026-10-06.md).
- **Chương trình Việt Sing 19k:** tài liệu dành cho ngày 09–11/10/2026, đã qua thời gian này. Chỉ đối chiếu kết quả lịch sử nếu cần; không đưa việc bật lại vào backlog. [Báo cáo](pos/reports/vietsing-19k-pos-2026-10.md).
- **Truy lô đích danh khi xuất:** hiện roadmap xác định báo cáo lấy lệnh/lô gần nhất làm tham chiếu; phân bổ đến đúng lô chỉ bổ sung nếu pilot phát sinh nhu cầu. Không coi đây là FIFO đã hoàn tất. [Phase 6D](inventory/inventory-roadmap.md).
- **HR mở rộng:** xếp ca/chấm công/nghỉ phép/đào tạo đầy đủ trong roadmap checklist là phạm vi mở rộng sau MVP, cần tách khỏi quản lý nhân viên/checklist đã có.
- **Dung lượng bundle:** build đạt nhưng Vite còn cảnh báo chunk lớn hơn 500 kB. Có thể lập việc đo tải và tách bundle; không gộp với lỗi lint vì lint đã sạch.

## 4. Tài liệu cũ cần cập nhật để không làm lại việc đã xong

| Ghi chú cũ | Đối chiếu hiện tại | Cách cập nhật |
| --- | --- | --- |
| Checklist Phase 2–4 ghi chờ triển khai | Đã có báo cáo từng phase, Admin nhân sự/giám sát, route kiểm tra và báo cáo. | Ghi đã có mã nguồn/báo cáo; tách nghiệm thu/pilot thành mục riêng, không tự đánh dấu production hiện tại. |
| Supervisor ghi sau MVP | Có `checklistAuthService` kiểm tra quyền supervisor và màn `AdminSupervisorAccounts`. | Tách phần tài khoản/quyền đã có khỏi HR mở rộng còn dự kiến. |
| Kho ghi chưa có nhập đầu kỳ, Phase 7 chưa bắt đầu | Có `inventoryOpeningBalanceService`, hook nối vào InventoryWorkspace, màn tồn đầu kỳ; có báo cáo tồn/lô/cảnh báo/Nhập–Xuất–Tồn. | Cập nhật bảng tổng quan theo code và lịch sử; giữ các điều kiện nghiệm thu còn thiếu. |
| README inventory-app nói BOM chưa bật | README nói về MVP ứng dụng riêng; web Admin hiện có module BOM/sản xuất. | Ghi rõ phạm vi ứng dụng riêng so với phân hệ Kho tích hợp, không suy ra toàn dự án thiếu BOM. |
| Báo cáo tổng thể ghi lỗi test quy đổi 6 so với 1200 | Báo cáo lộ trình 07/10 đã ghi sửa fixture; chạy lại `scripts/inventory-unit-conversion.test.mjs` ngày 22/10 đạt. | Giữ báo cáo lịch sử, bỏ lỗi này khỏi danh sách lỗi hiện tại. |
| Báo cáo dọn cũ ghi smoke voucher/lint còn lỗi và 279 cảnh báo | Các lượt sửa tiếp theo đã cho smoke đạt, lint 0 lỗi/0 cảnh báo. | Dùng [báo cáo unused-vars](maintenance/unused-vars-cleanup-2026-10-22.md) làm mốc mới. |
| Kế hoạch POS native còn mô tả các bước scaffold | Ứng dụng native, luồng bán hàng/thanh toán/in và nhiều test đã tồn tại. | Không lấy toàn bộ kế hoạch cũ làm danh sách việc chưa làm; ưu tiên xác nhận thiết bị/release ở OPS-04. |

## 5. Thứ tự xử lý đề xuất

1. Chốt mốc mã nguồn sau đợt dọn để công việc có bản đối chiếu rõ ràng: OPS-01.
2. Xác minh vận hành và lỗi còn thực sự xảy ra: OPS-05, OPS-06, OPS-04.
3. Hoàn thiện màn khắc phục đã viết dở: DEV-01.
4. Chạy pilot và lấy phản hồi trước khi mở rộng Kho/checklist: OPS-02, OPS-03.
5. Từ kết quả pilot, chọn DEV-02–04 và phần truy lô/ảnh/in cần thiết; DEV-05 làm theo từng màn.
6. Làm riêng baseline và retention: OPS-07–08; cập nhật tài liệu tổng theo các mốc có bằng chứng.

## Quy tắc theo dõi tiếp

Mỗi lần đóng một mục cần ghi ngày, người xác nhận, commit hoặc migration liên quan, kết quả kiểm thử và trạng thái triển khai. “Có code”, “test đạt”, “đã deploy” và “đã nghiệm thu tại quầy” là các mốc riêng.

Lượt rà này chỉ bổ sung danh sách công việc và mục lục, không triển khai thêm tính năng hoặc thay đổi dữ liệu. Ngoài đối chiếu tài liệu/source, chỉ chạy lại test quy đổi Kho để kiểm tra một lỗi lịch sử cụ thể.
