# GHR Admin UI/UX Audit & Roadmap

> Tài liệu định hướng chính thức cho giao diện quản trị GHR.
>
> Cập nhật gần nhất: 14/08/2026.

## 1. Mục tiêu

Xây dựng giao diện quản trị GHR đồng bộ, rõ ràng và dễ mở rộng trên PC, tablet và mobile mà không làm thay đổi logic nghiệp vụ hoặc nguồn dữ liệu hiện có.

Mỗi thay đổi UI quản trị sau này cần đọc và bám theo tài liệu này trước khi triển khai.

## 2. Kết luận audit tổng quan

TechRes có độ đồng bộ cao hơn vì dùng lặp lại một hệ thống rõ ràng cho:

- Điều hướng và phân nhóm chức năng.
- Page Header, bộ lọc và hành động chính.
- Card, bảng, tab, badge và trạng thái rỗng.
- Font chữ, độ đậm, khoảng cách và bo góc.
- Liên kết từ Dashboard sang báo cáo chuyên sâu.

GHR có lợi thế về:

- Nhận diện thương hiệu màu cam rõ ràng, nổi bật và phù hợp ngành F&B.
- Dữ liệu sát vận hành thực tế của quán.
- “Thực thu cuối ngày” phù hợp nhu cầu đối soát.
- Tách app đối tác và kênh của quán dễ hiểu.
- Trạng thái đơn hàng thiết thực.
- Biểu đồ doanh thu có insight và so sánh kỳ.
- Hiển thị độ mới và trạng thái nguồn dữ liệu rõ.

Vấn đề chính của GHR không nằm ở tính năng mà nằm ở việc nhiều màn hình chưa dùng chung một ngôn ngữ thiết kế.

## 3. Các vấn đề đã phát hiện

### 3.1. CSS bị phân mảnh

Phần quản trị đang sử dụng đồng thời nhiều lớp CSS:

- CSS token và component dùng chung.
- CSS legacy.
- CSS overrides.
- CSS polish.
- CSS riêng theo từng trang.
- CSS riêng cho control và responsive.

Hệ quả:

- Một component có thể bị ghi đè qua nhiều file.
- Card, nút và bộ lọc trông khác nhau giữa các trang.
- Sửa một trang dễ tạo sai lệch ở trang khác.
- Khó xác định đâu là style nguồn chính.

### 3.2. Typography chưa thống nhất

GHR đang sử dụng quá nhiều mức font-weight như 650, 750, 850, 900 và 950.

Hệ quả:

- Quá nhiều nội dung cùng muốn nổi bật.
- Giao diện có cảm giác nặng.
- Phân cấp tiêu đề, nhãn và số liệu chưa rõ.

### 3.3. Card và bề mặt chưa đồng bộ

Hiện có nhiều kiểu:

- Card nền màu toàn bộ.
- Card chỉ có viền màu phía trên.
- Card có bóng và card phẳng.
- Nhiều mức bo góc khác nhau.
- Mỗi trang dùng cách đặt tiêu đề và hành động khác nhau.

### 3.4. Page Header và Toolbar khác nhau giữa các trang

- Dashboard dùng command bar riêng.
- Menu có Page Header và thêm một tiêu đề thứ hai.
- CRM bắt đầu bằng tab và bộ lọc.
- Một số trang đặt hành động chính trong nội dung, một số đặt trên header.

### 3.5. Dashboard còn dài và có nội dung trùng

- “Món bán chạy” và “Top món bán chạy” trả lời gần cùng một câu hỏi.
- Một số báo cáo chi tiết đang nằm trực tiếp trên Dashboard.
- Traffic website có mức ưu tiên cao hơn cần thiết.
- Các phần phân tích chuyên sâu nên chuyển về đúng module.

### 3.6. Điều hướng còn thừa cấp

Nhóm chỉ có một mục như:

```text
Tổng quan
└── Dashboard
```

không cần mở thêm một cấp. Nhóm có từ hai chức năng trở lên mới nên dùng accordion.

## 4. Nguyên tắc thiết kế GHR Admin Design System V1

### 4.1. Tính cách giao diện

- Thực tế, rõ ràng và đáng tin cậy.
- Mang nhận diện GHR nhưng không lạm dụng màu cam.
- Ưu tiên số liệu và hành động hơn trang trí.
- Mật độ vừa phải, phù hợp vận hành F&B.
- Mọi trạng thái phải dễ hiểu với người không biết kỹ thuật.

