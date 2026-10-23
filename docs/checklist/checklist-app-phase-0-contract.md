# Hợp đồng nghiệp vụ ứng dụng Checklist cửa hàng — Phase 0

Ngày chốt: 2026-07-29  
Trạng thái: Hoàn thành Phase 0, sẵn sàng triển khai Phase 1

## 1. Mục tiêu

Xây dựng một ứng dụng React/Vite độc lập dành cho việc kiểm tra định kỳ các quầy takeaway bánh tráng trộn Gánh Hàng Rong.

Ứng dụng dùng chung Supabase hiện tại để tái sử dụng:

- tài khoản đăng nhập trong Supabase Auth;
- quyền vận hành trong `public.profiles`;
- danh sách chi nhánh chuẩn trong `public.branches`.

Toàn bộ dữ liệu checklist dùng các bảng có tiền tố `checklist_`. Không thay đổi luồng đơn hàng, khách hàng, loyalty, POS, bếp, bánh kem hoặc kho hiện tại.

## 2. Phạm vi MVP

### Có trong MVP

- Admin đăng nhập và có toàn quyền trong ứng dụng checklist.
- Quản lý hồ sơ nhân viên chưa cần tài khoản đăng nhập.
- Gán một nhân viên cho một hoặc nhiều chi nhánh.
- Quản lý mẫu checklist, nhóm tiêu chí, tiêu chí, trọng số và trạng thái áp dụng.
- Khi kiểm tra một chi nhánh, chỉ hiển thị nhân viên đang hoạt động tại chi nhánh đó.
- Giám sát chọn thủ công những nhân viên có mặt tại thời điểm kiểm tra.
- Trả lời tiêu chí bằng `Đạt`, `Cần cải thiện`, `Không đạt`, `Không áp dụng`.
- Ghi chú và tải ảnh minh chứng.
- Gắn vi phạm cho cửa hàng, một nhân viên, nhiều nhân viên hoặc chưa xác định.
- Tính điểm cửa hàng theo trọng số.
- Theo dõi vi phạm cá nhân, lỗi tái phạm và báo cáo theo tháng.
- Theo dõi lịch kiểm tra dự kiến hai ngày một lần.
- Lưu nháp và nộp phiếu kiểm tra.

### Chưa có trong MVP

- Xếp ca cố định, chấm công, nghỉ phép hoặc tính lương.
- Tài khoản đăng nhập riêng cho từng nhân viên.
- GPS bắt buộc hoặc hoạt động hoàn toàn ngoại tuyến.
- Thông báo Zalo, email hoặc phê duyệt nhiều cấp.
- Dùng điểm checklist làm căn cứ tự động tính lương, thưởng hoặc kỷ luật.

## 3. Vai trò và quyền

### Phase đầu

- `admin`: quản trị cấu hình và trực tiếp thực hiện kiểm tra.
- Chỉ `profiles.status = 'active'` và `profiles.role = 'admin'` được toàn quyền.

### Mở rộng sau MVP

- `supervisor`: thực hiện kiểm tra và xem các chi nhánh được phân công.
- `hr`: xem hồ sơ, báo cáo nhân viên và dữ liệu nhân sự được cấp quyền.
- Nhân viên chưa có tài khoản vẫn tồn tại như một hồ sơ nghiệp vụ độc lập.

Không dùng `user_metadata` để quyết định quyền. Quyền phải lấy từ dữ liệu được quản trị trong hệ thống và được bảo vệ bằng RLS.

## 4. Luồng kiểm tra chuẩn

1. Người kiểm tra đăng nhập.
2. Chọn chi nhánh.
3. Ứng dụng tải nhân viên đang hoạt động được gán cho chi nhánh.
4. Người kiểm tra chọn những nhân viên có mặt.
5. Ứng dụng tạo phiếu nháp và chụp lại thông tin chi nhánh, mẫu checklist, người tham gia tại thời điểm đó.
6. Người kiểm tra trả lời từng tiêu chí, thêm ghi chú và ảnh khi cần.
7. Với câu trả lời không đạt, người kiểm tra chọn phạm vi trách nhiệm:
   - cửa hàng;
   - chưa xác định;
   - một hoặc nhiều nhân viên có mặt.
8. Ứng dụng kiểm tra các trường bắt buộc và tính điểm.
9. Người kiểm tra xác nhận nộp phiếu.
10. Phiếu đã nộp chuyển sang chỉ đọc; mọi điều chỉnh sau đó phải có nhật ký.
11. Hệ thống đề xuất ngày kiểm tra tiếp theo bằng ngày hoàn thành cộng hai ngày.

