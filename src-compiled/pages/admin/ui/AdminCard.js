import { jsx as _jsx } from "react/jsx-runtime";
export default function AdminCard({
  children,
  variant = "default",
  className = "",
  as: Component = "section"
}) {
  return /*#__PURE__*/_jsx(Component, {
    className: `admin-ui-card admin-ui-card--${variant} ${className}`.trim(),
    children: children
  });
}