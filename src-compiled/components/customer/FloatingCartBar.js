import Icon from "../Icon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function FloatingCartBar({
  count,
  subtotal,
  onClick,
  formatMoney
}) {
  return /*#__PURE__*/_jsxs("button", {
    type: "button",
    onClick: onClick,
    className: "floating-cart-bar",
    "aria-label": "M\u1EDF thanh to\xE1n",
    children: [/*#__PURE__*/_jsx("span", {
      className: "cart-glass-icon",
      children: /*#__PURE__*/_jsx(Icon, {
        name: "cart",
        size: 18
      })
    }), /*#__PURE__*/_jsxs("span", {
      className: "min-w-0 flex-1 text-left",
      children: [/*#__PURE__*/_jsxs("strong", {
        children: [count, " m\xF3n \u0111\xE3 ch\u1ECDn"]
      }), /*#__PURE__*/_jsxs("small", {
        children: ["T\u1EA1m t\xEDnh ", formatMoney(subtotal)]
      })]
    }), /*#__PURE__*/_jsx("span", {
      className: "cart-glass-cta",
      children: "Thanh to\xE1n"
    })]
  });
}