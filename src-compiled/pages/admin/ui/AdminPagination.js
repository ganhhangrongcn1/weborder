import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AdminPagination({
  page = 1,
  totalPages = 1,
  onChange,
  className = ""
}) {
  const pages = Array.from({
    length: Math.max(1, totalPages)
  }, (_, index) => index + 1);
  return /*#__PURE__*/_jsxs("nav", {
    className: `admin-ui-pagination ${className}`.trim(),
    "aria-label": "Ph\xE2n trang",
    children: [/*#__PURE__*/_jsx("button", {
      type: "button",
      disabled: page <= 1,
      onClick: () => onChange?.(page - 1),
      children: "\u2039"
    }), pages.map(item => /*#__PURE__*/_jsx("button", {
      type: "button",
      className: item === page ? "active" : "",
      onClick: () => onChange?.(item),
      children: item
    }, item)), /*#__PURE__*/_jsx("button", {
      type: "button",
      disabled: page >= totalPages,
      onClick: () => onChange?.(page + 1),
      children: "\u203A"
    })]
  });
}