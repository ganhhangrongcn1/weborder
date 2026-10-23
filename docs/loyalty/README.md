# Điểm và quà khách hàng

[Toàn bộ tài liệu](../README.md)

## Hướng dẫn và hợp đồng

- [Luồng điểm đang sử dụng](loyalty-runtime-source-of-truth.md)

## Báo cáo và lịch sử

Các mốc triển khai và kết quả kiểm tra là thông tin tại thời điểm báo cáo. Không chạy lại SQL hoặc bật tính năng chỉ dựa vào báo cáo cũ.

- [Gift / Quà Tháng / Đơn Thứ 3 Audit](reports/gift-order-counting-source-of-truth-audit.md)
- [Loyalty V2 — Phase 1: Audit và hợp đồng nghiệp vụ](reports/loyalty-v2-phase-1-contract.md)
- [Loyalty V2 - Phase 2: Database foundation](reports/loyalty-v2-phase-2-runbook.md)
- [Cập nhật tích tem và bill POS — 06/10/2026](reports/stamp-confirmation-receipt-2026-10-06.md)
- [Chương trình tích tem — bàn giao 05/10/2026](reports/stamp-program-rollout.md)
- [Ô tem trên bill — 06/10/2026](reports/stamp-receipt-circles.md)
- [Triển khai Supabase tích tem — 06/10/2026](reports/stamp-supabase-deployment-2026-10-06.md)

## Cách đọc

Ưu tiên tài liệu luồng điểm đang sử dụng cho RPC hiện hành. Quà tháng cũ và tích tem là hai chương trình riêng; báo cáo ngừng quà tháng không phải yêu cầu xóa dữ liệu hoặc RPC thống kê. Các báo cáo rollout tích tem giữ nguyên trạng thái tại thời điểm bàn giao.
