# Đợt 14: bảo vệ cache đơn Admin khi làm mới

## Bằng chứng và phương án

Rà source cho thấy `subscribeAdminOrderChanges` định nghĩa subscription trên bốn bảng nhưng không có caller trong `src` hiện tại. Không coi đây là subscription đang tạo tải; không sửa/xóa hàm hoặc thêm bộ lọc dựa trên phỏng đoán. Không chạm Kitchen/POS.

Lỗi thực tế trong `loadOrdersSnapshot`: clear cache xóa hai Map nhưng request cũ vẫn ghi cache khi hoàn tất; finally xóa entry theo key vô điều kiện. Nếu clear rồi có request mới, response cũ có thể ghi dữ liệu cũ hoặc xóa entry request mới, khiến caller tiếp theo tạo request trùng.

Sửa đúng cache hiện có: generation tăng khi clear toàn cache; mọi ghi base/alias web-only chỉ thực hiện khi generation còn khớp; finally chỉ xóa đúng Promise hiện hành. Giữ TTL 60 giây, key, queries, alias, bộ lọc, tham số và kết quả trả cho caller cũ. Không thay công thức doanh thu/điểm, dữ liệu DB hoặc quyền.

Phương án ưu tiên: sửa invalidation trước, sau đó mới đo tải ở các đường thực sự đang chạy. Không thêm index, filter Realtime theo quan hệ join hoặc giảm độ mới dữ liệu khi chưa có bằng chứng.

## Kiểm chứng và giới hạn

5 ca trong `scripts/admin-order-snapshot-cache.test.mjs` thực thi các hàm cache thật lấy từ source với network giả lập: old success không ghi cache/xóa request mới; old reject vẫn giữ dedupe; alias cũ không được seed; alias hiện hành và TTL giữ nguyên; date/item scopes riêng biệt. Cả 5 đạt.

Lint không lỗi, còn 2 cảnh báo biến branch chưa dùng có sẵn ngoài diff. Build đạt (661 file encoding, 5264 modules; 1 phút 39 giây). Chưa phát hành production. Không khẳng định giảm CPU/latency hoặc số request production.

Generation bảo vệ cache, không tự bảo vệ mọi state UI hoặc cô lập toàn cache theo session. Request cũ vẫn trả kết quả cho caller cũ như hợp đồng trước. Các effect hiện có giữ disposed guard; không tuyên bố mọi đường refresh thủ công đã có guard hoàn chỉnh.

Supabase AI đã review mô tả: ưu tiên sửa race, yêu cầu guard cho cả alias, clear in-flight, finally kiểm tra Promise và phân biệt cache guard với UI guard. Không chạy SQL hoặc thay Realtime/quyền trong đợt này.

File cập nhật: `src/pages/admin/state/useAdminOrderCrmState.js`. File mới: test và báo cáo này. Rollback: hoàn nguyên đúng 8 dòng diff của hook, giữ các tối ưu khác. Dọn Storage chưa xóa file nào; tách khỏi thay đổi này.
