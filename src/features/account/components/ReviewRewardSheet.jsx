import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import ReviewRewardPanel from "./ReviewRewardPanel.jsx";

export default function ReviewRewardSheet({ onClose }) {
  return <CustomerBottomSheet
    title="Thưởng điểm đánh giá"
    onClose={onClose}
    backdropClassName="account-review-reward-sheet-backdrop"
    className="account-review-reward-sheet"
    contentClassName="account-review-reward-sheet__content"
  >
    <ReviewRewardPanel showHistory />
  </CustomerBottomSheet>;
}
