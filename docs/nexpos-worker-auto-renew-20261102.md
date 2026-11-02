# Tự gia hạn enrollment WSS — 02/11/2026

Anh cho phép tự gia hạn worker đang vận hành. Giữ nguyên khóa, bốn HUB,
đường sync đơn/bill, chống in trùng và polling30giây; không tạo lịch giám sát.

## Cơ chế

- Tận dụng report đã xác thực bằng khóa worker trên broker v4. Trigger BEFORE
  UPDATE last_seen_at chỉ sửa cùng dòng, không tạo thêm request/job hay đọc phiên.
- Opt-in auto_renew_enabled mặc định false, chỉ bật vncloud-primary còn quyền.
- Khi còn tối đa4ngày, heartbeat mới, connected=true và còn quyền thì kéo
  expires_at lên7ngày từ hiện tại, lưu auto_renewed_at. Không ghi mỗi30giây.
- Không gia hạn nếu hết hạn, disabled, tắt sync/id_sync, opt-out, heartbeat cũ,
  đổi khóa/HUB hoặc đang chỉnh hạn thủ công. Không tự bật lại bất kỳ quyền nào.
- Worker offline quá hạn phải kiểm tra và cấp lại thủ công. Tắt auto-renew
  bằng auto_renew_enabled=false; thu hồi ngay bằng enabled=false hoặc expires_at
  về quá khứ. Những thao tác đó không bị trigger đảo lại.
- Đây là gia hạn enrollment, không thay khóa và không tự đăng nhập NexPOS.
  Phiên NexPOS hết hiệu lực vẫn đi qua cơ chế phiên hiện có.

## Kiểm tra và triển khai

Đã test rollback trên bảng clone trong schema nexpos_renew_test, không ghi
đơn/bill production: heartbeat khỏe gia hạn7ngày; lần tiếp theo không gia hạn
lại; 10 trường hợp bị chặn gồm expired/disabled/optout/sync_off/id_off/
disconnected/stale/token_change/hub_change/manual_expiry đều đạt.

Migration production20261102083645 đã áp dụng; anon/authenticated không có
quyền gọi function hoặc UPDATE bảng worker. Trigger security invoker,
search_path rỗng, không thay RLS. Encoding712file đạt; không sửa JS/website.
Security advisor có các cảnh báo cũ ngoài phạm vi, không liên quan function mới.
Heartbeat thật15:36:58 UTC+7 đã tự gia hạn thành công: auto_renewed_at
02/11/2026 15:36:58.545, expires_at09/11/2026 15:36:58.545 UTC+7.
Không giả lập report production. Phạm vi bốn HUB, connected=true và
polling30seconds không đổi. Không cần cập nhật/restart worker VPS hoặc APK.

## File

- supabase/migrations/20261102083645_nexpos_worker_auto_renew.sql
- scripts/nexpos-worker-auto-renew.test.sql
- docs/nexpos-worker-auto-renew-20261102.md
