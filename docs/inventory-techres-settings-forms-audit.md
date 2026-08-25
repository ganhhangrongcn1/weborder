# Audit form cài đặt Kho Techres và đối chiếu GHR

Ngày audit: 2026-08-24
Nguồn kiểm tra: ERP Techres tenant GHR, build `vRELEASE-78`
Phạm vi: chỉ đọc giao diện; không tạo, sửa, tạm ngưng hoặc xóa dữ liệu Techres.

## Kết luận nhanh

Nhóm **Xây dữ liệu** của Techres hiện có đúng bốn màn: **Kho**, **Nguyên vật liệu**, **Danh mục NVL** và **Đơn vị tính**. Không có màn Nhà cung cấp trong nhóm này; URL `/inventory/suppliers` trả 404 và mục **Mua hàng** đang ghi “Sắp ra mắt”.

GHR đã có đủ bốn màn tương ứng và có thêm Nhà cung cấp. Form Kho của GHR đã bám khá sát, thậm chí rõ hơn ở kho mặc định và mã khu BOM. Khoảng trống lớn nằm ở **mô hình đơn vị quy đổi** và **cấu hình chi tiết nguyên vật liệu**.

## 1. Form Kho

### Techres

Các trường chung:

- Tên kho: bắt buộc.
- Loại kho: bắt buộc.
- Địa chỉ: không bắt buộc.
- Bán trước, nhập hàng sau: công tắc cho phép tồn âm; khi tắt, thiếu hàng sẽ làm đơn không thể hoàn tất.

Bốn loại hiển thị:

| Loại | Tầng | Điều kiện và giải thích |
|---|---:|---|
| Kho trung tâm | 1 | Kho tổng nhận hàng nhà cung cấp và chuyển xuống chi nhánh; không chọn chi nhánh. |
| Kho chi nhánh | 2 | Bắt buộc chọn chi nhánh; là nơi trừ mặc định khi BOM không gán mã khu. |
| Kho bộ phận | 3 | Bắt buộc chọn chi nhánh và Mã khu; BOM chọn khu vực, hệ thống tìm kho cùng mã khu trong đúng chi nhánh. |
| Kho trung chuyển | Ngoài chuỗi | Techres ghi rõ chưa dùng tới vì phiếu chuyển đã có trạng thái đang vận chuyển. |

Logic đáng giữ:

- Mã khu nên đặt giống nhau giữa các chi nhánh cho cùng một bộ phận, ví dụ `BEP`, `BAR`.
- Danh sách có mã kho, tên, loại, chi nhánh, địa chỉ, cho phép tồn âm, trạng thái và thao tác.
- Menu thao tác có **Chỉnh sửa** và **Tạm ngưng**; không xóa vật lý.
- Nút tạo chỉ mở khi đủ tên và các trường điều kiện của loại kho.

### Đối chiếu GHR

GHR đã có:

- Tên, loại, chi nhánh, địa chỉ, tồn âm.
- Tên bộ phận và Mã khu cho kho bộ phận.
- Công tắc **Kho mặc định của chi nhánh**, giải thích rõ BOM chưa gắn mã khu sẽ trừ ở đâu.
- Sơ đồ Kho Tổng → Kho chi nhánh → Kho bộ phận.
- Lưu trữ mềm thay cho xóa vật lý.

Khác biệt có chủ đích:

- GHR dùng **Kho lưu động** thay cho “Kho trung chuyển”. Techres tự ghi kho trung chuyển chưa dùng; trạng thái đang vận chuyển nên thuộc phiếu chuyển, không nên tạo thành một kho thật.
- GHR đang dùng “Lưu trữ” thay cho “Tạm ngưng”. Nên đổi nhãn giao diện thành **Tạm ngưng** nhưng vẫn giữ cơ chế soft delete/status an toàn ở dữ liệu.

Mức bám Techres: **90%**.

## 2. Form Đơn vị tính

### Techres

Techres tách đơn vị Kho khỏi đơn vị món ăn trong Menu.

Trường chung:

- Tên đơn vị: bắt buộc, ví dụ Kg, Lít, Thùng, gram.
- Ký hiệu: không bắt buộc, ví dụ `kg`.
- Kiểu đơn vị:
  - **Đơn vị gốc**: kho lưu tồn trực tiếp bằng đơn vị này.
  - **Quy đổi về đơn vị khác**: khai câu `1 đơn vị này = hệ số × đơn vị nhỏ hơn`.
- Thứ tự hiển thị.

Khi chọn đơn vị quy đổi:

