import { useMemo } from "react";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function formatDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "--";
  const date = new Date(`${raw.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("vi-VN");
}
function formatValue(voucher) {
  const value = Number(voucher?.value || 0);
  if (!value) return "";
  if (String(voucher?.discountType || "") === "percent") return `Giảm ${value}%`;
  return `Giảm ${value.toLocaleString("vi-VN")}đ`;
}
function buildGuide(voucher, coupon) {
  const configuredGuide = String(voucher?.usageGuide || voucher?.guide || coupon?.usageGuide || coupon?.guide || coupon?.instruction || coupon?.description || coupon?.note || "").trim();
  if (configuredGuide) return configuredGuide;
  const minOrder = Number(voucher?.minOrder ?? coupon?.minOrder ?? 0);
  if (minOrder > 0) {
    return `Áp dụng cho đơn từ ${minOrder.toLocaleString("vi-VN")}đ.`;
  }
  return "Áp dụng khi thanh toán trên menu chính thức.";
}
export default function LoyaltyVoucherPopup({
  open,
  voucher,
  coupon,
  onClose,
  onPrimaryAction
}) {
  const valueText = useMemo(() => formatValue(voucher), [voucher]);
  const guideText = useMemo(() => buildGuide(voucher, coupon), [voucher, coupon]);
  const expiresAt = voucher?.expiredAt || voucher?.endAt || voucher?.expiry || coupon?.endAt || "";
  if (!open || !voucher) return null;
  return /*#__PURE__*/_jsx("div", {
    className: "loyalty-voucher-overlay",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Voucher d\xE0nh cho b\u1EA1n",
    children: /*#__PURE__*/_jsxs("section", {
      className: "loyalty-voucher-card",
      children: [/*#__PURE__*/_jsx("button", {
        type: "button",
        className: "loyalty-voucher-close",
        onClick: onClose,
        "aria-label": "\u0110\xF3ng",
        children: "X"
      }), /*#__PURE__*/_jsx("p", {
        className: "loyalty-voucher-pill",
        children: "\u01AFu \u0111\xE3i & T\xEDch \u0111i\u1EC3m"
      }), /*#__PURE__*/_jsx("h2", {
        children: voucher?.title || voucher?.name || "Bạn vừa nhận voucher"
      }), valueText ? /*#__PURE__*/_jsx("p", {
        className: "loyalty-voucher-value",
        children: valueText
      }) : null, /*#__PURE__*/_jsxs("div", {
        className: "loyalty-voucher-body",
        children: [/*#__PURE__*/_jsxs("p", {
          children: [/*#__PURE__*/_jsx("strong", {
            children: "M\xE3:"
          }), " ", voucher?.code || coupon?.code || "--"]
        }), /*#__PURE__*/_jsxs("p", {
          children: [/*#__PURE__*/_jsx("strong", {
            children: "Th\u1EDDi h\u1EA1n:"
          }), " ", formatDate(expiresAt)]
        }), /*#__PURE__*/_jsxs("p", {
          children: [/*#__PURE__*/_jsx("strong", {
            children: "H\u01B0\u1EDBng d\u1EABn:"
          }), " ", guideText]
        })]
      }), /*#__PURE__*/_jsx("button", {
        type: "button",
        className: "cta w-full",
        onClick: onPrimaryAction,
        children: "Ch\u1ECDn m\xF3n ngay"
      })]
    })
  });
}