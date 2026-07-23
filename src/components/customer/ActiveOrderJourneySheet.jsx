import Icon from "../Icon.jsx";
import { getCustomerOrderJourney } from "../../services/customerOrderStatusService.js";
import CustomerBottomSheet from "./CustomerBottomSheet.jsx";
import OrderJourneyTimeline from "./OrderJourneyTimeline.jsx";

export default function ActiveOrderJourneySheet({ order, onClose, onOpenOrders }) {
  if (!order) return null;

  const journey = getCustomerOrderJourney(order);
  const orderCode = String(order.displayOrderCode || order.display_order_code || order.orderCode || order.order_code || order.id || "Đơn hàng");
  const statusIcon = journey.statusKey === "ready"
    ? "check"
    : journey.statusKey === "awaiting_payment"
      ? "qr"
      : "clock";

  return (
    <CustomerBottomSheet
      ariaLabel="Hành trình đơn hàng đang xử lý"
      onClose={onClose}
      className="order-journey-sheet"
      showHeader={false}
      footer={(
        <div className="order-journey-sheet__actions">
          <button type="button" className="order-journey-sheet__secondary" onClick={onClose}>
            Đóng
          </button>
          <button type="button" className="order-journey-sheet__primary" onClick={onOpenOrders}>
            <Icon name="eye" size={16} />
            Xem chi tiết đơn
            <span aria-hidden="true">›</span>
          </button>
        </div>
      )}
    >
      <header className={`order-journey-sheet__header order-journey-sheet__header--${journey.statusKey}`}>
        <div>
          <span className="order-journey-sheet__eyebrow">
            <Icon name={journey.pickupLike ? "store" : "bike"} size={14} />
            {journey.pickupLike ? "Đơn tự lấy" : "Đơn giao tận nơi"}
          </span>
          <h2>{journey.title}</h2>
          <p>{orderCode}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng hành trình đơn hàng">×</button>
      </header>

      <div className={`order-journey-sheet__status order-journey-sheet__status--${journey.statusKey}`} role="status">
        <span><Icon name={statusIcon} size={15} /></span>
        <strong>{journey.statusLabel}</strong>
        {journey.statusKey === "scheduled" && journey.pickupSchedule?.clock ? (
          <small>Nhận lúc {journey.pickupSchedule.clock}</small>
        ) : null}
      </div>

      <OrderJourneyTimeline order={order} />
    </CustomerBottomSheet>
  );
}
