# Lộ trình hoàn thiện Kho Gánh Hàng Rong

Ngày lập: 2026-08-24
Trạng thái tổng thể: schema Kho đã triển khai production, ghi Kho chỉ mở có kiểm soát trên local Admin
Phạm vi: `inventory-app`, Supabase `inventory_*`, tích hợp Admin/POS/đơn hàng GHR
Nguyên tắc: audit trước, triển khai theo phase, không đưa vào vận hành thật khi sổ kho chưa đối chiếu được.

## Mục tiêu

Xây phân hệ kho dùng được hằng ngày cho mô hình F&B nhiều chi nhánh, có thể truy ngược mọi thay đổi tồn kho từ chứng từ hoặc đơn hàng, không sửa số tồn trực tiếp và không để UI báo hoàn thành khi dữ liệu chưa được ghi nhận an toàn.

Luồng đích:

```text
Danh mục + đơn vị + cấu trúc kho
→ nhập / xuất / chuyển / kiểm kê
→ sổ biến động bất biến
→ tồn hiện tại + giá vốn
→ BOM món ăn
→ đơn hoàn tất tự trừ kho
→ cảnh báo và đối chiếu đơn ↔ kho
```

## Bảng tiến độ

| Phase | Nội dung | Ước lượng | Trạng thái |
|---|---|---:|---|
| 0 | Audit, chốt hợp đồng nghiệp vụ và phạm vi | 1–2 ngày | Hoàn thành |
| 1 | Kiểm tra schema thật, migration và engine chứng từ | 4–6 ngày | Gần hoàn thành |
| 2 | Tích hợp ứng dụng kho vào Admin và router URL thật | 3–4 ngày | Hoàn thành |
| 3 | Danh mục nền và phân quyền theo kho | 3–4 ngày | Hoàn thành |
| 4 | Nhập, xuất, chuyển kho và yêu cầu cấp hàng | 7–10 ngày | Gần hoàn thành |
| 5 | Kiểm kê, chênh lệch và sổ kho | 5–7 ngày | Backend SQL draft một phần |
| 6 | BOM, tự trừ kho theo đơn và giá vốn | 8–12 ngày | Chưa bắt đầu |
| 7 | Cảnh báo, báo cáo và đối chiếu đơn ↔ kho | 5–7 ngày | Chưa bắt đầu |
| 8 | Pilot 1 chi nhánh, ổn định và mở rộng | 7–14 ngày theo vận hành | Chưa bắt đầu |

Ước lượng kỹ thuật trước pilot: **35–52 ngày làm việc**, đã gồm khoảng 15% dự phòng kiểm thử và sai lệch dữ liệu. Không nên cam kết ngày phát hành trước khi hoàn thành Phase 1 và kiểm tra schema production.

## Tiến độ hiện tại

- **Toàn bộ lộ trình trước pilot: khoảng 62%.** Đây là tỷ lệ theo khối lượng kỹ thuật đã có bằng chứng, không tính bản nháp chưa chạy như phần đã hoàn thành.
- **Phase 0 — audit và hợp đồng nghiệp vụ: 100%.**
- **Phase 1 — schema và engine chứng từ: khoảng 98%.** Schema, smoke/concurrency test, postcheck và migration kho đã qua trên bản sao schema-only của production trong Supabase local/PostgreSQL 17. Advisor không có cảnh báo `inventory_*`; lint còn lỗi cũ ở CRM/loyalty/profile ngoài phạm vi Kho. Còn thiết lập baseline migration chính thức cho khả năng dựng toàn hệ từ database trắng; chưa được phép sửa lịch sử thanh toán cũ chỉ để phục vụ Kho.
- **Phase 2 — router/UI Admin kho: 100%.** Đã có menu Admin hai tầng theo nhóm nghiệp vụ, 14 URL thật, module lazy-load riêng, chính sách quyền giao diện được kiểm thử, khung trạng thái tải/lỗi/dữ liệu cũ/thử lại và giao diện local không ghi dữ liệu. Admin tổng được chọn toàn hệ thống; Admin/nhân viên có chi nhánh bị khóa đúng một chi nhánh; nhân viên thiếu chi nhánh và tài khoản bếp bị chặn. Nhóm Sản xuất hiển thị rõ BOM/Lệnh sản xuất thuộc Phase 6 và bị vô hiệu hóa; URL Kho không hợp lệ được đưa về Tổng quan. RLS và quyền dữ liệu thật vẫn thuộc Phase 3.
- **Phase 3 — dữ liệu nền/phân quyền: 100%.** Ba migration Kho đã triển khai thành công lên Supabase production ngày 2026-08-24; migration history Local/Remote khớp. Postcheck Phase 1, Phase 3 và P0 form cài đặt đạt, RLS bật, frontend không có quyền ghi trực tiếp sổ/tồn và Security Advisor không có cảnh báo `inventory_*`. Tài khoản Admin hệ thống đang hoạt động đã được cấp đúng một quyền `admin` Kho toàn hệ thống và kiểm tra RLS bằng phiên `authenticated` đạt. UI → hook → service cho tạo/sửa/lưu trữ mềm Kho, Nguyên vật liệu, Danh mục NVL, Đơn vị tính và Nhà cung cấp đã hoàn chỉnh. Đơn vị gốc/quy đổi, mô tả/thứ tự danh mục và mã NVL tự sinh theo loại đã chạy trên production. Local Admin đã mở khóa ghi kép để smoke có kiểm soát; cấu hình mẫu/deploy vẫn mặc định tắt. Bốn kho nền đã được tạo idempotent và đối chiếu đạt: một kho tổng, ba kho chi nhánh mặc định, cả ba cùng nhận cấp hàng từ kho tổng, không trùng mã.
- **Dữ liệu nền sẵn sàng nhập NVL:** production đã có 9 đơn vị chuẩn (7 gốc, 2 quy đổi) và 7 danh mục NVL có mô tả. Chưa tạo NVL thật, chứng từ, movement hoặc số tồn; tránh suy đoán công thức từ menu bán hàng.
- **Phase 4 — nhập/xuất/chuyển/cấp hàng: khoảng 82%.** UI và chuỗi xử lý nhập, xuất, chuyển, yêu cầu cấp hàng, phiếu hủy đã nối production. Phiếu nhập mua đã có nhà cung cấp, đơn giá, mã lô, ngày sản xuất và HSD; hoàn tất phiếu ghi movement, balance, giá vốn và lô trong cùng transaction. Còn ảnh/in phiếu, tồn đầu kỳ chính thức và pilot chứng từ thật.
- **Phase 5 — kiểm kê/sổ kho: khoảng 78%.** UI kiểm kê đã nối engine production; Phiếu điều chỉnh tồn thủ công đã có nháp → gửi duyệt → Admin/quản lý đúng kho duyệt & ghi sổ, bắt buộc lý do và chặn giảm thành tồn âm. Sổ kho chỉ đọc đã có lọc ngày/kho/NVL, phân trang và đối chiếu tồn đầu–nhập–xuất–tồn cuối; còn phạm vi kiểm theo nhóm hàng, cảnh báo giao dịch trong lúc đếm, Excel và pilot chứng từ thật.
- **Phase 6: 0%.** Chưa làm BOM và tự trừ theo đơn.
- **Phase 7 — cảnh báo/báo cáo: khoảng 20%.** Báo cáo tồn hiện tại đã có số lượng, giá vốn bình quân, giá trị tồn, trạng thái sắp hết/hết hàng và bộ lọc theo kho/danh mục/NVL; RLS giới hạn đúng phạm vi kho. Còn HSD theo lô, đối chiếu đơn, báo cáo thời gian và RPC tổng hợp quy mô lớn.
- **Phase 8: 0%.** Chưa pilot vận hành.
- **Mức sẵn sàng production: khoảng 72%.** Schema, RLS, quyền Admin, bốn kho nền, chuỗi chứng từ Phase 4, kiểm kê và điều chỉnh tồn Phase 5 đã có; local Admin ghi có kiểm soát qua Auth/RLS. Chưa pilot phiếu điều chỉnh/phiếu nhập mua thật, chưa chốt tồn đầu kỳ chính thức và chưa mở bản deploy production cho nhân viên.

