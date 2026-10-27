# Hồ sơ xét duyệt lại bản 9 — 27/10/2026

**Đã gửi thành công.** Zalo hiển thị “Phiên bản 9 của bạn đang được xét duyệt”, thời gian submit09:32:42 27/10/2026. Chưa được duyệt, chưa Publish/Live. [Ảnh xác nhận](assets/attendance-review9-2026-10-27/14-version9-da-gui.jpg).

## Mô tả đã gửi

> App dành cho nhân viên Gánh Hàng Rong. Tài khoản riêng giúp xem đúng giờ làm và điểm mua hàng của mình. Anh chị dùng tài khoản thử bên dưới, chọn Tích điểm hoặc Điểm danh. Chia sẻ số Zalo là tùy chọn tại Tài khoản. Điểm, GPS, QR và số điện thoại đang dùng dữ liệu mẫu, chưa gọi API Zalo thật.

292 ký tự,375 byte UTF-8, được portal chấp nhận. Tài khoản thử nhập riêng vào hai trường dành cho kiểm duyệt viên, không ghi mật khẩu vào tài liệu hoặc ảnh. Không nhập ngày kết thúc campaign vì app không chạy theo campaign.

## Nội dung đã rà soát trên Zalo

- Đúng Testing9, không chọn bản8 hoặc bản7 đã bị từ chối.
- Bước1 có đủ11quyền ở trạng thái Đợi xét duyệt. Không có nút sửa giải trình/ảnh cho yêu cầu đang chờ. Giữ nguyên yêu cầu, không hủy hoặc gửi trùng.
- Email, xác thực chủ app và webhook đủ điều kiện qua bước2.
- [Điều khoản nguồn](../attendance-miniapp-terms-2026-10-25.md) đã cập nhật ngày27/10 cho Testing9: thêm tích điểm mua hàng, hóa đơn/quà mẫu, điểm chỉ giữ trong phiên; số điện thoại tùy chọn; không tự cấp quyền hoặc cộng điểm từ số Zalo. Đã lưu rồi đóng/mở lại editor để đối chiếu nội dung.
- Form gửi phiên bản chỉ có mô tả, campaign và tài khoản kiểm tra, không có trường tải ảnh. **Bộ ảnh mới dưới đây đã lưu để chủ app kiểm tra/bổ sung khi portal cho phép; chưa thay được ảnh và giải trình cũ của11yêu cầu quyền đang chờ.** Không coi bản9đã nộp là quyền đã được cấp.

## Giải trình 11 quyền và ảnh phù hợp

Ảnh chụp từ local cùng mã nguồn Testing9, viewport390x844. Đây là ảnh demo trên trình duyệt, không phải ảnh trong ứng dụng Zalo điện thoại và không chứng minh API native đã chạy. Chỉ mô tả ngữ cảnh thật đang có, không đổi nhãn ảnh hoặc dựng hộp cấp quyền để giả bằng chứng.

