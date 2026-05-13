import Icon from "./Icon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const IconButton = ({
  children,
  onClick,
  label
}) => /*#__PURE__*/_jsx("button", {
  "aria-label": label,
  onClick: onClick,
  className: "relative grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-soft",
  children: children
});
export default function Header({
  points = 120,
  onAccountClick
}) {
  return /*#__PURE__*/_jsx("header", {
    className: "sticky top-0 z-30 bg-cream/95 px-4 pb-3 pt-3 backdrop-blur",
    children: /*#__PURE__*/_jsxs("div", {
      className: "flex items-center justify-between",
      children: [/*#__PURE__*/_jsxs("button", {
        onClick: onAccountClick,
        className: "flex items-center gap-2 text-left",
        children: [/*#__PURE__*/_jsx("span", {
          className: "grid h-11 w-11 place-items-center rounded-2xl bg-gradient-main text-xl shadow-orange",
          children: "G"
        }), /*#__PURE__*/_jsxs("span", {
          children: [/*#__PURE__*/_jsx("span", {
            className: "block text-[11px] font-bold uppercase tracking-wide text-orange-600",
            children: "B\xE1nh tr\xE1ng tr\u1ED9n"
          }), /*#__PURE__*/_jsx("span", {
            className: "block text-lg font-black leading-5 text-brown",
            children: "G\xE1nh H\xE0ng Rong"
          })]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "flex items-center gap-2",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "hidden rounded-2xl bg-white px-3 py-2 text-xs font-extrabold text-brown shadow-soft min-[390px]:block",
          children: [points, " \u0111i\u1EC3m"]
        }), /*#__PURE__*/_jsx(IconButton, {
          label: "Th\xF4ng b\xE1o",
          children: /*#__PURE__*/_jsx(Icon, {
            name: "bell"
          })
        })]
      })]
    })
  });
}