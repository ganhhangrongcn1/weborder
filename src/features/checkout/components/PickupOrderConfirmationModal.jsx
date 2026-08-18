import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";

const PAYMENT_LABELS = {
  momo: "Thanh toán MoMo",
  bank_qr: "Thanh toán QR ngân hàng",
  counter: "Thanh toán tại quầy"
};

export default function PickupOrderConfirmationModal({
  open,
  cart = [],
  branch,
  pickupTimeText,
  paymentMethod,
  total,
  earnedPoints,
  formatMoney,
  onClose,
  onConfirm
}) {
  if (!open) return null;

  const visibleItems = cart.filter((item) => !item?.autoGiftByPromo).slice(0, 4);
  const remainingItems = Math.max(0, cart.filter((item) => !item?.autoGiftByPromo).length - visibleItems.length);
  const paymentLabel = PAYMENT_LABELS[paymentMethod] || "Xác nhận đặt món";
  const confirmLabel = paymentMethod === "momo"
    ? "Xác nhận & thanh toán MoMo"
    : paymentMethod === "bank_qr"
      ? "Xác nhận & mở mã QR"
      : "Xác nhận đặt món";

  return (
    <CustomerBottomSheet
      ariaLabel="Xác nhận đơn ghé lấy"
      onClose={onClose}
      className="pickup-confirmation-sheet"
      showHeader={false}
      footer={(
        <div className="pickup-confirmation-sheet__actions">
          <button type="button" className="secondary-cta" onClick={onClose}>
            Xem lại
          </button>
          <button type="button" className="cta" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      )}
    >
      <div className="pickup-confirmation">
        <header className="pickup-confirmation__header">
          <span className="pickup-confirmation__icon" aria-hidden="true">
            <Icon name="store" size={22} />
          </span>
          <div>
            <p>Tự đến lấy</p>
            <h2>Xác nhận đơn ghé lấy</h2>
            <span>Kiểm tra nhanh trước khi {paymentLabel.toLowerCase()}.</span>
          </div>
        </header>

        <section className="pickup-confirmation__branch" aria-label="Chi nhánh nhận món">
          <div>
            <Icon name="store" size={18} />
            <span>Bạn sẽ lấy món tại</span>
          </div>
          <strong>{branch?.name || "Chi nhánh đã chọn"}</strong>
          <p>{branch?.address || "Địa chỉ chi nhánh đang được cập nhật"}</p>
          <small><Icon name="clock" size={14} />{pickupTimeText}</small>
        </section>

        <section className="pickup-confirmation__items" aria-label="Tóm tắt món">
          {visibleItems.map((item, index) => (
            <div key={item.id || `${item.name}-${index}`}>
              <span><b>{Number(item.quantity || 1)}×</b>{item.name || item.productName || "Món đã chọn"}</span>
              <strong>{formatMoney(Number(item.lineTotal ?? (Number(item.price || 0) * Number(item.quantity || 1))))}</strong>
            </div>
          ))}
          {remainingItems > 0 ? <small>Và {remainingItems} món khác</small> : null}
        </section>

        <footer className="pickup-confirmation__summary">
          <div><span>Tổng thanh toán</span><strong>{formatMoney(total)}</strong></div>
          <div className="pickup-confirmation__points">
            <span><Icon name="star" size={15} />Điểm dự kiến</span>
            <strong>+{Math.max(0, Number(earnedPoints || 0)).toLocaleString("vi-VN")} điểm</strong>
          </div>
          <small>Điểm được cộng sau khi đơn hoàn thành.</small>
        </footer>
      </div>
    </CustomerBottomSheet>
  );
}
