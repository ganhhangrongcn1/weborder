# Tối ưu Supabase đợt 5 — 06/10/2026

## Kết quả đã áp dụng

Migration live: `20261006081552_fix_stub_profile_empty_name` trên weboder.

`upsert_customer_stub_profile(text,text,text,text)` bổ sung hồ sơ khách từ đơn đối tác. Cột `profiles.name` là NOT NULL và có mặc định chuỗi rỗng, nhưng hàm INSERT/UPDATE truyền NULL rõ ràng khi chưa có tên nên mặc định không được dùng.

Chỉ sửa hai biểu thức: INSERT dùng `coalesce(v_name, '')`; UPDATE dùng `coalesce(nullif(trim(coalesce(v_safe_name, '')), ''), '')`. Luồng tính v_safe_name giữ nguyên: ưu tiên tên thật hiện có, chỉ thay tên placeholder khi tên mới không rỗng. Không sửa công thức/luồng tích điểm, role guard, auth_user_id, registered, metadata, grants hoặc RLS.

## Kiểm chứng và kiểm tra chéo

- Catalog/thân hàm xác nhận trực tiếp đường lỗi NULL-name.
- Log 24 giờ ghi nhận 20 lỗi SQLSTATE 23502 có context hàm này. Chưa xác định cột của từng sự kiện, nên không quy cả 20 lỗi cho tên.
- 9 case chỉ đọc đạt: tên thiếu, rỗng, khoảng trắng, placeholder, tên thật; INSERT/UPDATE không NULL, tên thật được giữ khi đầu vào NULL/rỗng/khoảng trắng hoặc tên khác.
- RPC thật với phone NULL trong transaction read-only trả ok=false, created_new=false, không đi vào nhánh đọc/ghi hồ sơ.
- Sau triển khai: OID 16690, owner postgres, SECURITY DEFINER, VOLATILE, search_path=public và ACL giữ nguyên.
- Hash trước: fe0b53f8a2ef1bf6a1de19ded3724a82. Hash sau: 8a9027cc8e3e3e9aabc6873b22b5bc5e.
- Supabase AI xác nhận nguyên nhân. Nhận xét ban đầu của AI về nguy cơ mất tên thật được đối chiếu với v_safe_name; AI đã xác nhận lại rằng cảnh báo đó không áp dụng với luồng thực tế.
- Bốn thay đổi SQL trước được kiểm tra lại fingerprint và quyền, đúng phiên bản đã kiểm chứng.
- Build workspace đạt; encoding đạt 656 file, 5259 modules. Build bao gồm workspace hiện có, không đồng nghĩa toàn bộ thay đổi đang làm dở được phát hành.

## Giới hạn và hoàn tác

Chưa tạo/cập nhật hồ sơ khách thật để thử, chưa chứng minh lỗi biến mất dưới tải vận hành. Bộ case kiểm tra biểu thức, không thay thế kiểm thử end-to-end toàn RPC. Không thay đổi đường nhận đơn POS/Kitchen/checkout hoặc phát hành frontend/Android trong đợt này.

Backup hàm trước sửa nằm trong .local-backups (chỉ cục bộ). Migration có hash guard, lock_timeout 2s và statement_timeout 5s. Rollback đảo đúng hai biểu thức và dừng nếu phiên bản đã khác; không phục hồi toàn database.

## File mới

- supabase/migrations/20261006081552_fix_stub_profile_empty_name.sql
- docs/supabase-sql/2026-10-06-stub-profile-name-validation.sql
- docs/supabase-sql/2026-10-06-stub-profile-name-rollback.sql
- docs/supabase-optimization-phase5-2026-10-06.md
- docs/supabase-optimization-phase5-ai-2026-10-06.jpg (bằng chứng cục bộ, không đưa lên GitHub)

File cập nhật để lưu/replay an toàn trên Windows: migration customer count và dashboard, cùng hai rollback tương ứng, chỉ chuẩn hóa CRLF trong chuỗi SQL mới về LF. Không thay thêm hàm live.

Người dùng không cần chạy lại SQL, cài POS hoặc thao tác Vercel.
