# Audit logic cài đặt Kho Techres

Ngày audit: 2026-08-24
Phạm vi: `/inventory/warehouses`, form tạo/sửa kho, sơ đồ và danh sách
Phương pháp: quan sát chỉ đọc trên tenant GHR; không tạo, cập nhật hoặc tạm ngưng kho.

## 1. Bốn loại kho

| Loại | Tầng | Bắt buộc chi nhánh | Logic vận hành quan sát được |
|---|---:|---|---|
| Kho trung tâm | 1 | Không | Nhận hàng nhà cung cấp và chuyển hàng nội bộ xuống chi nhánh. |
| Kho chi nhánh | 2 | Có | Điểm trừ tồn mặc định khi đơn hoàn tất và BOM không gán mã khu. |
| Kho bộ phận | 3 | Có | Trừ tồn theo mã khu mà BOM đã gán. |
| Kho trung chuyển | Ngoài chuỗi | Không | Không cần tạo quan hệ cha–con; trạng thái đang vận chuyển thuộc phiếu chuyển. |

Sơ đồ chỉ là cách trình bày chiều vận hành. Các kho vẫn là các bản ghi ngang hàng; không suy ra quan hệ cha–con từ vị trí trên sơ đồ.

## 2. Điều kiện form

- Tất cả loại kho bắt buộc `Tên kho`.
- Kho chi nhánh và kho bộ phận bắt buộc `Chi nhánh`.
- Kho bộ phận có thêm `Mã khu`, ví dụ `BEP`, `BAR`, `KHO_KHO`.
- Kho trung tâm và kho trung chuyển không hiển thị trường chi nhánh.
- `Địa chỉ` không bắt buộc.
- Mã kho không nhập thủ công; hệ thống sinh theo loại và thời điểm.
- Form sửa cho phép cập nhật tên, loại, chi nhánh theo loại, địa chỉ và cờ tồn âm.

## 3. Logic BOM và mã khu

- BOM chọn **mã khu**, không chọn trực tiếp một `warehouse_id`.
- Khi đơn hoàn tất, món không có mã khu đi tới kho chi nhánh mặc định.
- Món có mã khu đi tới kho bộ phận cùng mã thuộc đúng chi nhánh của đơn.
- Các chi nhánh nên dùng cùng mã cho cùng một bộ phận để một BOM dùng được toàn hệ thống.
- Kho bộ phận không có BOM nào tham chiếu mã khu sẽ trở thành kho không được tự động trừ.

## 4. Bán trước, nhập hàng sau

Đây là cờ cho phép tồn âm theo từng kho:

- Bật: đơn vẫn bán và trừ kho khi số tồn chưa đủ; tồn có thể xuống âm và được bù khi nhập hàng.
- Tắt: thiếu tồn có thể làm giao dịch hoàn tất đơn bị từ chối hoặc huỷ theo hợp đồng backend.

Cờ này phải được kiểm tra trong transaction hoàn tất chứng từ/đơn hàng; chỉ ẩn hoặc cảnh báo ở UI là không đủ.

## 5. Trạng thái và thao tác

- Danh sách hiển thị mã, tên, loại, chi nhánh, địa chỉ, cờ tồn âm và trạng thái.
- Kho đang hoạt động có thao tác `Chỉnh sửa` và `Tạm ngưng`.
- Không quan sát thấy thao tác xoá vật lý. GHR tiếp tục dùng lưu trữ mềm/tạm ngưng để giữ lịch sử chứng từ và movement.

## 6. Ánh xạ sang nhánh Kho mới của GHR

Đã áp dụng cho bản nháp local:

- Tự gán kho chi nhánh là điểm trừ mặc định; không cho người dùng bật/tắt tuỳ ý trong form tạo.
- Tách riêng `departmentCode` cho mã khu và chuẩn hoá chữ hoa, khoảng trắng thành gạch dưới.
- Bỏ trường `Kho cấp hàng` khỏi form tạo; luồng cấp/chuyển hàng do chứng từ quyết định.
- Đổi loại ngoài chuỗi trên UI thành `Kho trung chuyển`.
- Danh sách hiển thị trực tiếp cờ `Bán trước, nhập sau`.

Khoảng trống cần xử lý trước khi deploy production:

- Migration Phase 3 hiện mới có `department_name`, chưa có cột `department_code` và unique constraint phù hợp theo chi nhánh.
- Constraint loại kho hiện chưa có `transit`.
- Chưa có RPC đổi trạng thái/tạm ngưng kho và kiểm tra kho đã phát sinh movement.
- Chưa có hợp đồng trừ kho từ đơn/BOM; phần này vẫn thuộc Phase 6.

## 7. Ràng buộc đề xuất cho GHR

- Unique mã khu trong một chi nhánh: `(branch_uuid, department_code)` với kho đang hoạt động và chưa lưu trữ mềm.
- Một chi nhánh chỉ có một kho mặc định đang hoạt động.
- Không cho tạm ngưng kho còn chứng từ đang xử lý hoặc đang là kho mặc định duy nhất của chi nhánh.
- Không đổi loại/chi nhánh/mã khu trực tiếp sau khi kho đã có movement; phải dùng luồng thay thế và lưu lịch sử.
- Không xoá vật lý kho đã được tham chiếu.
