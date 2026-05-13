import Icon from "../../../components/Icon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "rounded-[22px] border border-orange-100 bg-cream/50 p-3",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "flex items-start justify-between gap-3",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "min-w-0",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "flex flex-wrap items-center gap-2",
          children: [/*#__PURE__*/_jsx("h3", {
            className: "font-black text-brown",
            children: address.label
          }), address.isDefault && /*#__PURE__*/_jsx("span", {
            className: "rounded-full bg-orange-600 px-2 py-1 text-[10px] font-black uppercase text-white",
            children: "GIAO \u0110\u1EBEN"
          })]
        }), /*#__PURE__*/_jsxs("p", {
          className: "mt-2 text-sm font-semibold leading-5 text-brown/60",
          children: [address.receiverName, " \xB7 ", address.phone]
        }), /*#__PURE__*/_jsx("p", {
          className: "mt-1 text-sm font-semibold leading-5 text-brown/60",
          children: address.address
        }), address.note && /*#__PURE__*/_jsx("p", {
          className: "mt-1 text-xs text-brown/45",
          children: address.note
        })]
      }), /*#__PURE__*/_jsx(Icon, {
        name: "home",
        size: 18,
        className: "mt-1 shrink-0 text-orange-600"
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: "mt-3 flex gap-2",
      children: [!address.isDefault && /*#__PURE__*/_jsx("button", {
        onClick: onSetDefault,
        className: "rounded-2xl border border-orange-100 bg-white px-4 py-2 text-xs font-black text-orange-600",
        children: "Giao \u0111\u1EBFn"
      }), /*#__PURE__*/_jsx("button", {
        onClick: onEdit,
        className: "rounded-2xl border border-orange-100 bg-white px-4 py-2 text-xs font-black text-brown/70",
        children: "S\u1EEDa"
      }), /*#__PURE__*/_jsx("button", {
        onClick: onDelete,
        className: "rounded-2xl border border-red-100 bg-white px-4 py-2 text-xs font-black text-red-500",
        children: "X\xF3a"
      })]
    })]
  });
}