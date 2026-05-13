import Icon from "../../../components/Icon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function CheckoutNoticeModal({
  notice,
  onClose
}) {
  if (!notice) return null;
  return /*#__PURE__*/_jsx("div", {
    className: "fixed inset-0 z-[110] grid place-items-center bg-slate-900/40 px-4",
    role: "presentation",
    onClick: onClose,
    children: /*#__PURE__*/_jsxs("section", {
      className: "w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": notice?.title || "Thông báo",
      onClick: event => event.stopPropagation(),
      children: [/*#__PURE__*/_jsxs("div", {
        className: "flex items-start gap-3",
        children: [/*#__PURE__*/_jsx("span", {
          className: "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600",
          children: /*#__PURE__*/_jsx(Icon, {
            name: notice?.icon || "warning",
            size: 18
          })
        }), /*#__PURE__*/_jsxs("div", {
          className: "min-w-0 flex-1",
          children: [/*#__PURE__*/_jsx("h3", {
            className: "text-base font-black text-slate-900",
            children: notice?.title || "Thông báo"
          }), /*#__PURE__*/_jsx("p", {
            className: "mt-1 text-sm font-medium leading-6 text-slate-600",
            children: notice?.message || ""
          })]
        })]
      }), /*#__PURE__*/_jsx("button", {
        type: "button",
        className: "mt-4 w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-black text-white",
        onClick: onClose,
        children: "\u0110\xE3 hi\u1EC3u"
      })]
    })
  });
}