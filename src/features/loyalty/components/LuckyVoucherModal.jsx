import Icon from "../../../components/Icon.jsx";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.jsx";
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
    >
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-orange-50 text-orange-600">
          <Icon name="gift" size={24} />
        </span>
        <h2 className="mt-4 text-xl font-black text-brown">{loyaltyText.luckyCongrats}</h2>
        <p className="mt-2 text-sm text-brown/60">{loyaltyText.luckyReceiveLabel(luckyVoucher.title)}</p>
        <button onClick={onClose} className="mt-5 w-full rounded-2xl bg-gradient-main py-3 text-sm font-black text-white shadow-orange">
          {loyaltyText.luckyReceive}
        </button>
      </div>
    </CustomerBottomSheet>
  );
}