Tỷ lệ này được cập nhật theo bằng chứng: audit/tài liệu, code draft, kiểm thử runtime, tích hợp UI và pilot. Viết xong SQL nhưng chưa chạy thử không được tính như tính năng hoàn thành.

## Phase 0 — Audit và hợp đồng nghiệp vụ

### Đã hoàn thành

- Audit trực tiếp phân hệ Quản lý Kho của Techres.
- Lập bản đồ router dữ liệu nền, nhập xuất, cảnh báo, sản xuất và đối chiếu đơn.
- Đối chiếu với `inventory-app` và schema `inventory_*` hiện tại.
- Xác định khoảng trống lớn nhất: UI hiện có nhưng chưa có engine hoàn tất chứng từ và cập nhật tồn an toàn.

### Quyết định đã chốt

- Không sao chép nguyên giao diện Techres; học chuỗi trạng thái và khả năng truy nguyên.
- Không cập nhật `inventory_stock_balances` trực tiếp từ UI.
- Mọi thay đổi tồn phải có chứng từ, dòng chứng từ và movement tương ứng.
- BOM và trừ kho theo đơn chỉ làm sau khi nhập–xuất–chuyển–kiểm kê đã ổn định.

## Phase 1 — Schema thật và engine chứng từ

### Công việc

- [x] Audit production ở chế độ chỉ đọc: xác nhận có 0 bảng, 0 function, 0 policy và 0 trigger `inventory_*`.
- [x] Đối chiếu và repair phần lịch sử migration có đủ bằng chứng; còn hai file loyalty untracked lệch timestamp được giữ ngoài phạm vi Kho.
- [x] Phân loại migration drift thành cùng tên khác timestamp, local-only và remote-only; lưu tại `docs/inventory-migration-drift-audit.md`.
- [x] Chốt state machine cho từng loại chứng từ theo tham chiếu Techres; lưu tại `docs/inventory-techres-operating-contract.md`.
- [x] Cập nhật schema draft local theo state machine: chuyển kho hai đầu, snapshot kiểm kê, liên kết phiếu nguồn/đảo, event audit, khóa trạng thái nháp và quyền Data API tối thiểu.
- [x] Chạy schema draft trên database disposable/local PostgreSQL 17; xác nhận nạp mới và nạp lặp đều thành công.
- [x] Viết và chạy RPC/transaction hoàn tất chứng từ có idempotency key cho phiếu đơn giản, chuyển kho, yêu cầu cấp hàng và kiểm kê.
- [x] Khi hoàn tất: ghi movement và cập nhật balance trong cùng transaction; smoke test đối chiếu tồn 69/26 đã qua.
- [x] Cấm sửa dòng chứng từ sau khi hoàn tất; huỷ bằng chứng từ đảo, không xoá lịch sử.
- [x] Thêm và chạy audit/postcheck cho tổng movement, balance, operation, RLS và quyền function.
- [x] Kiểm thử hai lần submit, mất phản hồi/tải lại và hai người thao tác đồng thời. Xác nhận cùng phiếu chỉ sinh một movement; hai phiếu tranh tồn chỉ một phiếu thành công; retry cùng idempotency key không ghi lặp.
- [x] Chạy Security Advisor, Performance Advisor và database lint; sửa index `rejected_by` và tách policy ghi để còn 0 cảnh báo/0 lỗi có thể hành động.
- [x] Tạo migration `20260824030247_inventory_phase1_engine.sql` bằng Supabase CLI và nạp trực tiếp thành công trên database trắng.
- [x] Xác minh migration Kho trên bản sao schema-only production trong Supabase local tách riêng; không lấy dữ liệu và không chạy mutation trên production.
- [ ] Thiết lập baseline migration chính thức cho toàn hệ trước khi yêu cầu `db reset` dựng được từ database trắng; không sửa ngược migration thanh toán cũ hoặc repair production history khi chưa có kế hoạch riêng được duyệt.

### Điều kiện hoàn thành

- Một chứng từ chỉ được ghi tồn đúng một lần dù người dùng bấm lại.
- Tổng movement giải thích được số balance tương ứng.
- Không thể sửa/xoá chứng từ đã hoàn tất qua frontend hoặc RLS.
- Migration chạy thử và postcheck thành công trước production.

## Phase 2 — Tích hợp Admin và router

### Router đề xuất

```text
/admin/inventory/dashboard
/admin/inventory/warehouses
/admin/inventory/items
/admin/inventory/item-categories
/admin/inventory/units
/admin/inventory/suppliers
/admin/inventory/receipts
/admin/inventory/issues
/admin/inventory/transfers
/admin/inventory/requisitions
/admin/inventory/counts
/admin/inventory/ledger
/admin/inventory/reports
/admin/inventory/reconciliation
```

### Công việc

- [x] Đưa kho vào menu Admin hiện tại, không tạo hệ đăng nhập thứ hai.
- [x] Dùng route URL thật thay cho `activePage` trong state.
- [x] Route guard bước đầu theo vai trò Admin hiện hữu: chặn tài khoản bếp, nhân viên phải có `branch_uuid`; RLS/phân kho chi tiết hoàn thiện ở Phase 3.
- [x] Giữ module kho tách bundle để không làm nặng customer/POS; build sinh chunk `InventoryWorkspace` riêng.
- [x] Thêm khung trạng thái tải, lỗi, dữ liệu cũ và nút thử lại rõ ràng.
- [x] Kiểm tra desktop, tablet và điện thoại; menu nhóm vẫn mở đúng và màn hình nghiệp vụ giữ nguyên URL.
- [x] Hiển thị module tương lai đúng trạng thái: Sản xuất có Công thức (BOM) và Lệnh sản xuất gắn nhãn Phase 6/Sắp ra mắt, không thể thao tác nhầm.
- [x] Chuyển URL con Kho không hợp lệ về `/admin/inventory/dashboard` thay vì giữ URL sai.
- [x] Tách và kiểm thử chính sách quyền giao diện: Admin tổng, Admin theo chi nhánh, nhân viên theo chi nhánh, nhân viên thiếu chi nhánh và tài khoản bếp.
- [x] Khoá bộ lọc chi nhánh trên trang Kho khi tài khoản chỉ được giao một chi nhánh.

### Điều kiện hoàn thành

- Refresh không mất màn hình đang xem.
- Có thể gửi link thẳng tới đúng danh sách hoặc chứng từ.
- Nhân viên không nhìn thấy kho ngoài phạm vi được giao.
- Build web chính và build kho đều thành công.

Phase 2 đóng ở phạm vi router/UI. Quyền đọc/ghi dữ liệu thật không dựa vào frontend và sẽ được RLS kiểm soát trong Phase 3.

## Phase 3 — Dữ liệu nền và phân quyền

### Công việc

