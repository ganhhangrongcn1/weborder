import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { CustomerButton } from "../../../components/customer/CustomerUI.jsx";
import { getLoyaltyTierIconSymbol } from "../../../services/loyaltyProgramConfigService.js";

export default function TierUpgradeModal({ tier, onClose }) {
  if (!tier) return null;

  const earnPercent = Number(tier.earnPercent || 0).toLocaleString("vi-VN", {
    maximumFractionDigits: 2
  });

  return (
    <CustomerBottomSheet
      ariaLabel={`Chúc mừng bạn đã lên ${tier.name}`}
      onClose={onClose}
      className="loyalty-tier-upgrade-sheet"
      showHeader={false}
      footer={<CustomerButton full onClick={onClose}>Tuyệt quá</CustomerButton>}
    >
      <div className="loyalty-tier-upgrade">
        <span className="loyalty-tier-upgrade__icon" aria-hidden="true">
          {getLoyaltyTierIconSymbol(tier.iconKey)}
        </span>
        <p>Hạng mới đã mở khóa</p>
        <h2>Chúc mừng bạn đã lên {tier.name}!</h2>
        <span>
          Từ giờ, mỗi đơn hoàn tất được tích {earnPercent}% điểm. Cứ ăn món mình mê, Gánh lo phần thưởng.
        </span>
      </div>
    </CustomerBottomSheet>
  );
}
