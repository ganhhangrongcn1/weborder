import Icon from "../../../components/Icon.jsx";

export default function ReviewRewardPromoCard({ embedded = false, onClick }) {
  return (
    <button
      type="button"
      className={`orders-review-reward-promo${embedded ? " is-embedded" : ""}`}
      onClick={onClick}
    >
      <span className="orders-review-reward-promo__icon" aria-hidden="true">
        <Icon name="star" size={22} weight="fill" />
      </span>
      <span className="orders-review-reward-promo__copy">
        <small>Thưởng điểm đánh giá</small>
        <strong>Đánh Giá Ngay – Nhận Điểm Liền Tay</strong>
        <span>Đơn đối tác · Google Maps</span>
      </span>
      <span className="orders-review-reward-promo__action">
        Xem ngay <Icon name="back" size={15} />
      </span>
    </button>
  );
}
