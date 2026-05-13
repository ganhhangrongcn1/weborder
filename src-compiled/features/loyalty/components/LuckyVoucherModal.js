import Icon from "../../../components/Icon.js";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.js";
import { getLoyaltyText } from "../../../services/loyaltyConfigService.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function LuckyVoucherModal({
  luckyVoucher,
  onClose
}) {
  if (!luckyVoucher) return null;
  const loyaltyText = getLoyaltyText();
  return /*#__PURE__*/_jsx(CustomerBottomSheet, {
    ariaLabel: loyaltyText.luckyGiftTitle,
    onClose: onClose,
    className: "promo-sheet",
    showHeader: false,
    children: /*#__PURE__*/_jsxs("div", {
      className: "text-center",
      children: [/*#__PURE__*/_jsx("span", {
        className: "mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-orange-50 text-orange-600",
        children: /*#__PURE__*/_jsx(Icon, {
          name: "gift",
          size: 24
        })
      }), /*#__PURE__*/_jsx("h2", {
        className: "mt-4 text-xl font-black text-brown",
        children: loyaltyText.luckyCongrats
      }), /*#__PURE__*/_jsx("p", {
        className: "mt-2 text-sm text-brown/60",
        children: loyaltyText.luckyReceiveLabel(luckyVoucher.title)
      }), /*#__PURE__*/_jsx("button", {
        onClick: onClose,
        className: "mt-5 w-full rounded-2xl bg-gradient-main py-3 text-sm font-black text-white shadow-orange",
        children: loyaltyText.luckyReceive
      })]
    })
  });
}