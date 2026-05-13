import { jsx as _jsx } from "react/jsx-runtime";
export default function AdminIconButton({
  children,
  label,
  variant = "ghost",
  className = "",
  type = "button",
  ...props
}) {
  return /*#__PURE__*/_jsx("button", {
    type: type,
    className: `admin-ui-icon-button admin-ui-icon-button--${variant} ${className}`.trim(),
    "aria-label": label,
    title: label,
    ...props,
    children: children
  });
}