### 4.2. Màu sắc

| Vai trò | Định hướng |
|---|---|
| Thương hiệu | Cam GHR `#F97316` |
| Hành động chính | Cam đậm `#EA580C` |
| Chữ chính | Xanh đen/slate đậm |
| Chữ phụ | Slate trung tính |
| Nền ứng dụng | Xám ấm rất nhạt |
| Bề mặt | Trắng |
| Thành công | Xanh lá |
| Cảnh báo | Vàng/cam |
| Nguy hiểm | Đỏ |
| Thông tin | Xanh dương |

Quy tắc:

- Cam GHR dùng cho logo và điểm nhận diện chính.
- Cam đậm dùng cho active state, focus và hành động chính.
- Màu trạng thái không thay đổi toàn bộ cấu trúc component.
- Không dùng nhiều màu chỉ để trang trí.

### 4.3. Typography

Chỉ dùng các mức chính:

| Vai trò | Cỡ đề xuất | Độ đậm |
|---|---:|---:|
| Page title | 22–24px | 700–800 |
| Section title | 16–18px | 700 |
| Nội dung | 13–14px | 400–500 |
| Nhãn phụ | 11–12px | 500–600 |
| Số KPI | 24–34px | 700–800 |

Không tiếp tục thêm các mức 850, 900 hoặc 950 mới nếu không có lý do đặc biệt.

Số liệu cần dùng `font-variant-numeric: tabular-nums`.

### 4.4. Bo góc

Chỉ dùng ba mức:

- 8px: input, button nhỏ, badge vuông.
- 12px: card con, bảng, control group.
- 16px: panel và card lớn.

Badge trạng thái có thể dùng dạng pill.

### 4.5. Khoảng cách

Thang khoảng cách chuẩn:

```text
4px · 8px · 12px · 16px · 24px · 32px
```

Không dùng khoảng cách ngẫu nhiên ngoài thang này nếu không có yêu cầu bố cục đặc biệt.

### 4.6. Bóng và viền

- Card thông thường dùng viền mảnh, không bắt buộc có bóng.
- Chỉ panel nổi hoặc menu thả xuống mới dùng bóng rõ.
- Một trang không nên trộn quá nhiều cấp bóng.
- Viền phải dùng chung token thay vì hardcode riêng từng trang.

## 5. Bộ component chuẩn cần có

### 5.1. App Shell

- Sidebar.
- Topbar.
- Main content container.
- Mobile navigation.
- Trạng thái active và badge thông báo.

### 5.2. Page Header

Mọi trang dùng cùng cấu trúc:

```text
Tên trang + mô tả                  Hành động chính
Bộ lọc / tab / phạm vi chi nhánh
```

### 5.3. Card và Panel

- `AdminCard`
- `AdminPanel`
- `AdminStatCard`
- `AdminAlertStrip`
- `AdminEmptyState`
- `AdminLoadingState`
- `AdminErrorState`

Mỗi component chỉ có một cấu trúc chính và một số biến thể được kiểm soát.

### 5.4. Form và control

- Button.
- Icon button.
- Input.
- Select.
- Search input.
- Filter bar.
- Tabs.
- Switch.
- Date range.

### 5.5. Dữ liệu

- Data table trên PC.
- Data list/card trên mobile.
- Pagination.
- Badge trạng thái.
- Tooltip và chú thích nguồn dữ liệu.

## 6. Kiến trúc thông tin đã chốt

```text
Tổng quan
├── Dashboard
├── Cảnh báo vận hành (khi có trang chuyên sâu)
└── Hoạt động hệ thống (khi có audit log đầy đủ)

Bán hàng & vận hành
├── Đơn hàng
├── Tổng quan ca
├── Bánh sinh nhật
├── Đánh giá đối tác
└── Thưởng điểm đánh giá

Khách hàng & marketing
├── Khách hàng / CRM
├── Loyalty
├── Chương trình khuyến mãi
├── Hiệu quả website
└── Hiệu quả Marketing Grab

Cửa hàng & kênh bán
├── Menu
│   └── Hiệu quả món bán
├── Quản lý chi nhánh
└── Quản lý giao diện

Tài chính & báo cáo
└── Tài chính Grab

Nhân sự & giám sát
├── Quản lý nhân sự
└── Quản lý giám sát

Thiết lập hệ thống
├── Tài khoản chi nhánh
├── Cấu hình Zalo
└── File APK POS
```

