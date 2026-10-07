# Đợt 13: giảm tải nền Admin và kiểm kê file

## Thay đổi đã kiểm tra tại máy

`src/pages/admin/AdminApp.jsx` dùng scheduler `foregroundRefreshService` sẵn có cho số thông báo Kho. Trước sửa: mỗi 60 giây gọi 7 hàm đọc kể cả tab ẩn; stock attention gồm 3 truy vấn, lot attention gồm 2 truy vấn. Sau sửa: tự tải chỉ khi tab hiện và online, focus/online/visibility tôn trọng độ mới 60 giây, không chồng các lượt tự tải, cleanup khi đổi kho/unmount. Lỗi trả false để scheduler thử lại sau 30 giây và giữ số gần nhất.

Giữ event cập nhật sau nghiệp vụ, bộ lọc kho, tất cả truy vấn và công thức. Event nghiệp vụ vẫn gọi trực tiếp như trước, có thể chồng với lượt tự tải; không tuyên bố đã gộp mọi request. Khi tab ẩn, số sidebar giữ giá trị trước đó; khi trở lại nếu quá hạn sẽ đọc mới. Không thay ghi kho, nhận đơn, thanh toán, tích điểm hoặc RLS.

5 ca trong `scripts/supabase-read-load.test.mjs` đạt (scheduler hidden/offline/resume/failure/cleanup và cache). Build đạt: 661 file qua kiểm tra encoding, 5264 modules; lint AdminApp và diff check đạt. Chưa triển khai production, chưa đo giảm CPU/latency thực tế.

## Kiểm kê Storage trực tiếp, chỉ đọc

| Bucket | File metadata | Bytes |
|---|---:|---:|
| app-downloads | 53 | 1160422097 |
| checklist-evidence | 42 | 31431569 |
| menu-images | 70 | 6284558 |
| review-reward-proofs | 8 | 2989972 |
| checklist-hr-documents | 0 | 0 |

Đây là tổng size từ metadata, không phải hóa đơn hay dung lượng vật lý được đo. Không đọc nội dung ảnh bằng chứng, không xuất dữ liệu khách.

Đối chiếu substring path nguyên văn và thay khoảng trắng bằng `%20` trong `app_configs.value`: APK 0.4.13 có 1 hàng cấu hình tham chiếu; 52 file khác không tìm thấy bằng cách này. Chưa tìm đủ mọi encoding/URL hoặc tham chiếu external. Đặc biệt `downloadService.js` vẫn có fallback `GHR VER 3.apk` dù file này không có reference trong app_configs. Vì vậy không được coi 52 file là rác đã chứng minh.

Giữ APK hiện hành, fallback, bản dự phòng và các file bằng chứng nghiệp vụ. Các APK lịch sử là nhóm ưu tiên rà tiếp vì chiếm phần lớn dung lượng, nhưng cần retention/link ngoài và backup có checksum trước xóa. Không xóa bảng backup, migrations, functions hoặc Storage metadata bằng SQL. Chưa xóa file nào.

## Kiểm tra chéo Supabase AI

Đã trao đổi tại chat F&B Read-Only Audit. AI phân biệt Storage, SQL snippets, migrations, backup tables và Edge Functions; không truy cập được Saved SQL Snippets qua công cụ inventory, truy vấn log Edge gặp lỗi backend nên không coi số liệu đó là bằng chứng. AI nhấn mạnh tuổi/tên file hoặc không có reference app_configs chưa đủ để xóa. Kiểm kê bucket ở trên do Codex kiểm chứng trực tiếp bằng SELECT, không coi câu trả lời AI là nguồn duy nhất.

AI đã review mô tả bản sửa: phạm vi hẹp, cần giữ một timer retry, không bù dồn lượt khi quay lại, không coi stop scheduler là hủy request đang chạy. Scheduler hiện có cùng cleanup/cancelled guard đáp ứng các giới hạn đó; chưa hủy request mạng đang chạy. AI chưa đọc diff độc lập. Ảnh bằng chứng cục bộ: `supabase-optimization-phase13-ai-2026-10-06.png`, không đưa lên GitHub. Ngày 07/10 đã xác minh không có tiến trình Git, khóa rỗng còn từ 06/10, sao lưu khóa rồi gỡ bằng quyền được duyệt. Chuẩn bị lưu đúng bốn file tối ưu/báo cáo trên nhánh riêng; không phát hành production.

Rollback frontend: hoàn nguyên đúng diff AdminApp của đợt này; không rollback các sửa khác. File mới: báo cáo này. File cập nhật: AdminApp.jsx.
