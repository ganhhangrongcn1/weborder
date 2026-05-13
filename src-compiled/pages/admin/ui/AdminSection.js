import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AdminSection({
  eyebrow,
  title,
  description,
  action,
  children,
  className = ""
}) {
  return /*#__PURE__*/_jsxs("section", {
    className: `admin-ui-section ${className}`.trim(),
    children: [eyebrow || title || description || action ? /*#__PURE__*/_jsxs("header", {
      className: "admin-ui-section-head",
      children: [/*#__PURE__*/_jsxs("div", {
        children: [eyebrow ? /*#__PURE__*/_jsx("p", {
          children: eyebrow
        }) : null, title ? /*#__PURE__*/_jsx("h1", {
          children: title
        }) : null, description ? /*#__PURE__*/_jsx("span", {
          children: description
        }) : null]
      }), action ? /*#__PURE__*/_jsx("div", {
        className: "admin-ui-section-action",
        children: action
      }) : null]
    }) : null, children]
  });
}