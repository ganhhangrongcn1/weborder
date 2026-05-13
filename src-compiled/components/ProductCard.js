import { formatMoney } from "../utils/format.js";
import Icon from "./Icon.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function ProductCard({
  product,
  compact = false,
  onOpen,
  onAdd,
  onRemove,
  selectedCount = 0
}) {
  return /*#__PURE__*/_jsxs("article", {
    className: `${compact ? "product-row" : "product-card"} ${selectedCount ? "product-selected" : ""}`,
    children: [/*#__PURE__*/_jsxs("button", {
      onClick: () => onAdd(product),
      className: compact ? "product-row-image" : "product-image-wrap",
      "aria-label": `Tùy chọn ${product.name}`,
      children: [/*#__PURE__*/_jsx("img", {
        src: product.image,
        alt: product.name,
        className: "h-full w-full object-cover"
      }), /*#__PURE__*/_jsx("span", {
        className: "badge",
        children: product.badge
      }), selectedCount > 0 && /*#__PURE__*/_jsxs("span", {
        className: "selected-badge",
        children: ["\u0110\xE3 ch\u1ECDn ", selectedCount]
      })]
    }), /*#__PURE__*/_jsxs("div", {
      className: compact ? "min-w-0 flex-1 py-1" : "p-3",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "flex items-start justify-between gap-2",
        children: [/*#__PURE__*/_jsx("button", {
          onClick: () => onOpen(product),
          className: "min-w-0 text-left",
          children: /*#__PURE__*/_jsx("h3", {
            className: compact ? "line-clamp-2 text-[15px] font-black text-brown" : "line-clamp-2 text-sm font-black text-brown",
            children: product.name
          })
        }), !compact && /*#__PURE__*/_jsx("span", {
          className: "product-card-mark",
          children: /*#__PURE__*/_jsx(Icon, {
            name: "star",
            size: 14
          })
        })]
      }), /*#__PURE__*/_jsx("p", {
        className: compact ? "mt-1 line-clamp-2 text-xs leading-5 text-brown/55" : "mt-1 line-clamp-2 min-h-9 text-xs leading-5 text-brown/55",
        children: product.short
      }), /*#__PURE__*/_jsxs("div", {
        className: "mt-2 flex items-center justify-between gap-2",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "flex flex-col",
          children: [Number(product.originalPrice || 0) > Number(product.price || 0) ? /*#__PURE__*/_jsx("span", {
            className: "text-[11px] font-semibold text-brown/40 line-through",
            children: formatMoney(product.originalPrice)
          }) : null, /*#__PURE__*/_jsx("strong", {
            className: "text-[15px] font-black text-orange-600",
            children: formatMoney(product.price)
          })]
        }), selectedCount > 0 ? /*#__PURE__*/_jsxs("div", {
          className: "product-card-stepper",
          children: [/*#__PURE__*/_jsx("button", {
            onClick: () => onRemove?.(product),
            "aria-label": `Bớt ${product.name}`,
            children: "-"
          }), /*#__PURE__*/_jsx("span", {
            children: selectedCount
          }), /*#__PURE__*/_jsx("button", {
            onClick: () => onAdd(product),
            "aria-label": `Thêm ${product.name}`,
            children: "+"
          })]
        }) : /*#__PURE__*/_jsx("button", {
          onClick: () => onAdd(product),
          "aria-label": `Thêm ${product.name}`,
          className: "product-add-btn",
          children: "+"
        })]
      })]
    })]
  });
}