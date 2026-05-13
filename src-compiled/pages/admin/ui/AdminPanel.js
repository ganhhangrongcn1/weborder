import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AdminPanel({
  title,
  description,
  action,
  children,
  className = ""
}) {
  return /*#__PURE__*/_jsxs("section", {
    className: `admin-ui-panel ${className}`.trim(),
    children: [title || description || action ? /*#__PURE__*/_jsxs("div", {
      className: "admin-ui-panel-head",
      children: [/*#__PURE__*/_jsxs("div", {
        children: [title ? /*#__PURE__*/_jsx("h2", {
          children: title
        }) : null, description ? /*#__PURE__*/_jsx("p", {
          children: description
        }) : null]
      }), action ? /*#__PURE__*/_jsx("div", {
        className: "admin-ui-panel-action",
        children: action
      }) : null]
    }) : null, children]
  });
}