import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function OptionGroup({
  title,
  children
}) {
  return /*#__PURE__*/_jsxs("div", {
    children: [/*#__PURE__*/_jsx("h2", {
      className: "label",
      children: title
    }), /*#__PURE__*/_jsx("div", {
      className: "mt-3 grid gap-2",
      children: children
    })]
  });
}