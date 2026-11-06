import CustomerHighlight from "../../../components/customer/CustomerHighlight.jsx";

export default function ReviewRewardPromoCard({ embedded = false, onClick }) {
  return (
    <CustomerHighlight
      className={`orders-review-reward-promo${embedded ? " is-embedded" : ""}`}
      onClick={onClick}
      title="Đánh giá nhận điểm"
      description="Đơn đối tác · Google Maps"
    />
  );
}
