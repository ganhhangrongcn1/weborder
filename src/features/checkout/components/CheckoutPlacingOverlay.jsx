import { createPortal } from "react-dom";
import Icon from "../../../components/Icon.jsx";

export default function CheckoutPlacingOverlay({ open }) {
  if (!open) return null;

  const overlay = (
    <div className="checkout-placing-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="checkout-placing-card">
        <div className="checkout-placing-icon">
          <Icon name="check" size={26} />
        </div>
        <span>Đang xác nhận đơn</span>
        <h3>Quán đang nhận thông tin đặt món</h3>
        <p>Hệ thống đang lưu đơn và gửi thông báo nội bộ. Bạn chờ một chút nhé.</p>
        <div className="checkout-placing-steps">
          <em>Kiểm tra món</em>
          <em>Lưu đơn</em>
          <em>Báo cho quán</em>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return overlay;
  return createPortal(overlay, document.querySelector(".customer-shell") || document.body);
}