- Nhập hệ số.
- Chọn đơn vị gốc/đơn vị nhỏ hơn.
- Có các hệ số chọn nhanh: 1000, 100, 48, 30, 24, 12, 10, 6.
- Ví dụ vận hành: `1 Kg = 1000 gram`.

Logic cốt lõi:

- Tồn kho luôn quy về đơn vị gốc nhỏ nhất.
- Đơn vị quy đổi chỉ phục vụ hiển thị và nhập liệu.
- Bộ lọc danh sách: Tất cả, Gốc, Quy đổi.

### Đối chiếu GHR

GHR hiện có:

- Mã quản lý, tên đơn vị.
- Loại đo lường: đếm, khối lượng, thể tích, chiều dài, khác.
- Số chữ số thập phân.

Khoảng trống:

- Chưa có ký hiệu riêng.
- Chưa phân biệt đơn vị gốc và đơn vị quy đổi.
- Chưa có quan hệ đơn vị cha/gốc và hệ số quy đổi ngay tại form đơn vị.
- Chưa có thứ tự hiển thị và nút hệ số chọn nhanh.
- Tỷ lệ hiện đang gắn ở từng NVL qua “đơn vị mua”, nên có nguy cơ lặp lại cùng một quy đổi ở nhiều NVL.

Đề xuất: mở rộng schema đơn vị với `symbol`, `base_unit_id`, `conversion_factor`, `display_order`; giữ `unit_type` và `decimal_places` của GHR để kiểm soát dữ liệu tốt hơn Techres.

Mức bám Techres: **45%**.

## 3. Form Danh mục NVL

### Techres

Trường form:

- Tên danh mục: bắt buộc.
- Mô tả.
- Thứ tự hiển thị; số nhỏ hiện trước ở danh sách và ô chọn.

Techres giải thích rõ:

- Danh mục do người dùng tự đặt để phân nhóm tìm kiếm, ví dụ Đồ đông lạnh, Rau củ, Gia vị.
- Danh mục khác với **Loại NVL** cố định của hệ thống.
- Loại NVL quyết định tiền tố mã và cách xử lý trong sản xuất.

### Đối chiếu GHR

GHR hiện có:

- Mã quản lý bắt buộc.
- Tên danh mục bắt buộc.
- Trạng thái đang sử dụng/ngừng sử dụng.

Khoảng trống:

- Chưa có mô tả.
- Chưa có thứ tự hiển thị.
- Chưa có khối giải thích phân biệt Danh mục và Loại NVL ngay trên màn hình/form.

Đề xuất: giữ mã quản lý và trạng thái của GHR; bổ sung `description`, `display_order` và phần giải thích như Techres.

Mức bám Techres: **65%**.

## 4. Form Nguyên vật liệu

### Techres — tạo một NVL

Nhóm Thông tin cơ bản:

- Hình ảnh; dùng để nhận diện nhanh khi khai BOM và nhập/xuất.
- Tên NVL: bắt buộc.
- Loại NVL: Nguyên liệu, Bán thành phẩm, Thành phẩm, Bao bì, Vật tư tiêu hao.
- Đơn vị hiển thị: bắt buộc.
- Giá nhập tham chiếu: dùng điền sẵn đơn giá khi lập phiếu nhập.
- Hao hụt mặc định theo phần trăm: dùng cho sơ chế, bay hơi, rơi vãi và công thức.
- Danh mục NVL.
- Các đơn vị dùng thêm khi nhập/xuất, phụ thuộc đơn vị hiển thị.

Nhóm Cấu hình tồn kho:

- Điểm đặt hàng lại: trường duy nhất sinh cảnh báo; 0 nghĩa là không cảnh báo.
- Số lượng đặt hàng: gợi ý mua mỗi lần.
- Tồn tối thiểu: mức an toàn để đối chiếu.
- Tồn tối đa: tránh nhập dư/hư hỏng.

Nhóm Hạn sử dụng:

- Công tắc Hàng có hạn sử dụng.
- Khi tạo hàng loạt, số ngày HSD lớn hơn 0 tự đánh dấu hàng có hạn.

Quy tắc mã:

- Loại NVL quyết định tiền tố mã: `NVL`, `BTP`, `TP`, `BB`, `VT`.
- Người dùng không phải tự gõ mã trong form Techres.

### Techres — tạo nhiều cùng lúc

Form dạng bảng tính, mỗi dòng gồm:

- Tên NVL.
- Loại NVL.
- Đơn vị.
- Danh mục.
- Giá nhập.
- Điểm đặt hàng.
- Số lượng đặt hàng.
- Tồn tối thiểu.
- Tồn tối đa.
- Số ngày HSD.

