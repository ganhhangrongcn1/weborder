import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AdminStatCard({
  title,
  value,
  subtitle = "",
  icon = "•",
  tone = "brand",
  className = ""
}) {
  return /*#__PURE__*/_jsxs("article", {
    className: `admin-ui-stat-card admin-ui-stat-card--${tone} ${className}`.trim(),
    children: [/*#__PURE__*/_jsx("span", {
      className: "admin-ui-stat-icon",
      children: icon
    }), /*#__PURE__*/_jsxs("div", {
      children: [/*#__PURE__*/_jsx("p", {
        children: title
      }), /*#__PURE__*/_jsx("strong", {
        children: value
      }), subtitle ? /*#__PURE__*/_jsx("small", {
        children: subtitle
      }) : null]
    })]
  });
}