import Icon from "../Icon.jsx";
import { getCustomerOrderJourney } from "../../services/customerOrderStatusService.js";

function getJourneyIcon(journey = {}) {
  if (journey.statusKey === "awaiting_payment") return "qr";
  if (journey.statusKey === "scheduled") return "clock";
  if (journey.statusKey === "delivering") return "bike";
  if (journey.statusKey === "ready") return journey.pickupLike ? "store" : "clock";
  if (["preparing", "active"].includes(journey.statusKey)) return "dish";
  return "bag";
}

function getMiniProgressLabel(journey = {}) {
  if (journey.statusKey === "awaiting_payment") return "Thanh toán xong là bếp lên món";
  if (journey.statusKey === "scheduled") {
    return journey.pickupSchedule?.prepareClock
      ? `Bếp bắt đầu làm lúc ${journey.pickupSchedule.prepareClock}`
      : "Quán đã nhận và giữ lịch làm món";
  }
  if (journey.statusKey === "delivering") return "Món ngon đang tới, để ý điện thoại nha";
  if (journey.statusKey === "ready") return journey.pickupLike ? "Ghé quầy nhận món ngay nha" : "Có shipper là Gánh giao ngay";
  if (["preparing", "active"].includes(journey.statusKey)) return "Bếp đang lên món, chờ xíu nha";
  if (journey.statusKey === "completed") return "Đã hoàn thành";
  return "Gánh nhận được đơn rồi nha";
}

function MiniStepProgress({ journey }) {
  const progressLabel = getMiniProgressLabel(journey);

  return (
    <span className="active-order-floatboard__steps" aria-label={`Tiến độ đơn hàng: ${progressLabel}`}>
      <span className="active-order-floatboard__step-label">{progressLabel}</span>
      <span className="active-order-floatboard__step-track" aria-hidden="true">
        {journey.steps.map((step, index) => (
          <i
            key={step.key}
            className={`${index <= journey.currentStepIndex ? "is-active" : ""}${index === journey.currentStepIndex ? " is-current" : ""}`}
          />
        ))}
      </span>
    </span>
  );
}

export default function ActiveOrderFloatboard({
  order,
  raised = false,
  collapsed = false,
  hasUnreadUpdate = false,
  onCollapse,
  onExpand,
  onOpenJourney
}) {
  if (!order) return null;

  const journey = getCustomerOrderJourney(order);
  const isAwaitingPayment = journey.statusKey === "awaiting_payment";
  const isReadyForPickup = journey.statusKey === "ready" && journey.pickupLike;
  const isScheduledPickup = journey.statusKey === "scheduled";
  const orderCode = String(order.orderCode || order.order_code || order.id || "Đơn đang xử lý");
  const iconName = getJourneyIcon(journey);

  if (collapsed) {
    return (
      <div className={`active-order-floatboard-wrap active-order-floatboard-wrap--compact${raised ? " is-raised" : ""}${hasUnreadUpdate ? " has-unread" : ""}${isReadyForPickup ? " is-ready" : ""}${isScheduledPickup ? " is-scheduled" : ""}`} aria-live="polite">
        <button
          type="button"
          className="active-order-floatboard__compact-button"
          onClick={onExpand}
          aria-label={`${hasUnreadUpdate ? "Cập nhật mới. " : ""}Mở tóm tắt đơn ${orderCode}: ${journey.statusLabel}`}
        >
          <Icon name={iconName} size={24} />
          <span className="active-order-floatboard__compact-status" aria-hidden="true">
            {isReadyForPickup ? "Lấy món" : isScheduledPickup ? "Đã nhận" : hasUnreadUpdate ? "Mới" : "Đơn"}
          </span>
          {hasUnreadUpdate ? <i className="active-order-floatboard__unread-dot" aria-hidden="true" /> : null}
        </button>
      </div>
    );
  }

  return (
    <aside className={`active-order-floatboard-wrap${raised ? " is-raised" : ""}${isReadyForPickup ? " is-ready" : ""}${isScheduledPickup ? " is-scheduled" : ""}`} aria-label={`Tóm tắt đơn đang xử lý ${orderCode}`} aria-live="polite">
      <div className="active-order-floatboard">
        <span className="active-order-floatboard__icon" aria-hidden="true">
          <Icon name={iconName} size={21} />
          <i />
        </span>
        <span className="active-order-floatboard__copy">
          <small>{orderCode}</small>
          <strong>{journey.title}</strong>
          <MiniStepProgress journey={journey} />
        </span>
        <button type="button" className="active-order-floatboard__action" onClick={onOpenJourney}>
          <Icon name={isAwaitingPayment ? "qr" : "eye"} size={15} />
          {isAwaitingPayment ? "Thanh toán tiếp" : isReadyForPickup ? "Nhận món" : "Theo dõi"}
        </button>
        <button
          type="button"
          className="active-order-floatboard__collapse"
          onClick={onCollapse}
          aria-label={`Thu gọn đơn ${orderCode}`}
        >
          ×
        </button>
      </div>
    </aside>
  );
}