- [x] Schema local cho kho trung tâm, kho chi nhánh và kho bộ phận; UI CRUD đã nối qua hook/service và vẫn khóa ghi mặc định.
- [x] Database tự đồng bộ/kiểm tra cặp `branch_id` và `branch_uuid`; frontend tiếp tục dùng hợp đồng `branchIdentityService` hiện hữu.
- [x] Schema đơn vị gốc và đơn vị mua/quy đổi; tỷ lệ bằng 0 bị chặn bằng constraint và test.
- [x] Schema nhóm hàng, nguyên vật liệu, bao bì, bán thành phẩm và thành phẩm.
- [x] Schema nhà cung cấp và mặt hàng theo nhà cung cấp.
- [x] Schema điểm đặt hàng, cho phép tồn âm và trạng thái hoạt động.
- [x] Mô hình quyền owner/admin/central manager/branch manager/staff/viewer; admin toàn hệ thống bắt buộc access không gắn kho.
- [x] Nền lưu trữ mềm và thu hồi quyền xoá vật lý cho danh mục; service/UI thao tác lưu trữ mềm đã nối.
- [x] Admin đang hoạt động của hệ thống có đường khởi tạo quản trị Kho; quyền admin chỉ gắn một kho không được nâng thành quản trị toàn hệ thống.
- [x] Đồng bộ loại kho giữa UI và schema: trạng thái đang vận chuyển do phiếu chuyển quản lý, không tạo loại “kho trung chuyển”.
- [x] Postcheck chỉ đọc kiểm tra cột Phase 3, trigger, RLS, Data API grant, quyền DELETE và ràng buộc loại kho.
- [x] Service đọc `inventory_warehouses` và màn danh sách Kho chỉ đọc: tìm kiếm, lọc loại kho, thống kê trạng thái, map chi nhánh và xử lý rõ schema/RLS chưa sẵn sàng.
- [x] Nhánh Kho mới trong Admin có Sơ đồ/Danh sách, form Thêm kho trung tâm/chi nhánh/bộ phận/lưu động và lưu bản nháp local; không sửa hoặc phụ thuộc `inventory-app` cũ.
- [x] Nối màn Danh mục NVL và Đơn vị tính theo hợp đồng chỉ đọc: service/hook riêng, tìm kiếm, lọc trạng thái, thống kê, chuẩn hoá lỗi thiếu schema/cột/quyền và không mở thao tác ghi.
- [x] Nối màn Nguyên vật liệu và Nhà cung cấp theo cùng hợp đồng chỉ đọc; nguyên vật liệu hiển thị nhóm, đơn vị gốc, đơn vị mua, tỷ lệ quy đổi và điểm đặt hàng.
- [x] Hoàn thiện service/hook/form tạo, sửa và lưu trữ mềm cho toàn bộ nhóm Xây dữ liệu; khóa ghi riêng mặc định tắt.
- [x] Kiểm thử CRUD dưới đúng role `authenticated`: Admin tạo/cập nhật/soft-delete được, `DELETE` vật lý bị chặn.
- [x] Triển khai hai migration Kho lên production; postcheck và Security Advisor đạt; sau đó tạo có kiểm soát bốn kho nền đã duyệt.
- [x] Cấp đúng một quyền Admin Kho toàn hệ thống cho tài khoản Admin đang hoạt động; kiểm tra RLS dưới role `authenticated` đạt.
- [x] Bật `VITE_ENABLE_INVENTORY_RUNTIME_WRITES` riêng trên local sau phê duyệt; giữ cờ Supabase chung tắt và không bật trên bản deploy production.
- [x] Hoàn thiện P0 form cài đặt theo audit Techres: đơn vị gốc/quy đổi cùng loại đo lường, mô tả/thứ tự danh mục, loại Vật tư tiêu hao và mã NVL tự sinh theo tiền tố.
- [x] Triển khai migration `20260824085831_inventory_phase3_p0_settings_forms.sql`; dry-run chỉ có đúng migration này, test giao dịch tự hoàn tác và postcheck production đều đạt.

### Điều kiện hoàn thành

- Không có mã kho/NVL trùng.
- Quy đổi đơn vị được kiểm tra và không cho tỷ lệ bằng 0.
- Mỗi chi nhánh vận hành có kho mặc định rõ ràng.
- Tài khoản chi nhánh chỉ đọc/ghi đúng kho được giao.

## Phase 4 — Nhập, xuất, chuyển và cấp hàng

### Công việc

- [x] Mở giao diện gọn cho đúng bốn nghiệp vụ: Phiếu nhập kho, Phiếu xuất kho, Chuyển kho nội bộ và Yêu cầu xuất kho; bố cục danh sách + form nhập nhanh tham khảo iPOS nhưng bỏ VAT, công nợ, ảnh và các loại phiếu nâng cao.
- [x] Nối danh sách chứng từ thật, lưu bản nháp, gửi xử lý và hoàn tất phiếu nhập/xuất qua service/hook riêng; bản nháp không thay đổi tồn, thao tác hoàn tất dùng RPC idempotent của engine.
- [x] Nối thao tác Chuyển kho: giao theo số thực giao, nhận theo số thực nhận, bắt buộc lý do khi lệch và khóa phiếu sau khi nhận.
- [x] Nối thao tác Yêu cầu xuất kho: duyệt/từ chối, bắt buộc lý do khi cắt giảm, tạo duy nhất một phiếu chuyển liên kết và khép yêu cầu sau khi phiếu chuyển hoàn tất.
- [x] Thêm màn chi tiết chỉ đọc cho cả bốn loại phiếu; chuyển kho và yêu cầu xuất cùng đối chiếu yêu cầu/duyệt/giao/nhận/chênh lệch, đồng thời hiển thị lý do và phiếu chuyển liên kết.
- [ ] Nhập đầu kỳ.
- [x] Nhập mua: nhà cung cấp bắt buộc, đơn giá, mã lô tự gợi ý, ngày sản xuất và hạn dùng theo cấu hình NVL; hoàn tất mới cộng tồn, ghi giá vốn và tạo lô tồn kho.
- [x] Phiếu hủy: chọn kho, ngày hủy và lý do bắt buộc; bản nháp chưa trừ tồn, chỉ khi hoàn tất mới trừ kho nguồn và ghi sổ chuyển động.
- [x] Xuất dùng nội bộ với lý do bắt buộc; lưu nháp không trừ tồn, hoàn tất mới ghi movement và giảm kho nguồn.
- [x] Chuyển kho: phiếu tạo tay vẫn có nháp → gửi; phiếu sinh từ yêu cầu đi thẳng tới chờ giao. Giao hàng trừ kho nguồn; nhận đủ tự hoàn tất, nhận lệch dừng lại để Admin đối chiếu.
- [x] Yêu cầu cấp hàng: kho bộ phận/chi nhánh tạo → kho nguồn duyệt hoặc từ chối. Duyệt tự sinh và gửi một phiếu chuyển; nhận đủ tự khép cả phiếu chuyển lẫn yêu cầu.
- [ ] Chụp/lưu ảnh chứng từ trong bucket private nếu cần.
- [ ] In hoặc xuất phiếu theo mẫu thống nhất.

### Điều kiện hoàn thành

- Xuất kho không bị dùng nhầm cho chuyển kho.
- Kho nguồn giảm khi giao và kho đích tăng theo quy tắc trạng thái đã chốt.
- Khi nhận lệch phải ghi số thực nhận và lý do.
- Người không có quyền không thể duyệt hoặc hoàn tất phiếu.

## Phase 5 — Kiểm kê và sổ kho

### Công việc

