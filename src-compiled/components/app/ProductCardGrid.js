import ProductCard from "../ProductCard.js";
import { jsx as _jsx } from "react/jsx-runtime";
export default function ProductCardGrid({
  products,
  onOpen
}) {
  return /*#__PURE__*/_jsx("div", {
    className: "grid grid-cols-2 gap-3",
    children: products.map(product => /*#__PURE__*/_jsx(ProductCard, {
      product: product,
      onOpen: onOpen,
      onAdd: onOpen
    }, product.id))
  });
}