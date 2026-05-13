import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.js";
import { formatMoney } from "../../../utils/format.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function PromoModal({
  promos,
  selectedPromo,
  onSelect,
  onClose
}) {
  return /*#__PURE__*/_jsx(CustomerBottomSheet, {
    title: "M\xE3 khuy\u1EBFn m\xE3i",
    subtitle: "Ch\u1ECDn 1 m\xE3 ph\xF9 h\u1EE3p cho \u0111\u01A1n h\xE0ng",
    ariaLabel: "Ch\u1ECDn m\xE3 khuy\u1EBFn m\xE3i",
    onClose: onClose,
    className: "promo-sheet",
    children: /*#__PURE__*/_jsxs("div", {
      className: "promo-code-list",
      children: [!promos.length ? /*#__PURE__*/_jsx("p", {
        className: "px-2 py-6 text-center text-sm font-semibold text-brown/50",
        children: "Ch\u01B0a c\xF3 m\xE3 ph\xF9 h\u1EE3p."
      }) : null, promos.map(promo => {
        const disabled = promo.freeShip ? !promo.freeShip : promo.discount <= 0;
        const active = selectedPromo?.id === promo.id;
        return /*#__PURE__*/_jsxs("button", {
          disabled: disabled,
          onClick: () => onSelect(promo),
          className: `promo-code-card ${active ? "promo-code-active" : ""}`,
          children: [/*#__PURE__*/_jsxs("span", {
            children: [/*#__PURE__*/_jsx("strong", {
              children: promo.title
            }), /*#__PURE__*/_jsx("small", {
              children: promo.condition
            }), /*#__PURE__*/_jsxs("small", {
              children: ["M\xE3: ", promo.code]
            })]
          }), /*#__PURE__*/_jsx("em", {
            children: disabled ? "Chưa đủ" : promo.freeShip ? "Freeship" : `-${formatMoney(promo.discount)}`
          })]
        }, promo.id);
      })]
    })
  });
}