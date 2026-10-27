import { useEffect, useRef } from "react";

export default function PrivacyNotice({ onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const escape = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("keydown", escape); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop"><section className="camera-dialog privacy-dialog" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
    <h2 id="privacy-title">Quyền riêng tư</h2>
    <p>Thông tin sử dụng trong ứng dụng chấm công Gánh Hàng Rong.</p>
    <h3>Tài khoản và giờ công</h3><p>Tài khoản được quản lý cấp để truy cập dữ liệu chấm công được phân quyền. Giờ vào ca, giờ ra ca và yêu cầu điều chỉnh được dùng để đối chiếu công việc.</p>
    <h3>Tích điểm thành viên</h3><p>Tính năng tích điểm mua hàng hiện dùng hóa đơn và quà mẫu, chỉ giữ trong phiên đăng nhập và mất khi tải lại hoặc đăng xuất. Không ghi điểm vào dữ liệu chấm công, điểm khách hàng hoặc hệ thống ưu đãi thật.</p>
    <h3>Liên kết số điện thoại</h3><p>Sau khi đăng nhập, bạn tự chọn chia sẻ số Zalo tại Thông tin tài khoản để đối chiếu hồ sơ nhân viên. Chỉ nhận số sau khi bạn cho phép; từ chối vẫn dùng tích điểm và điểm danh. Nếu chưa khớp, không ghi đè thông tin cũ hoặc tự cấp quyền. Số điện thoại không được dùng để tự cộng điểm. Bản thử chỉ dùng số mẫu.</p>
    <h3>Vị trí, camera và tệp</h3><p>Chỉ kiểm tra vị trí khi bạn chủ động thao tác, không theo dõi liên tục. Ảnh và tệp minh chứng chỉ được chọn hoặc chụp khi bạn yêu cầu để phục vụ đối chiếu chấm công.</p>
    <h3>Phạm vi bản trải nghiệm</h3><p>Bản hiện tại dùng vị trí, QR và số điện thoại mẫu; chưa lấy thông tin qua API Zalo thật. Tài khoản và dữ liệu thử nghiệm được lưu trên Supabase trong kho Testing.</p>
    <h3>Hỗ trợ thông tin</h3><p>Liên hệ quản lý cửa hàng để kiểm tra, sửa thông tin hoặc yêu cầu xử lý dữ liệu tài khoản. Nội dung này cần được cập nhật theo quy trình vận hành thực tế trước khi phát hành chính thức.</p>
    <button ref={closeRef} className="primary" onClick={onClose}>Đóng</button>
  </section></div>;
}
