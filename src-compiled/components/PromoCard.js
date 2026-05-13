import Icon from "./Icon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const iconText = {
  bike: "bag",
  cup: "star",
  gift: "gift",
  sale: "tag"
};
export default function PromoCard({
  promo
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "rounded-[22px] bg-white p-3 text-center shadow-soft",
    children: [/*#__PURE__*/_jsx("div", {
      className: "mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600",
      children: /*#__PURE__*/_jsx(Icon, {
        name: iconText[promo.icon],
        size: 20
      })
    }), /*#__PURE__*/_jsx("h3", {
      className: "mt-2 text-[11px] font-black uppercase text-brown",
      children: promo.title
    }), /*#__PURE__*/_jsx("p", {
      className: "mt-1 text-[10px] font-semibold text-brown/60",
      children: promo.text
    })]
  });
}