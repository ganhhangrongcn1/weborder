import Icon from "../Icon.jsx";

export default function FloatingCartBar({ count, subtotal, onClick, formatMoney }) {
  return (
    <button type="button" onClick={onClick} className="floating-cart-bar" aria-label="Mở thanh toán">
      <span className="cart-glass-icon"><Icon name="cart" size={18} /></span>
      <span className="min-w-0 flex-1 text-left">
        <strong>{count} món đã chọn</strong>
        <small>Tạm tính {formatMoney(subtotal)}</small>
      </span>
      <span className="cart-glass-cta">Thanh toán</span>
    </button>
  );
}
