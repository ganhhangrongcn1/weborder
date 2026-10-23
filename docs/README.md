# Tài liệu dự án Gánh Hàng Rong

Điểm bắt đầu để tra cứu hướng dẫn, hợp đồng dữ liệu và báo cáo theo chức năng. Các đường dẫn mã nguồn viết trong dấu backtick được tính từ gốc repository.

## Trạng thái công việc

- [Công việc còn dang dở và việc cần xác minh](project-status.md) — đối chiếu mã nguồn ngày 22/10/2026.

## Tra cứu theo chức năng

- [Kiến trúc và nguồn dữ liệu](architecture/README.md)
- [Khách hàng và CRM](customers/README.md)
- [Điểm và quà khách hàng](loyalty/README.md)
- [Thanh toán và QR](payments/README.md)
- [POS](pos/README.md)
- [Tích hợp đối tác và bếp](integrations/README.md)
- [Kho](inventory/README.md)
- [Giám sát và nhân sự](checklist/README.md)
- [Giao diện quản trị](admin/README.md)
- [Vận hành Supabase](supabase/README.md)
- [SQL tham chiếu và kiểm tra](supabase-sql/README.md)
- [Báo cáo sắp xếp và bảng đường dẫn cũ mới](maintenance/documentation-cleanup-2026-10-22.md)

- [Báo cáo dọn mã nguồn cũ](maintenance/code-cleanup-2026-10-22.md)

- [Sửa lỗi smoke voucher và lint](maintenance/voucher-lint-fix-2026-10-22.md)

- [Dọn cảnh báo unused vars và kiểm tra JSX](maintenance/unused-vars-cleanup-2026-10-22.md)

## Quy tắc duy trì

- Đọc [AGENTS.md](../AGENTS.md) trước khi sửa mã nguồn.
- Dùng `.md` cho mọi hướng dẫn, báo cáo và mục lục mới để dễ review diff và đối chiếu lịch sử Git.
- Hướng dẫn và hợp đồng nằm trong thư mục chức năng; báo cáo từng đợt nằm trong `reports/` của chức năng đó.
- Báo cáo lịch sử giữ nguyên bằng chứng, thời điểm và giới hạn; không coi kết quả cũ là kiểm chứng production hiện tại.
- Tài liệu nguồn dữ liệu có cả lịch sử refactor; khi có khác biệt về RPC loyalty, đọc tài liệu [luồng điểm](loyalty/loyalty-runtime-source-of-truth.md) và đối chiếu code hiện tại.
- SQL tham chiếu giữ ở `docs/supabase-sql`; lịch sử migration giữ ở `supabase/migrations`. Không xóa hoặc chạy lại migration chỉ vì tên giống nhau.
- README sát mã nguồn được giữ tại ứng dụng/thư viện tương ứng. Không tạo bản sao hướng dẫn.
- Khi đổi tên hoặc di chuyển tài liệu, cập nhật liên kết và chạy `python3 scripts/check-doc-links.py`.
