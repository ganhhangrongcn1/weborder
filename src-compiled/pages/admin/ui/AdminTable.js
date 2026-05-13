import { jsx as _jsx } from "react/jsx-runtime";
export function AdminTable({
  children,
  className = ""
}) {
  return /*#__PURE__*/_jsx("div", {
    className: `admin-ui-table ${className}`.trim(),
    children: children
  });
}
export function AdminTableHead({
  children,
  className = ""
}) {
  return /*#__PURE__*/_jsx("div", {
    className: `admin-ui-table-head ${className}`.trim(),
    children: children
  });
}
export function AdminTableBody({
  children,
  className = ""
}) {
  return /*#__PURE__*/_jsx("div", {
    className: `admin-ui-table-body ${className}`.trim(),
    children: children
  });
}
export function AdminTableRow({
  children,
  selected = false,
  className = "",
  as: Component = "div",
  ...props
}) {
  return /*#__PURE__*/_jsx(Component, {
    className: `admin-ui-table-row ${selected ? "is-selected" : ""} ${className}`.trim(),
    ...props,
    children: children
  });
}