## 5. Quy tắc nhân viên và chi nhánh

- Mỗi nhân viên có mã cố định, ví dụ `NV0001`.
- Một nhân viên có thể được gán cho nhiều chi nhánh.
- Chỉ nhân viên `active` mới xuất hiện trong màn hình chọn người có mặt.
- Không xóa cứng nhân viên đã có dữ liệu kiểm tra; chuyển trạng thái sang `inactive` hoặc `left`.
- Việc chuyển chi nhánh không được làm thay đổi phiếu kiểm tra cũ.
- Phiếu kiểm tra phải lưu bản chụp tên nhân viên, mã nhân viên và chi nhánh tại thời điểm kiểm tra.
- Hồ sơ nhân viên có thể liên kết `auth_user_id` về sau mà không tạo hồ sơ mới.

## 6. Mẫu checklist mặc định

| Nhóm | Trọng số |
|---|---:|
| Hình ảnh quầy bán | 10 |
| Vệ sinh quầy và dụng cụ | 20 |
| Nguyên liệu và an toàn thực phẩm | 25 |
| Chất lượng sản phẩm | 20 |
| Nhân viên và phục vụ | 10 |
| Kho, thiết bị và vận hành | 10 |
| Khắc phục lỗi cũ | 5 |
| **Tổng** | **100** |

Mẫu khởi tạo gồm 37 tiêu chí đã thống nhất. Nội dung chi tiết sẽ được đưa vào seed data ở Phase 1. Admin có thể thêm, sửa, sắp xếp hoặc tạm ẩn tiêu chí.

Không xóa hoặc sửa trực tiếp phiên bản checklist đã được dùng trong một phiếu đã nộp. Khi công bố thay đổi, hệ thống tạo phiên bản mới.

## 7. Cách tính điểm cửa hàng

Hệ số câu trả lời:

| Kết quả | Hệ số |
|---|---:|
| Đạt | 1 |
| Cần cải thiện | 0,5 |
| Không đạt | 0 |
| Không áp dụng | Loại khỏi mẫu số |

Công thức:

```text
Điểm cửa hàng =
Tổng (trọng số tiêu chí áp dụng × hệ số kết quả)
÷ Tổng trọng số tiêu chí áp dụng
× 100
```

Xếp loại:

- 90–100: Tốt.
- 80–89,99: Đạt.
- 70–79,99: Cần cải thiện.
- Dưới 70: Không đạt.
- Có tiêu chí nghiêm trọng không đạt: kết quả chung là Không đạt bất kể điểm số.

Điểm và kết quả phải được lưu lại khi nộp phiếu, không tính lại bằng cấu hình mới.

## 8. Vi phạm và điểm tuân thủ nhân viên

Chỉ lỗi được gắn đích danh mới ảnh hưởng điểm nhân viên. Lỗi cửa hàng, lỗi thiết bị hoặc chưa xác định không được tự động trừ cho người có mặt.

Mức phạt mặc định:

| Mức độ | Điểm phạt |
|---|---:|
| Nhắc nhở | 1 |
| Nhẹ | 3 |
| Nặng | 5 |
| Nghiêm trọng | 10 |
| Đặc biệt nghiêm trọng | 20 |

Hệ số tái phạm theo cùng nhân viên và cùng mã tiêu chí trong 30 ngày:

- lần đầu: `1`;
- lần thứ hai: `1,25`;
- từ lần thứ ba: `1,5`.

Công thức tham khảo sau giai đoạn thu thập dữ liệu:

```text
Điểm phạt trung bình = Tổng điểm phạt sau hệ số ÷ Số lượt nhân viên có mặt trong phiếu đã nộp
Điểm tuân thủ = max(0, 100 - Điểm phạt trung bình × 5)
```

Trong 1–2 tháng đầu, báo cáo chỉ hiển thị dữ liệu và điểm tham khảo. Chưa dùng để xếp hạng chính thức cho đến khi đủ dữ liệu hiệu chỉnh hệ số.

## 9. Mô hình dữ liệu dự kiến

### Dữ liệu dùng chung, chỉ đọc trong app checklist

- `public.branches`: nguồn chuẩn của chi nhánh.
- `public.profiles`: liên kết tài khoản đăng nhập và quyền vận hành.
- `auth.users`: danh tính đăng nhập do Supabase Auth quản lý.

### Dữ liệu mới