Chỉ Tên và Đơn vị là bắt buộc; dòng trống tên bị bỏ qua. Có Thêm dòng và Thêm nhiều dòng.

### Đối chiếu GHR

GHR hiện có:

- Mã quản lý, tên, loại, danh mục.
- Đơn vị tồn, đơn vị mua và tỷ lệ quy đổi.
- Tồn tối thiểu, điểm đặt hàng.
- Ghi chú và trạng thái sử dụng.

Khoảng trống:

- Chưa có hình ảnh.
- Chưa có Vật tư tiêu hao; GHR đang dùng giá trị tổng quát “Khác”.
- Chưa tự sinh mã theo loại NVL.
- Chưa có giá nhập tham chiếu.
- Chưa có hao hụt mặc định.
- Chưa có số lượng đặt hàng và tồn tối đa.
- Chưa theo dõi hạn sử dụng/số ngày HSD.
- Chưa có nhiều đơn vị nhập/xuất theo hệ đơn vị chung.
- Chưa có tạo nhiều NVL dạng bảng.
- Chưa có tùy chọn cột danh sách.

Mức bám Techres: **50%**.

## 5. Nhà cung cấp

Techres build hiện tại không có form Nhà cung cấp trong Quản lý Kho. URL thử nghiệm trả 404; nhóm Mua hàng được đánh dấu sắp ra mắt.

GHR đã có form riêng gồm mã, tên, người liên hệ, điện thoại, email, địa chỉ và ghi chú thanh toán. Đây là phần mở rộng hợp lý để chuẩn bị Phase 4/Mua hàng, không phải phần sao chép từ Techres hiện tại.

## 6. Thứ tự cải tiến đề xuất

### P0 — cần trước khi nhập dữ liệu NVL thật

1. Nâng form Đơn vị tính thành mô hình đơn vị gốc/quy đổi.
2. Bổ sung mô tả và thứ tự hiển thị cho Danh mục NVL.
3. Tự sinh mã NVL theo loại, tránh bắt người dùng tự đặt mã thủ công.

### P1 — cần trước Phase 4 nhập hàng/cảnh báo

1. Giá nhập tham chiếu.
2. Số lượng đặt hàng và tồn tối đa.
3. Hao hụt mặc định.
4. Hạn sử dụng và số ngày HSD.

### P2 — tối ưu vận hành

1. Tạo nhiều NVL cùng lúc.
2. Hình ảnh NVL.
3. Tùy chọn cột danh sách.
4. Đổi nhãn “Lưu trữ” thành “Tạm ngưng” ở giao diện, giữ nguyên soft delete phía dữ liệu.

## 7. Quyết định kiến trúc

- Không bê nguyên giao diện Techres; chỉ lấy logic dễ hiểu và giải thích nghiệp vụ.
- Giữ cấu trúc GHR `UI → hook → service → Supabase`.
- Không thay đổi các bảng/luồng đang chạy khi chưa có migration bổ sung, audit RLS và kiểm thử riêng.
- Không tạo dữ liệu đơn vị/NVL thật trước khi chốt mô hình quy đổi; sửa sau khi đã phát sinh chứng từ sẽ khó và rủi ro hơn.

## 8. Trạng thái triển khai P0

Hoàn thành ngày 2026-08-24:

- Đơn vị tính có ký hiệu, đơn vị gốc/quy đổi, hệ số, thứ tự hiển thị và các hệ số chọn nhanh như Techres.
- Database chặn đơn vị tự quy đổi, quy đổi nhiều tầng và quy đổi khác loại đo lường; ví dụ kg chỉ được quy về đơn vị khối lượng.
- Danh mục NVL có mô tả, thứ tự hiển thị và phần giải thích phân biệt Danh mục với Loại NVL.
- Nguyên vật liệu có thêm Vật tư tiêu hao và tự sinh mã theo tiền tố `NVL`, `BTP`, `TP`, `BB`, `VT`.
- Form Nguyên vật liệu chỉ cho chọn đơn vị mua cùng hệ quy đổi và tự lấy tỷ lệ; không bắt người dùng gõ lại hệ số.
- Migration `20260824085831_inventory_phase3_p0_settings_forms.sql` đã triển khai production. Test giao dịch tự hoàn tác, postcheck quyền/RLS, 21 test frontend, ESLint phạm vi, UTF-8 và build production đều đạt.

P1 và P2 vẫn giữ nguyên trong lộ trình; chưa thêm giá nhập, hạn sử dụng, tạo nhiều hoặc hình ảnh ở lần này.