| Quyền | Lý do sử dụng | Ảnh và giới hạn |
|---|---|---|
| Quét QR | Nhân viên chọn quét mã tại chi nhánh để đối chiếu điểm làm việc khi điểm danh. | [09](assets/attendance-review9-2026-10-27/09-qr-mau.jpg): hộp quét ghi rõ mô phỏng, không mở camera thật. |
| Vị trí | Bấm Kiểm tra GPS để xem có ở gần điểm làm việc hay không, không theo dõi liên tục. | [10](assets/attendance-review9-2026-10-27/10-diem-danh.jpg): khoảng cách từ tọa độ mẫu, không phải vị trí thật của người dùng. |
| Trạng thái mạng | Báo cho nhân viên biết tình trạng kết nối trước khi gửi thao tác. | [10](assets/attendance-review9-2026-10-27/10-diem-danh.jpg): đã kiểm tra trạng thái trình duyệt, chưa gọi API mạng của Zalo. |
| Giữ sáng màn hình | Dùng trong lúc quét mã hoặc xem video để tránh màn hình tự tắt; dừng khi rời ngữ cảnh. | [09](assets/attendance-review9-2026-10-27/09-qr-mau.jpg), [12](assets/attendance-review9-2026-10-27/12-dao-tao.jpg): có ngữ cảnh/công tắc; chưa kiểm chứng giữ sáng native. |
| Rung | Phản hồi ngắn sau thao tác điểm danh để người dùng nhận biết kết quả. | [10](assets/attendance-review9-2026-10-27/10-diem-danh.jpg) chỉ là ngữ cảnh. Không tạo ca mới, chưa kích hoạt hoặc kiểm chứng rung. |
| Camera | Nhân viên tự chọn Chụp ảnh để thêm minh chứng khi cần đối chiếu điểm danh. | [10](assets/attendance-review9-2026-10-27/10-diem-danh.jpg): nút chụp ảnh, chưa có ảnh preview hay bằng chứng camera thật. Không xin quyền camera trình duyệt để chụp ảnh này. |
| Chọn media | Cho người dùng tự chọn ảnh, PDF hoặc video làm minh chứng khi gửi điều chỉnh giờ công. | [11](assets/attendance-review9-2026-10-27/11-dinh-kem-minh-chung.jpg): chỉ chụp form, không mở trình chọn file hoặc tải minh chứng lên server. |
| Số điện thoại | Sau đăng nhập, người dùng tự chọn chia sẻ số Zalo tại Tài khoản để đối chiếu hồ sơ nhân viên. Từ chối vẫn dùng tích điểm và điểm danh. Không tự cộng điểm, tạo hồ sơ hoặc đổi quyền từ số được chia sẻ. | [04](assets/attendance-review9-2026-10-27/04-tai-khoan-so-dien-thoai.jpg), [05](assets/attendance-review9-2026-10-27/05-chia-se-tu-nguyen.jpg), [06](assets/attendance-review9-2026-10-27/06-tu-choi.jpg), [07](assets/attendance-review9-2026-10-27/07-khop-lien-ket-mau.jpg), [08](assets/attendance-review9-2026-10-27/08-khong-khop.jpg): số mẫu, không gọi getPhoneNumber thật. |
| Lưu video | Nhân viên chủ động lưu video đào tạo để xem lại. Lưu trong app và lưu vào thư viện máy là hai thao tác khác nhau. | [12](assets/attendance-review9-2026-10-27/12-dao-tao.jpg): có mục đã lưu xem lại và link tải video; chưa xác nhận lưu vào gallery Zalo. |
| Tải file | Tải bản PDF hoặc video hướng dẫn do quán cung cấp khi người dùng yêu cầu. | [12](assets/attendance-review9-2026-10-27/12-dao-tao.jpg), [13](assets/attendance-review9-2026-10-27/13-xem-pdf.jpg): link tải bản gốc đã xuất hiện; chưa kiểm chứng tải file trên điện thoại. |
| Mở tài liệu | Mở PDF hướng dẫn trong mục Đào tạo để nhân viên đọc trước khi làm việc. | [13](assets/attendance-review9-2026-10-27/13-xem-pdf.jpg): trình duyệt hiển thị trang kết xuất từ PDF; chưa phải API openDocument native. |

Đối với số điện thoại, tài khoản thử đã có liên kết mẫu ***0001 trước buổi kiểm tra. Trường hợp khớp xác nhận giữ liên kết đó, không ghi đè. Từ chối và không khớp cũng giữ nguyên thông tin cũ. Không dựng tình huống đã thu được số Zalo thật hoặc đã tạo liên kết mới.

## Bộ ảnh mới

