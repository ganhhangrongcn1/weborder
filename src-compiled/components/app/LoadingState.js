import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function LoadingState({
  label = "Đang tải...",
  className = "rounded-2xl bg-white px-4 py-3 text-sm text-brown/55 shadow-soft"
}) {
  return /*#__PURE__*/_jsx("div", {
    className: className,
    children: /*#__PURE__*/_jsxs("div", {
      className: "flex items-center gap-2",
      children: [/*#__PURE__*/_jsx("span", {
        className: "inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-orange-500"
      }), /*#__PURE__*/_jsx("span", {
        children: label
      })]
    })
  });
}