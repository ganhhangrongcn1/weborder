import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Banner({
  banner,
  onClick
}) {
  return /*#__PURE__*/_jsxs("article", {
    className: "home2026-banner-card",
    onClick: () => onClick?.(banner),
    children: [/*#__PURE__*/_jsx("img", {
      src: banner.image,
      alt: banner.title || "Banner"
    }), banner.title || banner.text ? /*#__PURE__*/_jsxs("div", {
      className: "home2026-banner-content",
      children: [banner.title ? /*#__PURE__*/_jsx("h2", {
        children: banner.title
      }) : null, banner.text ? /*#__PURE__*/_jsx("p", {
        children: banner.text
      }) : null]
    }) : null]
  });
}