1. [01-dang-nhap.jpg](assets/attendance-review9-2026-10-27/01-dang-nhap.jpg): logo, dòng Điểm danh và tích điểm, form chưa nhập thông tin.
2. [02-chon-chuc-nang.jpg](assets/attendance-review9-2026-10-27/02-chon-chuc-nang.jpg): hai mục Tích điểm và Điểm danh sau đăng nhập.
3. [03-tich-diem.jpg](assets/attendance-review9-2026-10-27/03-tich-diem.jpg): hóa đơn/quà mẫu và số dư0, chưa tạo giao dịch.
4. [04-tai-khoan-so-dien-thoai.jpg](assets/attendance-review9-2026-10-27/04-tai-khoan-so-dien-thoai.jpg): chỗ người dùng tự chọn chia sẻ số.
5. [05-chia-se-tu-nguyen.jpg](assets/attendance-review9-2026-10-27/05-chia-se-tu-nguyen.jpg): bảng mô phỏng, công tắc tắt và giải thích mục đích.
6. [06-tu-choi.jpg](assets/attendance-review9-2026-10-27/06-tu-choi.jpg): từ chối vẫn dùng hai chức năng.
7. [07-khop-lien-ket-mau.jpg](assets/attendance-review9-2026-10-27/07-khop-lien-ket-mau.jpg): liên kết mẫu đã có, không ghi đè.
8. [08-khong-khop.jpg](assets/attendance-review9-2026-10-27/08-khong-khop.jpg): chưa khớp, nhờ quản lý kiểm tra.
9. [09-qr-mau.jpg](assets/attendance-review9-2026-10-27/09-qr-mau.jpg): màn quét ghi rõ không mở camera thật.
10. [10-diem-danh.jpg](assets/attendance-review9-2026-10-27/10-diem-danh.jpg): GPS mẫu, kết nối trình duyệt và nút chụp ảnh.
11. [11-dinh-kem-minh-chung.jpg](assets/attendance-review9-2026-10-27/11-dinh-kem-minh-chung.jpg): form chọn ảnh/PDF/video, không gửi yêu cầu mới.
12. [12-dao-tao.jpg](assets/attendance-review9-2026-10-27/12-dao-tao.jpg): video, giữ sáng, mục đã lưu và link tải.
13. [13-xem-pdf.jpg](assets/attendance-review9-2026-10-27/13-xem-pdf.jpg): trang hướng dẫn và link tải PDF gốc.
14. [14-version9-da-gui.jpg](assets/attendance-review9-2026-10-27/14-version9-da-gui.jpg): trạng thái nộp thành công trên Zalo.

## Kiểm tra và phạm vi

- Không sửa mã app hoặc upload bản mới; gửi đúng Testing9 đã có. Entry bundle local SHA256 FEA2FA55A16D925C87398909D2A6628A9984090E56A49D913FB467E2FE1F5EC5, build trước đó584045byte.
- Video trên browser readyState4, thời lượng30giây, rộng960px. Đã mở trang PDF. Không coi đây là kiểm chứng phát video/giữ sáng/lưu file trong Zalo điện thoại.
- Không tạo ca công, yêu cầu sửa công, giao dịch điểm, tài khoản hay dữ liệu nhân sự mới. Chỉ dùng tài khoản thử; điện thoại thử có liên kết cũ nên kiểm tra khớp không ghi DB.
- Đã xem trực quan ảnh đăng nhập, bảng chia sẻ và PDF; ảnh rõ nội dung mẫu, không che dấu trạng thái mô phỏng. Viewport đã reset sau chụp.
- File thay đổi: Điều khoản nguồn ở trên, báo cáo này và14ảnh trong danh sách. Không đưa mật khẩu, token, env hay QR đăng nhập CLI vào Git. Nội dung quyền mới chưa thay bộ ảnh cũ trên portal vì yêu cầu đang chờ.

Tham khảo luồng nộp và quyền: [Phát hành Mini App](https://docs.zaloplatforms.com/docs/MA/intro/public-mini-program), [Xin cấp quyền](https://docs.zaloplatforms.com/docs/MA/intro/request-permission).
