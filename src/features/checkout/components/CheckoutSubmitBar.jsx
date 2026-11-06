import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import { formatMoney } from "../../../utils/format.js";

export default function CheckoutSubmitBar({ total, summary, paymentMethod, busy = false, onSubmit }) {
  const label = busy ? "Đang xác nhận…" : paymentMethod === "bank_qr" ? "Đặt & thanh toán QR" : paymentMethod === "momo" ? "Thanh toán bằng MoMo" : "Đặt món";
  return <div className="checkout-sticky-cta">
    <div className="checkout-sticky-cta__inner">
      <div className="checkout-sticky-cta__meta">
        <small>Tổng thanh toán</small>
        <strong>{formatMoney(total)}</strong>
        <div className="checkout-sticky-cta__subline"><span className="checkout-sticky-status"><em>{summary}</em></span></div>
      </div>
      <CustomerControl type="button" onClick={onSubmit} className={`cta ${busy ? "is-loading" : ""}`} disabled={busy} aria-busy={busy}>{label}</CustomerControl>
    </div>
  </div>;
}
