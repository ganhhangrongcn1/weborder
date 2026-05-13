import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function formatVoucherValue(voucher) {
  const value = Number(voucher?.value || 0);
  if (!value) return "";
  if (voucher.discountType === "percent") return `Giảm ${value}%`;
  return `Giảm ${value.toLocaleString("vi-VN")}đ`;
}
export default function VoucherCard({
  voucher,
  expired
}) {
  const valueText = formatVoucherValue(voucher);
  const canceled = voucher?.canceled === true;
  const used = voucher?.used === true;
  const inactive = canceled || used || expired;
  const statusLabel = canceled ? "Đã hủy" : used ? "Đã dùng" : expired ? "Đã hết hạn" : "Còn hạn";
  const statusClass = inactive ? "bg-brown/5 text-brown/45" : "bg-green-50 text-green-600";
  return /*#__PURE__*/_jsx("div", {
    className: `rounded-2xl bg-white px-4 py-3 text-sm shadow-soft ${inactive ? "opacity-45" : ""}`,
    children: /*#__PURE__*/_jsxs("div", {
      className: "flex items-center justify-between gap-3",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "min-w-0",
        children: [/*#__PURE__*/_jsx("strong", {
          className: "block truncate text-brown",
          children: voucher.title || voucher.name || "Voucher"
        }), voucher.code ? /*#__PURE__*/_jsxs("span", {
          className: "mt-1 block text-xs font-black text-orange-600",
          children: ["M\xE3: ", voucher.code]
        }) : null, valueText ? /*#__PURE__*/_jsx("span", {
          className: "block text-xs text-brown/60",
          children: valueText
        }) : null, /*#__PURE__*/_jsxs("span", {
          className: "text-xs text-brown/50",
          children: ["HSD: ", voucher.expiredAt || voucher.endAt || voucher.expiry || "--"]
        })]
      }), /*#__PURE__*/_jsx("span", {
        className: `shrink-0 rounded-full px-3 py-1 text-xs font-black ${statusClass}`,
        children: statusLabel
      })]
    })
  });
}