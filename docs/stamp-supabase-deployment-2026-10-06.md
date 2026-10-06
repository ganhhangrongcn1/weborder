# Triển khai Supabase tích tem — 06/10/2026

- Dự án: `weboder` / `qjaklysckgzdfjthzkzu`.
- Migration máy chủ: `20261006002739_stamp_program`.
- Nguồn SQL: `supabase/migrations/20261005085626_stamp_program.sql`. MCP ghi timestamp triển khai riêng; không chạy lại bằng cách đẩy toàn bộ migration local.
- Triển khai thành công; chương trình tắt, chưa chọn món, mốc bắt đầu null. Không backfill.
- Thêm 5 bảng private, 4 RPC và 6 trigger riêng. Các trigger cũ về voucher, điểm hạng, kho và mapping đối tác được giữ nguyên.

## Xác minh

- Bộ SQL local chạy lại: đạt.
- Trên database thật, tạo dữ liệu kiểm thử trong transaction rồi ROLLBACK: đơn thường khi tắt không tích; bật trong transaction để thử tích và retry; cùng ngày giữa POS/đối tác chỉ 1 tem; giữ 10 tem; retry không giữ lần hai; chốt quà 0đ; hủy trả tem; chặn chuyển khoản đơn 0đ. Deferred constraints đã được ép kiểm tra trước rollback.
- Payload kiểm thử đầu tiên thiếu các trường text bắt buộc nên thất bại và rollback; bổ sung đúng cấu trúc payload rồi toàn bộ kiểm thử đạt.
- Kiểm tra vai trò anon/authenticated: được xem cấu hình công khai, không được xem số dư/lịch sử khách hay lưu cấu hình khi thiếu quyền.
- Sau rollback: accounts/events/redemptions đều 0; không còn đơn `stamp-check-*`; chương trình vẫn tắt.
- Cả 5 bảng bật RLS, không cấp quyền đọc/ghi trực tiếp cho anon/authenticated; hàm private không cho hai vai trò gọi trực tiếp.
- Advisors: private tables không có policy là chủ ý chặn truy cập trực tiếp. Cảnh báo RPC SECURITY DEFINER được rà soát: summary không có SĐT trả cấu hình công khai; có SĐT bắt buộc kiểm tra chủ tài khoản/nhân viên; history và save kiểm tra quyền. Không thay các cảnh báo khác ngoài phạm vi.
- Tài liệu kiểm tra quyền: https://supabase.com/docs/guides/database/postgres/row-level-security
- Giải thích cảnh báo RLS không policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Còn lại trước khi dùng tại quán

Phát hành web, cài APK 0.4.12, chọn 3 món và bật trong Admin. Kiểm thử thực tế thanh toán/giấy in vẫn cần thực hiện tại quán; kiểm thử transaction không thay thế kiểm thử thiết bị.
