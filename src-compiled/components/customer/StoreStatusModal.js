import Icon from "../Icon.js";
import CustomerBottomSheet from "./CustomerBottomSheet.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function StoreStatusModal({
  notice,
  onClose
}) {
  if (!notice) return null;
  return /*#__PURE__*/_jsxs(CustomerBottomSheet, {
    ariaLabel: "Th\xF4ng b\xE1o tr\u1EA1ng th\xE1i qu\xE1n",
    onClose: onClose,
    className: "promo-sheet",
    showHeader: false,
    children: [/*#__PURE__*/_jsx("div", {
      className: "mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-orange-50",
      children: /*#__PURE__*/_jsx("span", {
        className: "grid h-10 w-10 place-items-center rounded-full bg-white text-orange-600",
        children: /*#__PURE__*/_jsx(Icon, {
          name: "warning",
          size: 18
        })
      })
    }), /*#__PURE__*/_jsxs("div", {
      className: "mb-4 text-center",
      children: [/*#__PURE__*/_jsx("span", {
        className: "inline-flex rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-white",
        children: notice.badge || "Đang đóng cửa"
      }), /*#__PURE__*/_jsx("h2", {
        className: "mt-3 text-2xl font-black leading-tight text-brown",
        children: notice.title
      }), /*#__PURE__*/_jsx("p", {
        className: "mt-2 text-sm font-semibold leading-6 text-brown/70",
        children: notice.description
      })]
    }), /*#__PURE__*/_jsx("button", {
      onClick: onClose,
      className: "cta w-full",
      children: "\u0110\xE3 hi\u1EC3u"
    })]
  });
}