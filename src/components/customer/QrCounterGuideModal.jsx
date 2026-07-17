import { createPortal } from "react-dom";
import Icon from "../Icon.jsx";
import { CustomerButton, CustomerModalFrame } from "./CustomerUI.jsx";

const guideItems = [
  {
    icon: "dish",
    title: "Tự chọn món",
    description: "Thoải mái xem menu, chọn topping, không cần chờ nhân viên ghi món."
  },
  {
    icon: "tag",
    title: "Nhập voucher",
    description: "Dùng mã ưu đãi phù hợp trước khi xác nhận đơn."
  },
  {
    icon: "star",
    title: "Tích điểm",
    description: "Nhập số điện thoại để quán ghi nhận điểm và xem ưu đãi."
  },
  {
    icon: "bag",
    title: "Theo dõi đơn",
    description: "Xem món đang làm tới đâu ngay trên điện thoại."
  }
];

export default function QrCounterGuideModal({
  open,
  showSignupAction = false,
  onClose,
  onSignup,
  onStart
}) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <CustomerModalFrame
      className="qr-counter-guide"
      ariaLabel="Hướng dẫn đặt món QR tại quầy"
      onBackdropClick={onClose}
    >
      <button
        type="button"
        className="qr-counter-guide__close"
        aria-label="Đóng hướng dẫn đặt món QR"
        onClick={onClose}
      >
        <Icon name="close" size={18} />
      </button>

      <div className="qr-counter-guide__badge">
        <Icon name="star" size={17} />
        <span>Đặt món QR</span>
      </div>

      <div className="qr-counter-guide__copy">
        <h2>Đặt món QR tiện hơn</h2>
        <p>Quét QR để tự chọn món, dùng ưu đãi và theo dõi đơn ngay trên điện thoại.</p>
      </div>

      <div className="qr-counter-guide__benefits">
        {guideItems.map((item) => (
          <div key={item.title} className="qr-counter-guide__benefit">
            <span><Icon name={item.icon} size={18} /></span>
            <div>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="qr-counter-guide__actions">
        <CustomerButton full size="lg" onClick={onStart}>
          Tiếp tục
        </CustomerButton>
        {showSignupAction ? (
          <button type="button" className="qr-counter-guide__member-action" onClick={onSignup}>
            <Icon name="user" size={16} />
            <span>Đăng nhập để tích điểm</span>
          </button>
        ) : (
          <p className="qr-counter-guide__member-note">
            <Icon name="star" size={16} />
            <span>Điểm sẽ tự cộng sau khi hoàn thành đơn</span>
          </p>
        )}
      </div>
    </CustomerModalFrame>,
    document.body
  );
}
