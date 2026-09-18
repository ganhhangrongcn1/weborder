# Nhận diện món kho theo mã và tên đầy đủ

## Phạm vi

- Sửa nhầm món Grab “Xé Và Trộn Sẵn” thành “Tự Trộn”.
- Ưu tiên mã món đúng kênh; chỉ so tên khi một phía thiếu mã. Hai mã khác nhau không được ghép qua tên.
- Giữ đầy đủ hậu tố; chuẩn hóa Unicode NFC, hoa/thường và khoảng trắng.
- Giữ phạm vi chi nhánh Grab/Xanh Ngon và cơ chế ShopeeFood dùng chung. Cùng mức nhận diện thì ưu tiên cấu hình đúng chi nhánh; nếu vẫn nhiều kết quả, chặn thay vì chọn updated_at mới nhất.
- Không thay đổi lựa chọn/topping, công thức, POS, nhập/xuất/kiểm kê, hoàn tồn, công tắc trừ kho hoặc lô.
- Không chạy lại các đơn đã ghi kho, không sửa tồn lịch sử.

## Triển khai và kiểm tra

- Migration: `supabase/migrations/20260917235008_inventory_strict_item_mapping.sql`.
- Đã áp dụng Supabase ngày 18/09/2026 (giờ Việt Nam), kèm kiểm thử SQL trong cùng giao dịch triển khai.
- SQL test: `20260918_inventory_strict_item_mapping_test.sql`. Dữ liệu giả được rollback trong subtransaction; không tạo đơn hay chứng từ.
- 21 bài kiểm thử JS đạt; build và kiểm tra tiếng Việt đạt. Build chỉ cảnh báo kích thước bundle.
- Đọc lại hai đơn Grab C8EZGNDJABV1TT và C8EZGPATHBNBKE: bộ nhận diện mới trả đúng món Xé Và Trộn Sẵn/Tự Trộn theo từng dòng; chứng từ cũ giữ nguyên thời điểm xử lý.
- So sánh định nghĩa live trước/sau: processor chỉ thay đúng khối chọn ánh xạ món chính; candidate RPC chỉ thay nhóm nhận diện món.
- Hai helper mới là private, security invoker, search_path rỗng, thu hồi quyền PUBLIC/anon/authenticated. Security advisors không ghi nhận helper mới; các cảnh báo có sẵn ngoài phạm vi không chỉnh trong bản này.
- Frontend chỉ bỏ việc gộp hậu tố ở danh sách gán món, chưa push trong lượt sửa này.

## Lưu ý vận hành

Đơn chờ/chưa ghi kho dùng quy tắc mới khi được xử lý. Đơn completed không được phát lại. Chênh lệch lịch sử cần đối chiếu và phê duyệt riêng.

Tham khảo bảo mật hàm: https://supabase.com/docs/guides/database/functions
Kiểm tra cảnh báo search_path có sẵn: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
