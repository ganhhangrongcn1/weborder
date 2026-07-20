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
        <span>Đang tạo đơn</span>
        <h3>Gần xong rồi</h3>
        <p>Bạn giữ màn hình này trong giây lát nhé.</p>
      </div>
    </div>
  );

  if (typeof document === "undefined") return overlay;
  return createPortal(overlay, document.querySelector(".customer-shell") || document.body);
}
