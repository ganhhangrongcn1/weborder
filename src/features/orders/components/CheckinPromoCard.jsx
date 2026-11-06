import CustomerControl from "../../../components/customer/CustomerControl.jsx";
import Icon from "../../../components/Icon.jsx";

function formatPointValue(value = 0) {
  return `${Math.max(0, Math.floor(Number(value || 0))).toLocaleString("vi-VN")}đ`;
}

export default function CheckinPromoCard({
  dailyPoints = 0,
  cyclePoints = 0,
  onClick
}) {
  return (
    <CustomerControl
      type="button"
      className="orders-checkin-promo"
      onClick={onClick}
      aria-label={`Điểm danh mỗi ngày, nhận đến ${formatPointValue(cyclePoints)} mỗi tháng`}
    >
      <div className="orders-checkin-promo__topline">
        <span><Icon name="gift" size={16} /> Quà điểm danh mỗi ngày</span>
        <strong>{formatPointValue(cyclePoints)}/tháng</strong>
      </div>

      <div className="orders-checkin-promo__copy">
        <h2>Điểm danh nhận quà</h2>
        <p>
          Nhận {formatPointValue(dailyPoints)} mỗi ngày. Tích lũy đến {formatPointValue(cyclePoints)}/tháng.
        </p>
      </div>

      <div className="orders-checkin-promo__stats" aria-hidden="true">
        <span><strong>{formatPointValue(dailyPoints)}</strong><small>Mỗi ngày</small></span>
        <span><strong>{formatPointValue(cyclePoints)}</strong><small>Mỗi tháng</small></span>
        <span><strong>0đ</strong><small>Miễn phí</small></span>
      </div>

      <span className="orders-checkin-promo__action">
        Nhận điểm ngay <Icon name="back" size={15} />
      </span>
    </CustomerControl>
  );
}
