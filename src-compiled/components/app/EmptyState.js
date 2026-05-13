import Icon from "../Icon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function EmptyState({
  icon = "bag",
  title,
  message,
  actionText,
  onAction,
  className = "rounded-2xl bg-white px-4 py-3 text-sm text-brown/55 shadow-soft",
  center = false
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: className,
    children: [icon && /*#__PURE__*/_jsx("span", {
      className: `grid h-14 w-14 place-items-center rounded-3xl bg-orange-50 text-orange-600 ${center ? "mx-auto" : ""}`,
      children: /*#__PURE__*/_jsx(Icon, {
        name: icon,
        size: 24
      })
    }), title && /*#__PURE__*/_jsx("h2", {
      className: `${icon ? "mt-4" : ""} text-lg font-black text-brown ${center ? "text-center" : ""}`,
      children: title
    }), message && /*#__PURE__*/_jsx("p", {
      className: `${title ? "mt-2" : icon ? "mt-3" : ""} text-sm text-brown/60 ${center ? "text-center" : ""}`,
      children: message
    }), actionText && onAction && /*#__PURE__*/_jsx("button", {
      onClick: onAction,
      className: `mt-5 rounded-2xl bg-gradient-main py-3 text-sm font-black text-white shadow-orange ${center ? "w-full" : ""}`,
      children: actionText
    })]
  });
}