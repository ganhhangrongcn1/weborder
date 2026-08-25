# Inventory Phase 3 — trạng thái sau triển khai schema

Ngày kiểm tra: 2026-08-24

## Phạm vi đã kiểm chứng

- Migration Phase 1 và Phase 3 được nạp trên PostgreSQL 17 tách biệt.
- Database kiểm thử dùng bản sao **schema-only** của production; không sao chép khách hàng, đơn hàng hoặc dữ liệu kinh doanh.
- Kho hỗ trợ: trung tâm, chi nhánh, bộ phận, lưu động và khác.
- Kho bộ phận có `department_code` riêng, chuẩn hóa chữ in hoa và duy nhất trong từng chi nhánh để BOM định tuyến ổn định.
- Kho chi nhánh/bộ phận bắt buộc gắn đúng chi nhánh; mỗi chi nhánh chỉ có một kho mặc định đang hoạt động.
- Xóa danh mục là lưu trữ mềm; vai trò `authenticated` không có quyền `DELETE` vật lý.
- Admin đang hoạt động của hệ thống có thể khởi tạo/quản trị Kho; quyền Admin gắn riêng một kho không trở thành Admin toàn hệ thống.
- Data API grant và RLS được kiểm tra riêng: grant quyết định bảng có thể được gọi, RLS quyết định dòng nào được phép xem/sửa.
- CRUD Admin đã có đầy đủ lớp UI → hook → service cho Kho, nguyên vật liệu, danh mục NVL, đơn vị tính và nhà cung cấp.
- Luồng sửa Kho giữ nguyên mã kho đã cấp, cập nhật đúng loại/phạm vi kho và cho phép chọn kho mặc định của chi nhánh; ràng buộc duy nhất vẫn do database bảo vệ.
- Trên bản build/deploy production, ghi dữ liệu Kho cần đồng thời cờ Supabase chung và cờ riêng của Kho. Riêng Vite local cho phép chỉ bật cờ Kho để smoke có phạm vi, vẫn bắt buộc đăng nhập Admin và RLS; cờ Supabase chung tiếp tục tắt để không mở ghi cho phân hệ khác.

## Bằng chứng local và production

- `20260824030247_inventory_phase1_engine.sql`: nạp thành công.
- `20260824060412_inventory_phase3_foundation.sql`: nạp thành công.
- `20260824085831_inventory_phase3_p0_settings_forms.sql`: triển khai production thành công; dry-run trước đó chỉ liệt kê đúng migration này.
- `20260824_inventory_phase3_foundation_test.sql`: đạt.
- `20260824_inventory_phase3_postcheck.sql`: đạt.
- Test Data API dưới role `authenticated`: tạo, cập nhật và soft-delete đạt; `DELETE` vật lý bị chặn.
- 21/21 test frontend, ESLint phạm vi, UTF-8 và build production đạt.
- Production đã ghi nhận ba migration `20260824030247`, `20260824060412` và `20260824085831`; Local/Remote migration history khớp.
- Postcheck production Phase 1 và Phase 3 đạt. Dữ liệu nền hiện có đúng bốn kho hoạt động và một quyền Admin Kho toàn hệ thống; các bảng chứng từ/tồn vẫn chưa phát sinh dữ liệu vận hành.
- Dữ liệu cài đặt đã có 9 đơn vị chuẩn và 7 danh mục NVL. Chưa tạo nguyên vật liệu thật vì cần định lượng vận hành; chứng từ, movement và số tồn vẫn bằng 0.
- Security Advisor không có cảnh báo `inventory_*`. Performance Advisor có 60 mức `INFO`: 51 index chưa được sử dụng do bảng vừa tạo và còn rỗng, 9 khóa ngoại audit chưa có index phủ; chưa có cảnh báo mức cao chặn pilot.
- Tài khoản Admin đang hoạt động đã được cấp đúng một quyền `admin` toàn hệ thống (`warehouse_id = null`); giả lập role `authenticated` xác nhận `private.inventory_is_admin()` và quyền đọc RLS hoạt động.

## Trạng thái triển khai production

Hai file Loyalty đã được chuẩn hóa timestamp local theo đúng lịch sử production sau khi hash nội dung khớp tuyệt đối:

- `20260815012613_allow_configurable_loyalty_redemption_percent.sql`.
- `20260815012832_use_active_loyalty_redemption_percent_for_orders.sql`.

Dry-run sau chuẩn hóa chỉ liệt kê hai migration Kho. Lần chạy đầu dừng ở statement 0 vì BOM UTF-8, chưa thay đổi production; BOM được loại bỏ và lượt triển khai kế tiếp hoàn tất cả hai migration.

## Trình tự triển khai đề xuất

1. Hai migration Kho Phase 1 và Phase 3: hoàn thành.
2. Migration P0 form cài đặt: hoàn thành; postcheck và test giao dịch tự hoàn tác đạt.
3. Postcheck, migration history và Security Advisor: hoàn thành.
4. Cấp quyền Kho cho một tài khoản Admin thử nghiệm: hoàn thành.
5. Tạo có kiểm soát một kho tổng và ba kho chi nhánh mặc định: hoàn thành; cả ba kho chi nhánh trỏ đúng kho cấp hàng, không trùng mã.
6. Mở ghi riêng trên local Admin cho dữ liệu nền: hoàn thành; cờ ghi Supabase toàn cục vẫn tắt, phiên Admin/RLS vẫn bắt buộc, cấu hình mẫu và bản deploy production mặc định tắt Kho.
7. Chạy smoke test một chi nhánh: chưa thực hiện.
8. Chỉ bật ghi dữ liệu từ Admin sau khi bước còn lại đạt.

Schema, quyền Admin và bốn kho nền đã được triển khai theo các lần phê duyệt ngày 2026-08-24. Ghi dữ liệu Kho hiện chỉ được mở ở local Admin; chưa mở cờ này trên bản deploy production và chưa cho phép chứng từ làm thay đổi tồn kho thật.
