# Gánh Reply — tạm ngừng

Theo yêu cầu chủ dự án, Gánh Reply đã được gỡ khỏi admin: không còn mục điều hướng, giao diện, hook, service, truy vấn quyền hoặc bộ kiểm thử riêng.

Cấu hình `ai_module_settings.enabled` được tắt. Hai Edge Function cũ trả HTTP 410 `MODULE_DISABLED`, không gọi OpenAI hoặc truy cập dữ liệu. Không cần biến `VITE_ENABLE_GANH_REPLY` nữa.

Giữ nguyên lịch sử và các bảng có RLS để có thể khôi phục khi cần; không xóa dữ liệu hoặc API key dùng chung. SQL tạo bảng và xác minh được giữ trong `docs/supabase-sql` làm lịch sử triển khai. Mã chức năng đầy đủ có trong Git trước commit gỡ bỏ.
