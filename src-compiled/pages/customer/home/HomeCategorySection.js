import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function HomeCategoryBubble({
  category,
  onClick,
  active
}) {
  return /*#__PURE__*/_jsx("button", {
    type: "button",
    onClick: onClick,
    className: `home2026-category-bubble ${active ? "active" : ""}`,
    children: category.label
  });
}
export default function HomeCategorySection({
  categoryTitle,
  viewAll,
  homeCategories,
  activeHomeCategory,
  onSelectCategory,
  onViewAll
}) {
  return /*#__PURE__*/_jsxs("section", {
    className: "home2026-section",
    children: [/*#__PURE__*/_jsx("div", {
      className: "home2026-section-head",
      children: /*#__PURE__*/_jsx("h2", {
        children: categoryTitle
      })
    }), /*#__PURE__*/_jsx("div", {
      className: "home2026-category-scroll-wrap",
      children: /*#__PURE__*/_jsx("div", {
        className: "home2026-category-scroll no-scrollbar",
        children: homeCategories.map(category => /*#__PURE__*/_jsx(HomeCategoryBubble, {
          category: category,
          active: activeHomeCategory === category.value,
          onClick: () => onSelectCategory(category.value)
        }, category.label))
      })
    })]
  });
}