| Bảng | Mục đích |
|---|---|
| `checklist_employees` | Hồ sơ nhân viên nghiệp vụ, chưa bắt buộc có tài khoản |
| `checklist_employee_branches` | Quan hệ nhiều-nhiều giữa nhân viên và chi nhánh |
| `checklist_user_access` | Quyền admin/supervisor và phạm vi chi nhánh |
| `checklist_templates` | Mẫu checklist |
| `checklist_template_versions` | Phiên bản đã công bố của mẫu |
| `checklist_sections` | Nhóm tiêu chí trong một phiên bản |
| `checklist_items` | Tiêu chí, trọng số, mức nghiêm trọng và yêu cầu ảnh |
| `checklist_inspections` | Phiếu kiểm tra, trạng thái, điểm và bản chụp chi nhánh |
| `checklist_inspection_participants` | Nhân viên được xác nhận có mặt tại phiếu |
| `checklist_answers` | Kết quả từng tiêu chí và trọng số chụp tại thời điểm kiểm tra |
| `checklist_answer_employees` | Nhân viên chịu trách nhiệm cho một câu trả lời |
| `checklist_evidence` | Metadata ảnh minh chứng trong Storage |
| `checklist_corrective_actions` | Việc cần khắc phục và trạng thái xử lý |
| `checklist_audit_logs` | Nhật ký thao tác quan trọng |

Tất cả bảng nghiệp vụ dùng UUID, `created_at`, `created_by`, `updated_at` và trạng thái rõ ràng. Các cột dùng để lọc thường xuyên phải có index phù hợp.

## 10. Quy tắc hiệu năng

- Không dùng realtime trong MVP; lịch sử và dashboard tải theo yêu cầu.
- Chỉ lấy nhân viên theo `branch_id` và `is_active`, không tải toàn bộ danh sách rồi lọc trên trình duyệt.
- Chỉ tải metadata ảnh trong danh sách; ảnh đầy đủ được tải khi mở chi tiết.
- Dashboard tháng dùng truy vấn tổng hợp/RPC sau khi dữ liệu đủ lớn, không tải toàn bộ câu trả lời về frontend.
- Lưu nháp theo từng phiếu, không ghi lại toàn bộ mẫu checklist sau mỗi thao tác.
- Dùng index cho chi nhánh, trạng thái, ngày kiểm tra, nhân viên và mã tiêu chí.
- Không nhân bản dữ liệu hồ sơ nhân viên ngoài các trường snapshot cần bảo toàn lịch sử.

## 11. Quy tắc bảo mật

- Bật RLS trên mọi bảng `checklist_*`.
- Frontend chỉ sử dụng publishable/anon key; không chứa service-role key.
- Admin được quản trị cấu hình và xem toàn bộ dữ liệu checklist.
- Supervisor về sau chỉ xem và ghi dữ liệu thuộc chi nhánh được phân công.
- Nhân viên không có tài khoản không được truy cập dữ liệu.
- Bucket ảnh là private; chỉ cấp signed URL cho người có quyền xem phiếu.
- Phiếu đã nộp không được sửa trực tiếp bởi supervisor.
- Mọi thay đổi cấu hình, điểm hoặc trách nhiệm sau khi nộp phải có audit log.
- Trước khi tạo khóa ngoại tới `branches`, Phase 1 phải audit kiểu dữ liệu và khóa chuẩn đang dùng trong production.

## 12. Ranh giới kiến trúc frontend

Ứng dụng checklist là một dự án React/Vite độc lập, theo luồng:

```text
Page / Component
→ Hook / Feature state
→ Service
→ Repository
→ Supabase
```

Quy tắc:

- Component không gọi Supabase trực tiếp.
- Công thức điểm nằm trong service thuần và có test.
- Repository chịu trách nhiệm truy vấn, phân trang và chuẩn hóa dữ liệu.
- Cấu hình môi trường tách riêng nhưng trỏ tới cùng Supabase project.
- Không import module runtime từ web bán hàng hiện tại; chỉ dùng chung hợp đồng dữ liệu đã được tài liệu hóa.

## 13. Tiêu chí hoàn thành Phase 0

- [x] Chốt phạm vi MVP và phần chưa làm.
- [x] Chốt vai trò admin ban đầu và hướng mở rộng supervisor.
- [x] Chốt luồng chọn nhân viên linh hoạt theo chi nhánh.
- [x] Chốt nguyên tắc quy trách nhiệm công bằng.
- [x] Chốt công thức điểm cửa hàng và điểm tham khảo nhân viên.
- [x] Chốt mô hình phiên bản checklist để bảo toàn lịch sử.
- [x] Chốt danh sách bảng và ranh giới với hệ thống hiện tại.
- [x] Chốt nguyên tắc RLS, Storage và hiệu năng.
- [x] Xác định audit khóa chi nhánh là điều kiện bắt buộc trước khi tạo schema.