Không tạo menu hoặc trang rỗng chỉ để giống TechRes. Chỉ mở mục mới khi có chức năng thật.

## 7. Quy tắc riêng cho Dashboard

Dashboard phải trả lời trong khoảng 30 giây:

1. Hôm nay thực thu bao nhiêu?
2. Tốt hay xấu hơn kỳ trước?
3. Có vấn đề nào cần xử lý ngay?
4. Chi nhánh, kênh hoặc món nào đang đóng góp chính?

Thứ tự đề xuất:

1. Phạm vi chi nhánh, thời gian và độ mới dữ liệu.
2. Thực thu, tổng đơn, đơn trung bình, tỷ lệ hoàn tất.
3. Trạng thái vận hành.
4. Cảnh báo dạng thanh gọn.
5. Xu hướng doanh thu và insight.
6. Hiệu suất chi nhánh.
7. Cơ cấu kênh bán.
8. Một bảng món bán chạy duy nhất.
9. Hiệu quả website ở mức phụ.

Không đặt trực tiếp trên Dashboard:

- Danh sách hoạt động chỉ gồm các đơn mới nhất.
- Danh sách món bán chậm 30 ngày.
- Báo cáo menu hoặc CRM chuyên sâu.
- Bảng dữ liệu dài có thể xem ở module riêng.

## 8. Quy tắc insight và số liệu

- Luôn so sánh cùng khoảng thời gian, cùng giờ và cùng chi nhánh.
- Kỳ có hôm nay phải ghi `Tạm tính đến HH:mm`.
- Không gọi attributed sales hoặc ROAS là lợi nhuận.
- Không kết luận món bán ít là món kém nếu chưa xét thời gian mở bán, mùa vụ và lợi nhuận.
- Insight phải giải thích được nguyên nhân, không chỉ lặp lại số liệu.
- Luôn cho người dùng biết dữ liệu lấy từ đâu và cập nhật lúc nào khi cần thiết.

## 9. Responsive

### Mobile — dưới 768px

- Sidebar chuyển thành drawer hoặc menu gọn.
- Nội dung một cột.
- KPI tối đa hai cột nếu còn đọc được.
- Bảng chuyển thành card/list.
- Bộ lọc dài dùng thanh cuộn ngang hoặc bottom sheet.
- Vùng chạm tối thiểu khoảng 40–44px.
- Không để text hoặc số tiền tràn màn hình.

### Tablet — 768px đến 1199px

- Nội dung một hoặc hai cột tùy độ phức tạp.
- Sidebar có thể thu gọn.
- Toolbar được phép xuống dòng có kiểm soát.

### PC — từ 1200px

- Container có giới hạn chiều rộng hợp lý.
- Không kéo card quá rộng làm khó đọc.
- Hai hoặc ba cột chỉ dùng khi nội dung liên quan và đủ không gian.

## 10. Accessibility và trạng thái tương tác

- Mọi button, input và tab phải có focus visible.
- Không chỉ dùng màu để truyền đạt trạng thái.
- Icon quan trọng phải có nhãn hoặc text đi kèm.
- Loading phải giữ gần đúng cấu trúc nội dung.
- Empty state giải thích được lý do và bước tiếp theo.
- Error state phải hướng dẫn người dùng cách xử lý.
- Tránh button hoặc link không có tác dụng.
- Tôn trọng `prefers-reduced-motion` khi thêm animation.

## 11. Lộ trình triển khai

### Giai đoạn 1 — Nền tảng UI

- [x] Rà soát và chốt token màu, typography, radius, shadow chính thức.
- [ ] Chuẩn hóa App Shell.
- [ ] Chuẩn hóa Page Header.
- [ ] Chuẩn hóa Button, Input, Select và Tabs.
- [ ] Chuẩn hóa Card, Panel và Stat Card.
- [ ] Chuẩn hóa Filter Bar.
- [ ] Chuẩn hóa loading, empty, error và alert.
- [ ] Xác định CSS legacy nào còn được sử dụng.
- [ ] Không thêm override mới nếu có thể sửa từ primitive.

### Giai đoạn 2 — Chuyển các trang ưu tiên

- [ ] Dashboard.
- [ ] Đơn hàng.
- [ ] CRM.
- [ ] Menu.
- [ ] Khuyến mãi.
- [ ] Tài chính.
- [ ] Thiết lập hệ thống.
- [ ] Nhân sự và giám sát.

