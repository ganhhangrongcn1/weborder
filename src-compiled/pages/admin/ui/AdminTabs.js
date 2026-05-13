import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AdminTabs({
  tabs = [],
  value,
  onChange,
  className = ""
}) {
  return /*#__PURE__*/_jsx("div", {
    className: `admin-ui-tabs ${className}`.trim(),
    children: tabs.map(tab => {
      const active = tab.value === value;
      return /*#__PURE__*/_jsxs("button", {
        type: "button",
        className: active ? "active" : "",
        onClick: () => onChange?.(tab.value),
        children: [/*#__PURE__*/_jsx("span", {
          children: tab.label
        }), tab.count !== undefined ? /*#__PURE__*/_jsx("em", {
          children: tab.count
        }) : null]
      }, tab.value);
    })
  });
}