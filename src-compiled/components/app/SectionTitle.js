import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function SectionTitle({
  title,
  action,
  onAction
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "flex items-center justify-between",
    children: [/*#__PURE__*/_jsx("h2", {
      className: "text-sm font-black uppercase tracking-wide text-brown",
      children: title
    }), action && /*#__PURE__*/_jsx("button", {
      onClick: onAction,
      className: "text-xs font-bold text-orange-600",
      children: action
    })]
  });
}