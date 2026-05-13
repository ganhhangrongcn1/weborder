import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AccountPanel({
  title,
  action,
  onAction,
  children
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "rounded-[28px] bg-white p-4 shadow-soft",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "mb-4 flex items-center justify-between gap-3",
      children: [/*#__PURE__*/_jsx("h2", {
        className: "text-sm font-black uppercase tracking-wide text-brown",
        children: title
      }), action && /*#__PURE__*/_jsx("button", {
        onClick: onAction,
        className: "rounded-2xl bg-orange-50 px-3 py-2 text-xs font-black text-orange-600",
        children: action
      })]
    }), children]
  });
}