- [ ] Tạo đợt kiểm kê theo kho/khu vực/nhóm hàng. Đã có tạo theo kho với toàn bộ NVL đang dùng; còn lọc khu vực/nhóm hàng.
- [x] Snapshot tồn hệ thống tại thời điểm bắt đầu qua RPC và hiển thị đối chiếu theo đúng đơn vị NVL.
- [x] Nhập số đếm thực tế, gửi duyệt và bắt buộc nguyên nhân cho từng dòng có chênh lệch.
- [x] Luồng duyệt chênh lệch trước khi tạo stock adjustment; UI không sửa balance trực tiếp và chỉ gọi RPC idempotent.
- [x] Phiếu điều chỉnh tồn thủ công: chọn kho, lý do bắt buộc, tăng/giảm theo từng NVL; bản nháp/gửi duyệt chưa đổi tồn, Admin hoặc quản lý đúng kho duyệt mới ghi movement và balance.
- [x] Sổ kho theo thời gian: lọc theo ngày/kho/NVL; tính tồn đầu, nhập, xuất, tồn cuối từ movement và balance hiện có; danh sách chỉ đọc, phân trang phía Supabase.
- [ ] Khoá hoặc cảnh báo giao dịch phát sinh trong lúc kiểm kê.
- [ ] Xuất Excel và lịch sử người thực hiện/người duyệt.

### Điều kiện hoàn thành

- Không sửa balance trực tiếp từ màn hình kiểm kê.
- Chênh lệch đã duyệt sinh movement có thể truy ngược.
- Công thức tồn đầu + nhập − xuất = tồn cuối khớp theo từng NVL/kho.

## Phase 6 — BOM, đơn hàng và giá vốn

### Công việc

- [ ] BOM liên kết `product`/topping bằng ID ổn định, không dùng tên món.
- [ ] Định lượng theo phần hoặc theo mẻ.
- [ ] Tỷ lệ hao hụt và khu vực/kho xuất mặc định.
- [ ] Phiên bản BOM có hiệu lực theo thời gian; không sửa ngược lịch sử.
- [ ] Đơn hoàn tất tạo sự kiện trừ kho idempotent.
- [ ] Huỷ/hoàn đơn tạo movement đảo theo quy tắc rõ ràng.
- [ ] Xử lý món chưa có BOM, chi nhánh chưa có kho và thiếu mapping.
- [ ] Chốt phương pháp giá vốn: bình quân hoặc FIFO; không trộn hai cách.

### Điều kiện hoàn thành

- Một đơn chỉ trừ kho một lần.
- Có thể giải thích giá vốn từ đơn → món → BOM version → movement.
- Món thiếu BOM không âm thầm bị bỏ qua; phải xuất hiện trong đối chiếu.
- So sánh tối thiểu 30 đơn giữa đơn hàng, movement và giá vốn đều khớp.

## Phase 7 — Cảnh báo, báo cáo và đối chiếu

### Công việc

- [ ] Tồn thấp/dưới điểm đặt hàng.
- [ ] Tồn âm.
- [ ] Sắp hết hạn/đã hết hạn theo lô.
- [ ] Thiếu nguyên liệu tại kho bộ phận.
- [ ] Đơn đã trừ/chưa trừ kho và tỷ lệ bao phủ.
- [ ] Nhập–xuất–tồn, giá trị tồn và giá vốn theo kho/chi nhánh/thời gian. Đã có báo cáo tồn hiện tại và giá trị theo kho; còn báo cáo tổng hợp theo thời gian/RPC.
- [ ] Mỗi cảnh báo phải có nguyên nhân và nút đi thẳng tới cách xử lý.
- [ ] Dùng RPC tổng hợp, không tải toàn bộ movement lên trình duyệt để tính.

### Hợp đồng nguồn cảnh báo Tổng quan

- Tồn thấp lấy từ **số dư tồn thật theo kho** so với `reorder_point`; `order_quantity` chỉ dùng đề xuất số lượng cần nhập, không tự tạo chứng từ.
- Tồn dưới mức an toàn lấy từ số dư tồn thật so với `minimum_stock`; `maximum_stock` dùng phát hiện tồn vượt mức để tránh nhập dư.
- Sắp hết hạn lấy từ **lô nhập thật** có `expiry_date` và số ngày cảnh báo mặc định của NVL; không suy đoán ngày hết hạn chỉ từ ngày tạo nguyên vật liệu.
- Đã hết hạn lấy từ lô còn số lượng khả dụng nhưng `expiry_date` đã qua; phải dẫn thẳng tới danh sách lô và thao tác xử lý.
- Tổng quan chỉ hiển thị cảnh báo sau khi Phase 4 có chứng từ, lô và số dư vận hành thật. Các trường cấu hình ở Phase 3 là ngưỡng đầu vào, không phải dữ liệu cảnh báo giả lập.

### Điều kiện hoàn thành

- Cảnh báo không chỉ báo đỏ mà chỉ rõ việc cần làm.
- Báo cáo khớp với sổ kho và chứng từ nguồn.
- Bộ lọc chi nhánh/kho/thời gian hoạt động nhất quán.

## Phase 8 — Pilot và phát hành

### Công việc

- [ ] Chọn một chi nhánh và một nhóm NVL nhỏ để pilot.
- [ ] Nhập tồn đầu có biên bản đối chiếu.
- [ ] Chạy song song sổ hiện tại trong 7–14 ngày.
- [ ] Đối chiếu hằng ngày: chứng từ, movement, balance và tồn thực tế.
- [ ] Kiểm thử mạng yếu, thao tác lặp, đổi ca và thiết bị khác nhau.
- [ ] Đào tạo nhân viên bằng luồng ngắn: nhập, nhận chuyển, kiểm kê.
- [ ] Chỉ mở rộng sau khi không còn sai lệch chưa giải thích được.

### Điều kiện hoàn thành

- Không có chênh lệch tồn không truy được nguyên nhân trong thời gian pilot.
- Nhân viên vận hành được mà không cần người viết code hỗ trợ trực tiếp.
- Có phương án khôi phục và tắt tính năng trừ kho tự động khi có sự cố.

## Phụ thuộc dữ liệu

| Dữ liệu/hợp đồng | Nguồn | Hiện trạng | Cần xác nhận trước phase |
|---|---|---|---|
| Bảng `inventory_*` production | Supabase | Đã audit live: hiện có 0 object `inventory_*` | 1 |
| Lịch sử migration production | Supabase CLI/history | 15 local-only đã repair theo bằng chứng; còn 2 cặp loyalty ngoài phạm vi | 1 |
| Chi nhánh chuẩn | `branches`, `branchIdentityService` | Đã có ở hệ GHR, cần map kho | 3 |
| Sản phẩm và topping | Catalog GHR | Có, cần ID/mapping ổn định | 6 |
| Trạng thái đơn được phép trừ kho | `orders` và POS/webhook | Chưa chốt hợp đồng | 6 |
| Huỷ/hoàn đơn | Order service/POS | Cần chốt sự kiện đảo kho | 6 |
| Giá mua/lô/hạn dùng | Phiếu nhập | Chưa triển khai | 4 |

## Rủi ro chính

| Rủi ro | Mức độ | Cách xử lý |
|---|---|---|
| Migration history production lệch | Cao | Audit và đồng bộ lịch sử trước khi deploy |
| Submit lặp làm trừ kho hai lần | Cao | RPC transaction + idempotency key + unique constraint |
| Tên/ID món không đồng nhất giữa POS và Website | Cao | Dùng ID ổn định và bảng mapping có audit |
| BOM bị sửa làm sai giá vốn lịch sử | Cao | Version BOM bất biến theo thời gian |
| Người dùng sửa balance trực tiếp | Cao | Chỉ cấp quyền đọc balance; mọi ghi qua RPC chứng từ |
| Tồn âm bị che giấu | Cao | Cảnh báo riêng và cấu hình cho phép theo từng kho |
| Pilot quá rộng | Trung bình | Bắt đầu một chi nhánh, ít NVL, chạy song song |
| Báo cáo tải toàn bộ dữ liệu | Trung bình | Index đúng bộ lọc và RPC aggregate |

