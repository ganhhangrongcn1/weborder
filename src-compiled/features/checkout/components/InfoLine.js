import Icon from "../../../components/Icon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function InfoLine({
  icon,
  label,
  value
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "info-line",
    children: [/*#__PURE__*/_jsx(Icon, {
      name: icon,
      size: 16
    }), /*#__PURE__*/_jsxs("span", {
      children: [/*#__PURE__*/_jsx("small", {
        children: label
      }), /*#__PURE__*/_jsx("strong", {
        children: value
      })]
    })]
  });
}