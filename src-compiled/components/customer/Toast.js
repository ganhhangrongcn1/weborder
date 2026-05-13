import Icon from "../Icon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Toast({
  message
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "toast",
    children: [/*#__PURE__*/_jsx("span", {
      className: "grid h-8 w-8 place-items-center rounded-full bg-orange-50 text-orange-600",
      children: /*#__PURE__*/_jsx(Icon, {
        name: "cart",
        size: 16
      })
    }), /*#__PURE__*/_jsx("strong", {
      children: message
    })]
  });
}