## Ngoài phạm vi trước pilot

- Dự báo nhu cầu bằng AI.
- Tự động đặt hàng nhà cung cấp.
- Kế toán công nợ nhà cung cấp hoàn chỉnh.
- Sản xuất nhiều công đoạn/phân xưởng phức tạp.
- Đồng bộ hai chiều với một ERP bên ngoài.

Những phần này chỉ được thêm sau khi Phase 8 ổn định và phải đánh giá lại thời gian.

## Cách cập nhật file này

Sau mỗi đợt làm việc:

1. Đổi checkbox của đúng công việc đã kiểm tra.
2. Chỉ đổi phase thành `Hoàn thành` khi toàn bộ điều kiện hoàn thành đã có bằng chứng.
3. Ghi một dòng vào nhật ký bên dưới.
4. Liệt kê migration, commit hoặc file kiểm thử liên quan.
5. Nếu đổi phạm vi, ghi rõ lý do và ảnh hưởng tiến độ.

## Nhật ký thực hiện

| Ngày | Phase | Kết quả | Bằng chứng/Ghi chú |
|---|---|---|---|
| 2026-08-24 | 0 | Hoàn thành audit Techres và so sánh kho GHR | Audit chỉ đọc; chưa sửa code hoặc production |
| 2026-08-24 | 1 | Hoàn thành bước audit hiện trạng production | CLI 2.105.0; production có 0 bảng/function/policy/trigger `inventory_*`; migration local/remote đang lệch; không mutation |
| 2026-08-24 | 1 | Phân loại migration drift | 17 cặp cùng tên khác timestamp; 15 local-only; 8 remote-only; chưa repair hoặc deploy tại thời điểm phân loại |
| 2026-08-24 | 1 | Lập dấu chân object của 17 cặp migration | Xác định các bảng/function/index/trigger/cron cần đối chiếu; không chạy lại migration |
| 2026-08-24 | 1 | So hash SQL local/remote | 13/17 khớp tuyệt đối sau chuẩn hoá khoảng trắng; 4 file khác do cập nhật ngược hoặc sửa mojibake; chưa đổi timestamp/repair |
| 2026-08-24 | 1 | Chuẩn hoá 11 timestamp local | Chỉ đổi tên 11 file tracked hash-equivalent về version remote; 2 file loyalty untracked được giữ nguyên; không sửa production |
| 2026-08-24 | 1 | Khôi phục migration remote-only | Fetch 8 file từ history trong thư mục tạm; sửa literal UTF-8 ở 2 file dashboard local; remote-only còn 0; không chạy SQL |
| 2026-08-24 | 1 | Xác minh 15 migration local-only | 14 có bằng chứng object/quyền/function mạnh; normalize replies đạt trạng thái đích 0 `[null]`; chuẩn bị repair plan nhưng chưa mutation |
| 2026-08-24 | 1 | Repair lịch sử 15 migration đã có trạng thái đích | Được phê duyệt; chỉ cập nhật migration history, không chạy SQL; postcheck Local/Remote khớp và `inventory_*` vẫn 0 object |
| 2026-08-24 | 1 | Chốt hợp đồng vận hành theo Techres | Đã chốt router đích, state machine, thời điểm ghi tồn, quyền và các điểm schema phải sửa; chỉ cập nhật tài liệu local |
| 2026-08-24 | 1 | Cập nhật schema draft local | Bổ sung mô hình giao/nhận, kiểm kê, phiếu nguồn/đảo, audit event, index FK và RLS chặt hơn; xác nhận `branches.id` bigint, `branch_uuid` uuid không unique; chưa chạy SQL |
| 2026-08-24 | 1 | Viết engine RPC nền | Draft local có RPC gửi duyệt và hoàn tất phiếu đơn giản, khóa dòng chứng từ/balance, idempotency operation, movement + balance cùng transaction và postcheck chỉ đọc; chưa chạy SQL |
| 2026-08-24 | 1 | Viết RPC chuyển kho | Draft local có giao kho nguồn, nhận kho đích và khóa phiếu; payload gắn idempotency key, nhận vượt số giao bị chặn, nhận thiếu bắt buộc lý do và chỉ admin khóa chênh lệch; chưa chạy SQL |
| 2026-08-24 | 1 | Viết RPC kiểm kê | Draft local có bắt đầu/lưu số đếm/gửi/duyệt/hoàn tất, dùng movement sequence để tính đúng phát sinh trong lúc kiểm và sinh phiếu điều chỉnh riêng; đã mở rộng postcheck chỉ đọc, chưa chạy SQL |
| 2026-08-24 | 1/4 | Viết RPC yêu cầu cấp hàng | Draft local có duyệt/từ chối theo kho nguồn, duyệt giảm bắt buộc lý do, sinh một phiếu chuyển liên kết và chỉ fulfilled sau khi phiếu chuyển completed; không tạo movement trực tiếp; chưa chạy SQL |
| 2026-08-24 | Tổng | Ghi nhận tiến độ trước khi có runtime local | Khoảng 15% toàn lộ trình trước pilot; Phase 1 khoảng 70%; production readiness 0% |
| 2026-08-24 | 1 | Chuẩn bị smoke test engine | Thêm kịch bản transaction + rollback cho tồn đầu, xuất kho, chuyển lệch, yêu cầu cấp hàng, kiểm kê điều chỉnh và idempotent replay; local chưa có Docker/Postgres nên mới kiểm tra tĩnh, chưa tính là runtime pass |
| 2026-08-24 | 1 | Chạy engine trên Supabase local/PostgreSQL 17 | Nạp schema mới và nạp lặp thành công; smoke test đủ nhập/xuất/chuyển/cấp hàng/kiểm kê/idempotency qua và tự rollback dữ liệu giả |
| 2026-08-24 | 1 | Sửa hai lỗi bắt được bằng runtime/postcheck | Thay `GROUP BY true` không tương thích PostgreSQL 17; thu hồi rõ quyền function khỏi `anon`, giữ `authenticated` thực thi bình thường |
| 2026-08-24 | 1 | Phát hiện migration local cũ chưa tự dựng được DB trắng | `20260614131538_pos_payment_sessions_phase_1.sql` tạo index trên `sepay_webhook_logs` trước khi bảng tồn tại; chưa sửa vì ngoài phạm vi Kho và có thể ảnh hưởng thanh toán |
| 2026-08-24 | Tổng | Cập nhật tiến độ theo bằng chứng runtime | Khoảng 18% toàn lộ trình trước pilot; Phase 1 khoảng 85%; production readiness vẫn 0% vì chưa deploy, tích hợp UI hay pilot |
| 2026-08-24 | 1 | Kiểm thử đồng thời và mất phản hồi | Hai phiên nhân viên chạy thật qua `dblink`: cùng phiếu chỉ ghi một lần; hai phiếu cùng cần 7 trên tồn 10 chỉ một phiếu hoàn tất và tồn còn 3; retry sau mất phản hồi trả idempotent replay |
| 2026-08-24 | Tổng | Cập nhật tiến độ sau kiểm thử đồng thời | Khoảng 19% toàn lộ trình trước pilot; Phase 1 khoảng 92%; production readiness vẫn 0% vì chưa deploy, tích hợp UI hay pilot |
| 2026-08-24 | 1 | Chạy advisor/lint và tối ưu schema | Security Advisor 0 vấn đề; database lint 0 lỗi; bổ sung index `rejected_by`, tách policy ghi khỏi SELECT; Performance Advisor còn 0 cảnh báo/0 lỗi có thể hành động |
| 2026-08-24 | 1 | Đóng gói migration Kho | Tạo `20260824030247_inventory_phase1_engine.sql` bằng CLI; nạp trực tiếp trên database trắng, postcheck và advisor đều đạt; chưa deploy hoặc `db push` |
| 2026-08-24 | Tổng | Cập nhật tiến độ sau advisor/migration | Khoảng 20% toàn lộ trình trước pilot; Phase 1 khoảng 97%; production readiness vẫn 0% |
| 2026-08-24 | 1 | Xác nhận nguyên nhân chuỗi migration cũ | Production có `profiles`, `branches`, `orders`, `sepay_webhook_logs` từ trước version đầu tiên trong migration history; lỗi local là thiếu baseline, không phải Docker hay schema Kho |
| 2026-08-24 | 1 | Kiểm thử migration Kho trên schema production rỗng | Dump schema-only `public`, `private`, `loyalty_private`, `maintenance`; nạp vào Supabase local tách riêng, migration Kho + postcheck + smoke + concurrency đều qua; không lấy dữ liệu production |
| 2026-08-24 | 1 | Kiểm tra chất lượng sau migration | Advisor không có kết quả `inventory_*`; database lint chỉ còn lỗi/cảnh báo cũ ngoài phạm vi Kho; không sửa CRM/loyalty/profile |
| 2026-08-24 | Tổng | Cập nhật tiến độ sau kiểm thử trên schema thật | Khoảng 20% toàn lộ trình trước pilot; Phase 1 khoảng 98%; production readiness vẫn 0%, chưa deploy hoặc `db push` |
| 2026-08-24 | 2 | Tích hợp router và menu Admin kho | Thêm 14 URL `/admin/inventory/*`, menu Quản lý kho, giữ nguyên Admin Auth hiện hữu và không tạo luồng đăng nhập riêng |
| 2026-08-24 | 2 | Dựng khung UI local an toàn | Tách chunk `InventoryWorkspace`, có guard vai trò/phạm vi chi nhánh, trạng thái tải/lỗi/cũ/thử lại; toàn bộ nút ghi dữ liệu bị vô hiệu hóa |
| 2026-08-24 | 2 | Kiểm tra Phase 2 | Build + encoding đạt, ESLint phạm vi đạt, mapping route đạt; link Phiếu nhập và refresh giữ nguyên URL; desktop đã kiểm tra trực quan ở chế độ local |
| 2026-08-24 | 2 | Chia nhóm menu theo TechRes | Quản lý kho có các nhóm thu gọn/mở rộng: Xây dữ liệu, Xuất nhập kho, Kiểm kê & đối soát, Báo cáo & cảnh báo; bổ sung route Danh mục NVL |
| 2026-08-24 | 2 | Kiểm tra menu đa kích thước | Desktop, tablet 820px và điện thoại 390px hiển thị đúng; nhóm chứa route đang xem tự mở sau refresh |
| 2026-08-24 | 2 | Hoàn thiện vỏ điều hướng Phase 2 | Thêm nhóm Sản xuất với BOM/Lệnh sản xuất bị khóa và nhãn Phase 6; URL Kho không hợp lệ tự chuyển về Tổng quan |
| 2026-08-24 | 2 | Khép lại Phase 2 | Tách chính sách quyền Kho, khóa bộ lọc chi nhánh theo tài khoản; 6/6 test quyền/route, ESLint và build đạt; RLS thật chuyển sang Phase 3 |
| 2026-08-24 | Tổng | Cập nhật tiến độ Phase 2 | Khoảng 25% toàn lộ trình trước pilot; Phase 2 khoảng 80%; production readiness vẫn 0% vì chưa deploy migration, chưa nối dữ liệu thật và chưa pilot |
| 2026-08-24 | 3 | Đóng gói nền dữ liệu và phân quyền | Tạo migration `20260824060412_inventory_phase3_foundation.sql`: kho bộ phận, kho mặc định/chi nhánh, bán thành phẩm, điểm đặt hàng, lưu trữ mềm và siết admin toàn hệ thống; chưa deploy production |
| 2026-08-24 | 3 | Kiểm thử Phase 3 trên PostgreSQL 17 tách riêng | Phase 1 → Phase 3 chạy thành công, Phase 3 chạy lặp thành công; test tự rollback đạt đồng bộ chi nhánh, kho mặc định duy nhất, tên bộ phận, quy đổi, soft delete, quyền xoá và phạm vi admin |
| 2026-08-24 | 3 | Giữ nguyên lỗi baseline ngoài phạm vi | Supabase local full-chain vẫn dừng ở migration POS cũ tham chiếu `sepay_webhook_logs`; không sửa vì ngoài phạm vi Kho và có thể ảnh hưởng thanh toán |
| 2026-08-24 | Tổng | Cập nhật tiến độ đầu Phase 3 | Khoảng 29% toàn lộ trình trước pilot; Phase 3 khoảng 45%; production readiness vẫn 0% vì chưa deploy, chưa nối service/UI CRUD và chưa pilot |
| 2026-08-24 | 3 | Nối màn danh sách Kho chỉ đọc | Thêm service + hook + UI bảng Kho; 8/8 test đạt, ESLint/build/encoding đạt; trình duyệt xác nhận production chưa có schema được báo an toàn, không phát sinh thao tác ghi |
| 2026-08-24 | Tổng | Cập nhật tiến độ sau màn Kho | Khoảng 30% toàn lộ trình trước pilot; Phase 3 khoảng 50%; production readiness vẫn 0% vì chưa deploy migration, chưa mở CRUD và chưa pilot |
| 2026-08-24 | 3 | Bổ sung tạo kho trên nhánh Admin mới | Đối chiếu form Techres; thêm Sơ đồ/Danh sách, form ba tầng, chọn chi nhánh/kho cấp hàng/trừ mặc định/tồn âm và lưu bản nháp local; 10/10 test + build đạt; không sửa `inventory-app` cũ |
| 2026-08-24 | Tổng | Cập nhật tiến độ sau luồng Thêm kho | Khoảng 31% toàn lộ trình trước pilot; Phase 3 khoảng 55%; production readiness vẫn 0% vì dữ liệu mới chưa ghi Supabase production |
| 2026-08-24 | 3/6 | Audit logic cài đặt kho Techres | Xác nhận bốn loại kho, điều kiện chi nhánh, mã khu BOM, tồn âm, sửa/tạm ngưng và danh sách; cập nhật form bản nháp GHR, lưu báo cáo `inventory-techres-warehouse-settings-audit.md`; không tạo hoặc sửa dữ liệu Techres |
| 2026-08-24 | 3 | Nối Đơn vị tính và Danh mục NVL chỉ đọc | Thêm service/hook đọc `inventory_units` và `inventory_item_groups`, giao diện tìm kiếm/lọc/thống kê, xử lý thiếu schema/Data API grant/RLS; chưa mở CRUD hoặc mutation production |
| 2026-08-24 | 3 | Nối Nhà cung cấp và Nguyên vật liệu chỉ đọc | Đọc `inventory_suppliers` và `inventory_items`; Nguyên vật liệu dùng quan hệ khóa ngoại để lấy nhóm/đơn vị, có tìm kiếm/lọc/thống kê; chưa mở CRUD hoặc mutation production |
| 2026-08-24 | 3 | Harden quyền và hợp đồng loại kho | Cho Admin hệ thống đang hoạt động khởi tạo quản trị Kho, không nâng quyền admin theo một kho; bỏ loại kho trung chuyển lệch schema vì trạng thái vận chuyển thuộc phiếu chuyển |
| 2026-08-24 | 3 | Kiểm thử lại trên schema-only production | Phase 1 + Phase 3 + test hành vi + postcheck chỉ đọc đều đạt trên PostgreSQL 17 tách biệt; lint không có lỗi/cảnh báo thuộc `inventory_*` |
| 2026-08-24 | Tổng | Cập nhật tiến độ hardening Phase 3 | Khoảng 33% toàn lộ trình trước pilot; Phase 3 khoảng 90%; production readiness vẫn 0% vì còn migration history drift và chưa có phê duyệt triển khai |
| 2026-08-24 | 3 | Hoàn thiện CRUD dữ liệu nền | Thêm form tạo/sửa/lưu trữ mềm cho Kho, NVL, Danh mục NVL, Đơn vị tính và Nhà cung cấp; service/hook tách riêng, kiểm tra mã, đơn vị và tỷ lệ quy đổi |
| 2026-08-24 | 3 | Thêm mã khu và khóa ghi riêng | Bổ sung `department_code` có chuẩn hóa/unique theo chi nhánh cho BOM; bản build/deploy cần cả cờ Supabase chung và cờ Kho. Vite local có thể chỉ mở cờ Kho cho smoke có phạm vi, vẫn qua Admin Auth/RLS |
| 2026-08-24 | 3 | Kiểm thử CRUD và giao diện sạch | 15/15 test frontend đạt; Data API role `authenticated` tạo/update/soft-delete đạt và DELETE vật lý bị chặn; ESLint, encoding, build và trình duyệt local không có lỗi |
| 2026-08-24 | Tổng | Cập nhật tiến độ hoàn thiện code Phase 3 | Khoảng 34% toàn lộ trình trước pilot; Phase 3 khoảng 95%; còn triển khai production, cấp quyền và smoke test sau phê duyệt riêng |
| 2026-08-24 | 3 | Hoàn thiện luồng sửa Kho | Thêm sửa thông tin kho trên nhánh Admin mới, giữ ổn định mã kho, cho cấu hình kho mặc định chi nhánh và không mở ghi production; 16/16 test, ESLint, encoding, build và lượt tải trình duyệt mới đều đạt |
| 2026-08-24 | Tổng | Cập nhật tiến độ sau luồng sửa Kho | Khoảng 34% toàn lộ trình trước pilot; Phase 3 khoảng 97%; phần code local đã hoàn chỉnh, còn triển khai production, cấp quyền và smoke test sau phê duyệt riêng |
| 2026-08-24 | 1/3 | Triển khai schema Kho production | Chuẩn hóa hai timestamp Loyalty sau khi hash local/remote khớp tuyệt đối; dry-run chỉ có hai migration Kho; Phase 1 và Phase 3 triển khai thành công, migration history khớp |
| 2026-08-24 | 1/3 | Postcheck production | Phase 1 và Phase 3 đạt; 14 bảng `inventory_*` rỗng; Security Advisor không có cảnh báo Kho; ghi giao diện tiếp tục tắt |
| 2026-08-24 | Tổng | Cập nhật tiến độ sau triển khai schema | Khoảng 36% toàn lộ trình trước pilot; Phase 3 khoảng 99%; production readiness khoảng 25%, còn cấp quyền và smoke test một chi nhánh |
| 2026-08-24 | 3 | Cấp quyền Admin Kho production | Cấp một quyền `admin` toàn hệ thống, `warehouse_id = null`, cho tài khoản Admin đang hoạt động; kiểm tra không trùng và RLS dưới role `authenticated` đạt; chưa tạo dữ liệu Kho |
| 2026-08-24 | Tổng | Cập nhật readiness sau cấp quyền | Phase 3 khoảng 99%; production readiness khoảng 35%; còn smoke test một chi nhánh và bật ghi có kiểm soát |
| 2026-08-24 | 3 | Mở ghi Kho có kiểm soát trên local Admin | Chỉ bật `VITE_ENABLE_INVENTORY_RUNTIME_WRITES=true` trong `.env` local và giữ cờ ghi Supabase toàn cục ở `false`; local vẫn bắt buộc phiên Admin/RLS. `.env.example` và bản deploy mặc định tắt Kho; nút Kho/NVL/Đơn vị tính chỉ mở khi đọc quyền thành công |
| 2026-08-24 | 3 | Chuyển bốn kho nháp thành dữ liệu production | Tạo idempotent Kho Tổng và ba kho CN 30/4/TQD/LHP; ba kho chi nhánh là kho mặc định, cùng trỏ kho cấp hàng về Kho Tổng; kiểm tra 4/4, không trùng mã; local tự dọn bản nháp trùng sau khi tải lại |
| 2026-08-24 | Tổng | Khép lại Phase 3 | 19/19 test Kho, ESLint phạm vi, UTF-8 và build đạt; Phase 3 100%, toàn lộ trình khoảng 37%, production readiness khoảng 50% |
| 2026-08-24 | 3/4 | Audit chi tiết form cài đặt Techres | Audit chỉ đọc build vRELEASE-78: Kho, Đơn vị tính, Danh mục NVL, tạo một/tạo hàng loạt NVL; xác nhận Nhà cung cấp chưa có và Mua hàng đang sắp ra mắt. Lưu báo cáo `inventory-techres-settings-forms-audit.md`; chưa sửa form hoặc schema GHR |
| 2026-08-24 | 3 | Hoàn thành P0 form cài đặt | Bổ sung đơn vị gốc/quy đổi, mô tả/thứ tự danh mục, Vật tư tiêu hao và mã NVL tự sinh; migration `20260824085831` lên production, test giao dịch tự rollback và postcheck đạt; 21/21 test, ESLint, UTF-8, build và kiểm tra ba form trên trình duyệt đều đạt |
| 2026-08-24 | 3 | Tạo dữ liệu nền chuẩn | Tạo idempotent 9 đơn vị (gram/kg, ml/lít, cái, gói, chai, hộp, phần) và 7 nhóm NVL; kiểm tra qua Admin/RLS đạt, form NVL chỉ nhận đơn vị gốc; NVL/chứng từ/movement vẫn bằng 0 |
| 2026-08-24 | 3/7 | Chốt nguồn cảnh báo tồn và hạn dùng | Form NVL lưu điểm đặt hàng, số lượng đặt, tồn min/max, hao hụt và cấu hình HSD; Phase 7 bắt buộc tính cảnh báo từ số dư/lô thật của Phase 4, không hiển thị dữ liệu giả hoặc cảnh báo chỉ để trang trí |
| 2026-08-24 | 4 | Mở giao diện bốn nghiệp vụ kho | Thêm danh sách và form gọn cho Phiếu nhập kho, Phiếu xuất kho, Chuyển kho nội bộ, Yêu cầu xuất kho; nối đọc/lưu nháp/gửi xử lý, hoàn tất an toàn cho phiếu nhập và xuất; không thêm VAT, công nợ hoặc ảnh chứng từ |
| 2026-08-24 | 4 | Kiểm tra giao diện và build | ESLint phạm vi, UTF-8 và build đạt; trình duyệt local xác nhận cả bốn route và form Phiếu nhập hiển thị đúng; không tạo chứng từ thử, không làm thay đổi tồn kho |
| 2026-08-25 | 4 | Hoàn thiện giao/nhận và duyệt yêu cầu | Chuyển kho có Giao hàng → Nhận hàng → Hoàn tất, yêu cầu xuất có Duyệt/Từ chối → Tạo phiếu chuyển → Khép yêu cầu; số lượng mặc định theo phiếu, chênh lệch bắt buộc lý do, toàn bộ thao tác gọi RPC idempotent hiện có |
| 2026-08-25 | 4 | Thêm màn chi tiết và đối chiếu phiếu | Cả bốn danh sách có nút Xem; chuyển kho và yêu cầu xuất hiện yêu cầu/duyệt/giao/nhận/chênh lệch/lý do cùng phiếu chuyển liên kết; chỉ đọc, không tạo dữ liệu thử hoặc thay đổi tồn |
| 2026-08-25 | 4 | Cho Admin tạo yêu cầu thay chi nhánh | Form yêu cầu chỉ chọn kho chi nhánh/bộ phận, hiển thị rõ chế độ tạo thay và ghi `request_origin=admin_on_behalf` cùng kho nhận vào metadata; giữ nguyên RLS/RPC, chưa tạo phiếu production khi chưa có NVL và số lượng |
| 2026-08-25 | 4 | Sửa quyền lưu dòng phiếu nháp | Frontend không còn gửi `base_quantity` khi tạo dòng chứng từ; cột này tiếp tục do engine tự tính lúc hoàn tất/giao hàng. Giữ nguyên grant/RLS production và tránh mở quyền ghi trực tiếp số lượng tồn quy đổi |
| 2026-08-25 | 4 | Thêm xóa phiếu nháp an toàn | Chỉ phiếu `draft` có nút Xóa và hộp xác nhận; RLS cho Admin xóa mọi bản nháp, tài khoản kho chỉ xóa bản nháp tự tạo; phiếu đã gửi/phát sinh tồn không thể xóa. Migration `20260825014136` đã lên production; ESLint, UTF-8 và build đạt |
| 2026-08-25 | 4 | Thêm badge yêu cầu chờ xử lý | Menu trái đếm trực tiếp phiếu yêu cầu xuất kho trạng thái `submitted` theo RLS; hiện số ở Yêu cầu xuất kho, nhóm Xuất nhập kho và Quản lý kho khi thu gọn; tự cập nhật sau thao tác, khi lấy lại focus và mỗi 60 giây |
| 2026-08-25 | 4 | Chuyển badge theo bước xử lý | Bổ sung badge Chuyển kho nội bộ cho các phiếu còn việc phải làm (`draft`, chờ giao, đang chuyển, chờ hoàn tất); badge yêu cầu chỉ giữ phiếu chờ duyệt, tránh đếm trùng sau khi đã sinh phiếu chuyển |
| 2026-08-25 | 4 | Rút gọn luồng chuyển kho cho nhân viên | Duyệt yêu cầu tự tạo và gửi phiếu chuyển; nhận đủ tự hoàn tất phiếu chuyển và khép yêu cầu. Nhận lệch vẫn dừng để Admin đối chiếu. Migration `20260825020441` đã lên production; hai test giao dịch tự rollback đạt và không để lại dữ liệu thử |
| 2026-08-25 | 4 | Thêm Phiếu hủy theo TechRes | Thêm danh sách, form nhập nhanh, chi tiết và route riêng trong Xuất nhập kho; lý do gồm Hư hỏng/Hết hạn/Lãng phí/Mất mát/Hao hụt. Tận dụng engine `waste` hiện có: lưu nháp không trừ tồn, hoàn tất mới trừ kho nguồn và ghi movement; test production chạy trong transaction rồi rollback, không để lại dữ liệu thử |
| 2026-08-25 | 4 | Cho phép nhiều lý do trong một Phiếu hủy | Lý do chung áp dụng mặc định cho mọi dòng; nhân viên chỉ đổi lý do tại món có nguyên nhân khác. Danh sách hiện `Nhiều lý do`, chi tiết hiện lý do từng món; dữ liệu dòng dùng trường `notes` sẵn có nên không đổi schema hoặc engine trừ tồn |
| 2026-08-25 | 4 | Khóa duyệt Phiếu hủy và thêm badge chờ | Chi nhánh chỉ tạo/gửi; chỉ `owner`, `admin`, `central_manager` được hoàn tất và trừ tồn. Menu trái đếm phiếu `waste/submitted`, tự cập nhật sau thao tác, focus và mỗi 60 giây. Migration `20260825035625` đã lên production; Admin được phép, `branch_manager` bị chặn và engine nội bộ không còn gọi trực tiếp được |
| 2026-08-25 | 4/7 | Hoàn thiện phiếu nhập mua và nền cảnh báo HSD | Form nhập mua bắt buộc nhà cung cấp, tự gợi ý mã lô/HSD theo cấu hình NVL, cho nhập ngày sản xuất và đơn giá; migration `20260825061925` tạo bảng lô có RLS và trigger transaction. Dry-run hợp lệ/thiếu HSD đều đạt, build + 4 test + ESLint + kiểm tra trình duyệt đạt; production chưa có phiếu nhập/lô thật sau triển khai |
| 2026-08-25 | 5 | Mở Sổ kho chỉ đọc | Nối movement, balance và chứng từ hiện có; lọc 30 ngày/kho/NVL, phân trang 50 dòng, liên kết về phiếu nguồn và tính tồn đầu–nhập–xuất–tồn cuối khi chọn một NVL. Test công thức, ESLint, UTF-8, build và kiểm tra trực tiếp dữ liệu Supabase đều đạt; không thêm schema, không ghi hoặc sửa tồn kho. |
| 2026-08-25 | 7 | Mở Báo cáo tồn kho hiện tại | Hiển thị số lượng tồn, giá vốn bình quân, giá trị tồn và trạng thái còn/sắp hết/hết theo kho × NVL; lọc kho/danh mục/trạng thái/tìm kiếm. Dữ liệu đọc trực tiếp balance theo RLS: tài khoản chi nhánh chỉ nhận kho được cấp quyền, Admin xem toàn hệ thống. Test công thức/quyền giao diện, ESLint, UTF-8, build và kiểm tra dữ liệu Supabase thật đều đạt; không đổi schema hoặc số tồn. |
| 2026-08-25 | 7 | Sửa hiển thị giá vốn theo đơn vị NVL | Balance tiếp tục lưu bằng đơn vị gốc; báo cáo quy đổi đồng thời số lượng và giá vốn sang đơn vị hiển thị đã cấu hình. Kiểm tra production: `1.000 Gram × 30đ/Gram` được trình bày thành `1 Kilôgam × 30.000đ/Kg`, tổng giá trị vẫn 30.000đ; không sửa dữ liệu hoặc công thức giá trị tồn. |
| 2026-08-25 | 5 | Mở giao diện kiểm kê kho | Thêm tạo đợt kiểm toàn bộ NVL theo kho, nhập số đếm, gửi duyệt, đối chiếu chênh lệch theo đơn vị hiển thị, bắt buộc lý do và duyệt hoàn tất qua các RPC kiểm kê hiện có. Test công thức kg/gram, ESLint, UTF-8 và build đạt; chưa tạo chứng từ kiểm kê thử trên production. |
| 2026-08-25 | 5 | Thêm Phiếu điều chỉnh tồn thủ công | Thêm route/menu/badge, form gọn theo đơn vị lưu kho, lý do bắt buộc và tăng/giảm từng dòng. Migration `20260825075132` đã lên production; RPC duyệt nguyên tử chỉ cho owner/admin hoặc quản lý đúng kho, chặn tồn âm, ghi movement/balance đúng một lần. Build, ESLint, RLS/grant postcheck và kiểm tra trình duyệt đạt; không tạo phiếu thử hoặc thay đổi tồn. |
