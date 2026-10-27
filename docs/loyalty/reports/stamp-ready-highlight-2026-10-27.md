# Làm nổi bật khách đủ tem nhận quà — 27/10/2026

- Chỉ khi có SĐT, số tem khả dụng >= 10, đã tải thành công: thẻ có viền/nền vàng ấm, số tem nổi bật và nút màu cam “Đổi quà ngay”. Ô thứ 10 thay dấu tick bằng hộp quà, rung nhẹ theo nhịp có khoảng nghỉ.
- `prefers-reduced-motion: reduce` tắt chuyển động. Khi tải lỗi, đang tải, chưa đăng nhập hoặc chưa đủ tem không hiện trạng thái sẵn sàng đổi.
- Giữ nguyên hành vi mở chọn quà/đi đến trang loyalty; không thay đổi dữ liệu, điều kiện, giữ/trừ/hoàn tem hoặc thanh toán.
- Kiểm tra trực quan bằng component thật với hook dữ liệu minh họa offline: 10 tem nổi bật, 9 tem giữ kiểu cũ, nút mở sheet đổi quà. Không kết nối Supabase hoặc tạo đơn trong bản xem thử.
- File cập nhật: `src/features/loyalty/components/StampCard.jsx`, `src/styles/stamp-card.css`. Ghi chú này là file mới; script xem thử tạm không đưa lên Git.
