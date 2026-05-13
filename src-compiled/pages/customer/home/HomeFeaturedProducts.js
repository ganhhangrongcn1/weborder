import ProductCard from "../../../components/ProductCard.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function HomeFeaturedProducts({
  featuredTitle,
  viewMore,
  collapse,
  showAllHomeProducts,
  setShowAllHomeProducts,
  featuredProducts,
  openOptionModal
}) {
  return /*#__PURE__*/_jsxs("section", {
    className: "home2026-section",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "home2026-section-head",
      children: [/*#__PURE__*/_jsx("h2", {
        children: featuredTitle
      }), /*#__PURE__*/_jsx("button", {
        type: "button",
        onClick: () => setShowAllHomeProducts(value => !value),
        children: showAllHomeProducts ? collapse : viewMore
      })]
    }), /*#__PURE__*/_jsx("div", {
      className: "grid grid-cols-2 gap-3 featured-grid product-grid",
      children: featuredProducts.map(product => /*#__PURE__*/_jsx(ProductCard, {
        product: product,
        onOpen: openOptionModal,
        onAdd: openOptionModal
      }, product.id))
    })]
  });
}