# Luồng điểm đang sử dụng

Cập nhật: 31/07/2026

## Nguồn dữ liệu chuẩn

- Số dư hiện tại: `public.loyalty_accounts.total_points`.
- Lịch sử và căn cứ đối soát: `public.loyalty_ledger`.
- Trigger của ledger tự tính lại số dư. Không cập nhật trực tiếp số dư từ giao diện.
- Khách hàng được nhận diện bằng số điện thoại đã chuẩn hóa.

## Các luồng đang hoạt động

| Nghiệp vụ | RPC chuẩn | Ghi chú |
| --- | --- | --- |
| Cộng/trừ điểm theo đơn | `process_order_loyalty` | Dùng cho đơn web, POS và đơn đối tác |
| Hoàn tất đơn website | `complete_website_order_with_loyalty` | Hoàn tất đơn và xử lý điểm trong cùng giao dịch |
| Điểm danh | `process_loyalty_checkin` | Ghi ledger với loại `CHECKIN_V2` |
| Điều chỉnh thủ công | `admin_adjust_loyalty_points` | Chỉ admin đã đăng nhập |
| Thưởng ảnh đánh giá 5 sao | `approve_review_reward_claim` | Chỉ Edge Function service role; số điện thoại và điểm lấy từ yêu cầu đã khóa |

## Luồng thưởng đánh giá

1. Khách chọn một đơn đủ điều kiện và gửi một ảnh minh chứng.
2. Mỗi đơn chỉ tạo được một yêu cầu; mã ảnh cũng được chống gửi trùng.
3. Admin chỉ quyết định duyệt hoặc từ chối, không truyền số điểm tùy ý.
4. Khi duyệt, RPC khóa yêu cầu, ghi một dòng ledger có khóa `review-reward-{claim_id}`, rồi cập nhật trạng thái yêu cầu trong cùng giao dịch.
5. Trigger ledger tính lại số dư. Gọi lại cùng yêu cầu không cộng điểm lần hai.
6. Ảnh được đánh dấu xóa sau thời hạn cấu hình.

## Thành phần cũ

- `claim_partner_order_points`: đã ngừng dùng trong mã web hiện tại. Tạm giữ để không làm hỏng POS hoặc n8n phiên bản cũ chưa được kiểm kê đầy đủ. Không dùng cho tính năng mới.
- `CHECKIN`: chỉ là dữ liệu lịch sử. Luồng hiện tại ghi `CHECKIN_V2`; không xóa dữ liệu cũ vì ledger là sổ đối soát.
- `apply_loyalty_event` và `can_apply_loyalty_event`: không còn tồn tại trong cơ sở dữ liệu hiện tại.

Chỉ xóa RPC cũ sau khi kiểm tra log của tất cả POS, n8n và dịch vụ ngoài trong một khoảng vận hành an toàn.
