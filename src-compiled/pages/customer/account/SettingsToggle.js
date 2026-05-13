import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function SettingsToggle({
  label,
  checked = false
}) {
  return /*#__PURE__*/_jsxs("label", {
    className: "flex items-center justify-between rounded-[20px] bg-cream/50 px-4 py-3",
    children: [/*#__PURE__*/_jsx("span", {
      className: "text-sm font-bold text-brown/75",
      children: label
    }), /*#__PURE__*/_jsx("input", {
      type: "checkbox",
      defaultChecked: checked,
      className: "toggle-input"
    })]
  });
}