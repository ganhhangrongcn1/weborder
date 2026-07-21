import Icon from "../Icon.jsx";
import { getCustomerOrderJourney } from "../../services/customerOrderStatusService.js";

export default function OrderJourneyTimeline({ order, compact = false }) {
  const journey = getCustomerOrderJourney(order);

  if (journey.cancelled) {
    return (
      <section className="order-journey order-journey--cancelled" aria-label="Đơn hàng đã hủy">
        <span className="order-journey__cancel-icon"><Icon name="warning" size={22} /></span>
        <div>
          <strong>Đơn hàng đã được hủy</strong>
          <p>{order.cancelReason || order.cancel_reason || journey.description}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`order-journey order-journey--${journey.statusKey}${compact ? " order-journey--compact" : ""}`}
      aria-label={`Hành trình đơn hàng: ${journey.statusLabel}`}
      style={{
        "--journey-step-count": journey.steps.length,
        "--journey-progress": journey.progressRatio
      }}
    >
      <div className="order-journey__track" aria-hidden="true">
        <span />
      </div>
      <ol className="order-journey__steps">
        {journey.steps.map((step, index) => {
          const completed = index < journey.currentStepIndex;
          const current = index === journey.currentStepIndex;
          const active = completed || current;
          return (
            <li
              key={step.key}
              className={`order-journey__step${active ? " is-active" : ""}${completed ? " is-complete" : ""}${current ? " is-current" : ""}`}
              aria-current={current ? "step" : undefined}
            >
              <span className="order-journey__node">
                <Icon name={completed ? "check" : step.icon} size={compact ? 16 : 18} />
              </span>
              <span className="order-journey__label">{step.label}</span>
            </li>
          );
        })}
      </ol>
      <div className="order-journey__message" role="status" aria-live="polite">
        <span><Icon name={journey.pickupLike ? "store" : journey.statusKey === "delivering" ? "bike" : "clock"} size={15} /></span>
        <p>{journey.description}</p>
      </div>
      {!journey.completed ? (
        <aside className="order-journey__loyalty-hint" aria-label="Quyền lợi tích điểm thành viên">
          <span aria-hidden="true"><Icon name="gift" size={15} /></span>
          <p>
            <strong>Xong đơn là có điểm</strong>
            <small>Tích 10–15% giá trị đơn theo hạng của bạn.</small>
          </p>
        </aside>
      ) : null}
    </section>
  );
}