### Giai đoạn 3 — Responsive và accessibility

- [ ] Kiểm tra PC 1366px và màn hình lớn.
- [ ] Kiểm tra tablet.
- [ ] Kiểm tra mobile 375px và 430px.
- [ ] Kiểm tra bàn phím và focus.
- [ ] Kiểm tra nội dung dài và số tiền lớn.
- [ ] Kiểm tra loading, empty và error.
- [ ] Kiểm tra tiếng Việt và font.

### Giai đoạn 4 — Dọn CSS legacy

- [ ] Lập danh sách selector đang dùng.
- [ ] Di chuyển trang đã chuẩn hóa sang component/token chung.
- [ ] Xóa override không còn cần thiết theo từng nhóm nhỏ.
- [ ] Không xóa hàng loạt khi chưa kiểm tra tất cả route liên quan.

## 12. Trạng thái các thay đổi gần đây

- [x] Sắp xếp menu quản trị theo nhóm nghiệp vụ.
- [x] Dashboard có biểu đồ doanh thu dạng cột.
- [x] Biểu đồ có Doanh thu, Số đơn và Đơn trung bình.
- [x] Biểu đồ hiển thị thứ trong tuần và insight ngày bán tốt.
- [x] So sánh biểu đồ dùng cùng phạm vi và cùng thời điểm.
- [x] Cảnh báo vận hành được thu thành thanh gọn.
- [x] Hoạt động gần đây được bỏ khỏi Dashboard.
- [x] Món bán chậm được chuyển sang Menu → Hiệu quả món bán.
- [ ] Xóa phần món bán chạy bị lặp trên Dashboard.
- [ ] Đưa Hiệu quả website xuống mức ưu tiên phụ.
- [ ] Chuẩn hóa toàn bộ card Dashboard theo Design System V1.
- [x] Dashboard chỉ còn một bảng món bán chạy, không lặp dữ liệu số lượng.
- [x] Hiệu quả website được chuyển xuống cuối trang ở mức thông tin tham khảo.
- [x] Biểu đồ doanh thu được ưu tiên toàn chiều rộng trước các phân tích hỗ trợ.
- [x] Header Dashboard có câu chào, mô tả phạm vi và bộ chọn chi nhánh dạng xổ gọn.

## 13. Checklist bắt buộc trước khi hoàn thành một trang

### UI

- [ ] Dùng token và component chung.
- [ ] Không tạo thêm màu, radius hoặc shadow tùy ý.
- [ ] Page Header đúng cấu trúc.
- [ ] Hành động chính rõ ràng.
- [ ] Không có nội dung trùng.
- [ ] Không có card chỉ để lấp khoảng trống.

### UX

- [ ] Người dùng biết đang ở đâu.
- [ ] Người dùng biết dữ liệu thuộc kỳ và chi nhánh nào.
- [ ] Empty state có hướng dẫn.
- [ ] Error state có cách xử lý.
- [ ] Hành động nguy hiểm có xác nhận phù hợp.

### Responsive

- [ ] PC không kéo nội dung quá rộng.
- [ ] Tablet không vỡ toolbar.
- [ ] Mobile không tràn ngang.
- [ ] Bảng có phương án hiển thị mobile.
- [ ] Nút đủ lớn để chạm.

### Kỹ thuật

- [ ] Giữ nguyên luồng UI → hook → service → repository → Supabase.
- [ ] Không gọi Supabase trực tiếp trong component.
- [ ] Không thay đổi logic ngoài phạm vi.
- [ ] Không làm yếu RLS.
- [ ] Không làm mất dữ liệu hoặc cấu hình cũ.
- [ ] Kiểm tra UTF-8 tiếng Việt.
- [ ] Chạy `npm run build`.

## 14. Quy trình cập nhật tài liệu

Sau mỗi giai đoạn:

1. Đánh dấu checklist đã hoàn thành.
2. Ghi ngắn gọn quyết định mới nếu có.
3. Cập nhật danh sách component chuẩn.
4. Ghi lại phần legacy đã loại bỏ.
5. Không thay đổi nguyên tắc cốt lõi nếu chưa có lý do và đánh giá ảnh hưởng.

Tài liệu này là nguồn tham chiếu chính cho mọi thay đổi UI/UX của khu vực quản trị GHR.
