import { formatMoney } from "../../../utils/format.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function ToppingMenuCard({
  topping,
  onAdd,
  onRemove,
  selectedCount = 0
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: `menu-addon-card ${selectedCount ? "addon-selected" : ""}`,
    children: [/*#__PURE__*/_jsxs("button", {
      type: "button",
      className: "menu-addon-main",
      onClick: onAdd,
      children: [/*#__PURE__*/_jsx("h3", {
        children: topping.name
      }), /*#__PURE__*/_jsx("p", {
        children: topping.description || "V\u1ecb b\u00e9o m\u1eb7n, h\u1ee3p m\u00f3n cay v\u00e0 s\u1ed1t me."
      })]
    }), /*#__PURE__*/_jsxs("div", {
      children: [/*#__PURE__*/_jsx("strong", {
        children: formatMoney(Number(topping.price) || 0)
      }), selectedCount > 0 ? /*#__PURE__*/_jsxs("span", {
        className: "addon-stepper",
        children: [/*#__PURE__*/_jsx("button", {
          type: "button",
          onClick: onRemove,
          children: "-"
        }), /*#__PURE__*/_jsx("em", {
          children: selectedCount
        }), /*#__PURE__*/_jsx("button", {
          type: "button",
          onClick: onAdd,
          children: "+"
        })]
      }) : /*#__PURE__*/_jsx("button", {
        type: "button",
        className: "addon-plus",
        onClick: onAdd,
        "aria-label": `Th\u00eam ${topping.name}`,
        children: "+"
      })]
    })]
  });
}