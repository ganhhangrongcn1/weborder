import { jsx as _jsx } from "react/jsx-runtime";
export default function AdminBadge({
  children,
  tone = "neutral",
  className = ""
}) {
  return /*#__PURE__*/_jsx("span", {
    className: `admin-ui-badge admin-ui-badge--${tone} ${className}`.trim(),
    children: children
  });
}