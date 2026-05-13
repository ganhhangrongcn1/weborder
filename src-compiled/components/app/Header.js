import Icon from "../Icon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Header({
  title,
  onBack,
  right
}) {
  return /*#__PURE__*/_jsxs("header", {
    className: "sticky top-0 z-30 flex h-16 items-center justify-between bg-cream/95 px-4 backdrop-blur",
    children: [/*#__PURE__*/_jsx("button", {
      onClick: onBack,
      className: "top-icon",
      children: onBack ? /*#__PURE__*/_jsx(Icon, {
        name: "back"
      }) : /*#__PURE__*/_jsx(Icon, {
        name: "gear"
      })
    }), /*#__PURE__*/_jsx("h1", {
      className: "text-sm font-black uppercase tracking-wide",
      children: title
    }), /*#__PURE__*/_jsx("div", {
      className: "min-w-11",
      children: right || /*#__PURE__*/_jsx("span", {})
    })]
  });
}