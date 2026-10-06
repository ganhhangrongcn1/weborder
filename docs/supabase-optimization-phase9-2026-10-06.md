# Đợt 9 — tránh kết luận sai khi kiểm tra quyền

## Nguyên nhân và đã sửa

Script staging trước đây chấp nhận HTTP 401 là ca từ chối đạt. Một session hết hạn có thể khiến kết quả này bị hiểu nhầm là quyền RLS đúng. Script cũng chưa ngăn các actor dùng chung tài khoản và chưa kiểm tra seed trước các ca từ chối.

Đã sửa:

- Session phải có danh tính và còn hạn tối thiểu 60 giây; các actor dùng tài khoản riêng.
- Kiểm tra toàn bộ ca được phép đọc trước các ca từ chối để phát hiện fixture thiếu dữ liệu.
- HTTP 401, lỗi máy chủ, lỗi mạng không được tính là quyền chặn đúng. HTTP 403 chỉ chứng minh đường đọc bị từ chối, không xác định RLS hay grants gây ra.
- Chỉ gửi GET, có timeout 10 giây, chặn project production và service-role từ trước khi gọi mạng.
- Tách hàm kiểm tra để chạy bằng dữ liệu giả; không thay dữ liệu hoặc quyền production.

## Kiểm chứng

6 kiểm thử mới đạt: đường SELECT đúng; chặn production/service-role; thiếu seed; tài khoản dùng chung; token hết hạn; HTTP 401/500 không được tính là đạt. Cùng 6 kiểm thử diagnostics hiện có, tổng 12 ca đạt trong giả lập. JWT giả chỉ dùng trong mock, không gửi lên Supabase; server thật vẫn là nơi xác minh chữ ký và quyền.

Supabase connector xác nhận project `qjaklysckgzdfjthzkzu` hiện không có development branch. Chưa tạo nhánh mới hoặc phát sinh chi phí. Chưa chạy kiểm thử quyền trên môi trường thật; chưa kiểm thử hủy/hoàn tiền/hoàn điểm thật và chưa thay chính sách RLS. Build và UTF-8 được kiểm tra trên workspace hiện tại.

## File

- Cập nhật: `scripts/supabase-role-matrix.mjs`.
- Mới: `scripts/supabase-role-matrix.test.mjs`, báo cáo này.

## Bước tiếp theo

Cần xác định một Supabase staging riêng và fixture tổng hợp gồm khách A/B, nhân viên đúng/sai chi nhánh, bếp, admin trước khi chạy quyền thật. Sau đó mở rộng kiểm thử ghi/RPC và giao dịch điểm nguyên tử; script SELECT hiện tại không chứng minh những luồng này.

Tham khảo: [kiểm thử database Supabase](https://supabase.com/docs/guides/database/testing).
