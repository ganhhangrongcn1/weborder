import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
import { CustomerButton } from "../../../components/customer/CustomerUI.jsx";
import { getLoyaltyText } from "../../../services/loyaltyConfigService.js";

export default function LuckyVoucherModal({ luckyVoucher, onClose }) {
  if (!luckyVoucher) return null;
  const loyaltyText = getLoyaltyText();

  return (
    <CustomerBottomSheet
      ariaLabel={loyaltyText.luckyGiftTitle}
      onClose={onClose}
      className="promo-sheet"
      showHeader={false}
      footer={(
        <CustomerButton full onClick={onClose}>
          {loyaltyText.luckyReceive}
        </CustomerButton>
      )}
    >
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-orange-50 text-orange-600">
          <Icon name="gift" size={24} />
        </span>
        <h2 className="mt-4 customer-title-lg">{loyaltyText.luckyCongrats}</h2>
        <p className="mt-2 customer-body">{loyaltyText.luckyReceiveLabel(luckyVoucher.title)}</p>
      </div>
    </CustomerBottomSheet>
  );
}
