import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";

export default function CheckoutCard({
  title,
  action,
  onAction,
  children
}) {
  return /*#__PURE__*/_jsxs("section", {
    className: "checkout-card",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "checkout-card-head",
      children: [/*#__PURE__*/_jsx("h2", {
        children: title
      }), action && /*#__PURE__*/_jsx("button", {
        onClick: onAction,
        children: action
      })]
    }), children]
  });
}

