import { formatMoney } from "../utils/format.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function CartItem({
  item,
  onInc,
  onDec,
  onRemove
}) {
  const toppings = item.toppings.map(topping => topping.name).join(", ");
  return /*#__PURE__*/_jsxs("div", {
    className: "flex gap-3 rounded-[24px] bg-white p-3 shadow-soft",
    children: [/*#__PURE__*/_jsx("img", {
      src: item.image,
      alt: item.name,
      className: "h-20 w-20 rounded-[20px] object-cover"
    }), /*#__PURE__*/_jsxs("div", {
      className: "min-w-0 flex-1",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "flex items-start justify-between gap-2",
        children: [/*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("h3", {
            className: "line-clamp-2 text-sm font-black text-brown",
            children: item.name
          }), /*#__PURE__*/_jsx("p", {
            className: "mt-1 text-xs font-semibold text-brown/55",
            children: item.spice
          }), toppings && /*#__PURE__*/_jsxs("p", {
            className: "mt-1 line-clamp-1 text-xs text-brown/45",
            children: ["+ ", toppings]
          }), item.note && /*#__PURE__*/_jsxs("p", {
            className: "mt-1 line-clamp-1 text-xs text-brown/45",
            children: ["Ghi ch\xFA: ", item.note]
          })]
        }), /*#__PURE__*/_jsx("button", {
          onClick: () => onRemove(item.cartId),
          className: "grid h-8 w-8 shrink-0 place-items-center rounded-full text-brown/50",
          children: "X"
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "mt-3 flex items-center justify-between",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "flex items-center gap-2",
          children: [/*#__PURE__*/_jsx("button", {
            onClick: () => onDec(item.cartId),
            className: "qty-btn",
            children: "-"
          }), /*#__PURE__*/_jsx("span", {
            className: "w-5 text-center text-sm font-bold",
            children: item.quantity
          }), /*#__PURE__*/_jsx("button", {
            onClick: () => onInc(item.cartId),
            className: "qty-btn text-orange-600",
            children: "+"
          })]
        }), /*#__PURE__*/_jsx("strong", {
          className: "text-sm font-black text-brown",
          children: formatMoney(item.lineTotal)
        })]
      })]
    })]
  });
}