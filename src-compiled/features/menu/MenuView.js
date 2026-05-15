import { useMemo } from "react";
import ProductCard from "../../components/ProductCard.js";
import Icon from "../../components/Icon.js";
import AppHeader from "../../components/app/Header.js";
import { products as productSeed } from "../../data/products.js";
import { menuText, suggestText } from "../../data/uiText.js";
import ToppingMenuCard from "./components/ToppingMenuCard.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Menu({
  navigate,
  activeCategory,
  setActiveCategory,
  categories,
  filteredProducts,
  products,
  toppings,
  openProduct,
  openOptionModal,
  addToCart,
  cart = [],
  setCart
}) {
  const cartProductCount = useMemo(() => {
    return cart.reduce((map, item) => {
      const key = String(item.id || "").replace(/^addon-/, "");
      return {
        ...map,
        [key]: (map[key] || 0) + (item.quantity || 1)
      };
    }, {});
  }, [cart]);
  const sortedToppings = useMemo(() => [...toppings].sort((first, second) => Number(second.price || 0) - Number(first.price || 0)), [toppings]);
  const displayCategories = useMemo(() => {
    const allLabel = "Tất cả";
    const cleaned = (categories || []).map(item => String(item || "").trim()).filter(Boolean);
    const withoutAll = cleaned.filter(item => item !== allLabel);
    return cleaned.includes(allLabel) ? [allLabel, ...withoutAll] : cleaned;
  }, [categories]);
  const removeOneByKey = rawKey => {
    const key = String(rawKey || "").replace(/^addon-/, "");
    setCart(items => {
      const index = items.findIndex(item => String(item.id || "").replace(/^addon-/, "") === key);
      if (index < 0) return items;
      const next = [...items];
      const item = next[index];
      if ((item.quantity || 1) > 1) {
        const quantity = item.quantity - 1;
        next[index] = {
          ...item,
          quantity,
          lineTotal: item.unitTotal * quantity
        };
      } else {
        next.splice(index, 1);
      }
      return next;
    });
  };
  const addToppingAsItem = topping => {
    addToCart({
      product: {
        id: `addon-${topping.id}`,
        name: topping.name,
        short: menuText.addonShort,
        description: menuText.addonDescription,
        price: Number(topping.price) || 0,
        category: suggestText.addonSpice,
        badge: "Topping",
        image: topping.image || productSeed[0].image
      },
      spice: menuText.addonSpice,
      toppings: [],
      note: menuText.addonNote,
      quantity: 1
    });
  };
  return /*#__PURE__*/_jsxs("section", {
    children: [/*#__PURE__*/_jsx(AppHeader, {
      title: menuText.title,
      onBack: () => navigate("home", "home")
    }), /*#__PURE__*/_jsxs("div", {
      className: "space-y-4 px-4 pb-32",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "menu-sticky-tools",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "menu-search",
          children: [/*#__PURE__*/_jsx(Icon, {
            name: "search",
            size: 17
          }), /*#__PURE__*/_jsx("input", {
            className: "min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-brown/35",
            placeholder: menuText.searchPlaceholder
          })]
        }), /*#__PURE__*/_jsx("div", {
          className: "menu-chip-row-wrap",
          children: /*#__PURE__*/_jsx("div", {
            className: "no-scrollbar menu-chip-row",
            children: displayCategories.map((category, index) => /*#__PURE__*/_jsx("button", {
              onClick: () => setActiveCategory(category),
              className: `chip ${activeCategory === category ? "chip-active" : ""} ${index === 0 && category === "Tất cả" ? "chip-pinned-all" : ""}`,
              children: category
            }, category))
          })
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "grid grid-cols-2 gap-3",
        children: filteredProducts.map(product => /*#__PURE__*/_jsx(ProductCard, {
          product: product,
          selectedCount: cartProductCount[product.id] || 0,
          onOpen: openProduct,
          onAdd: openOptionModal,
          onRemove: () => removeOneByKey(product.id)
        }, product.id))
      }), /*#__PURE__*/_jsxs("div", {
        className: "menu-addon-section",
        children: [/*#__PURE__*/_jsxs("div", {
          className: "flex items-end justify-between gap-3",
          children: [/*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("p", {
              children: menuText.addonSectionEyebrow
            }), /*#__PURE__*/_jsx("h2", {
              children: menuText.addonSectionTitle
            })]
          }), /*#__PURE__*/_jsx("span", {
            children: menuText.addonSectionHint
          })]
        }), /*#__PURE__*/_jsx("div", {
          className: "no-scrollbar menu-addon-scroll",
          children: sortedToppings.map(topping => /*#__PURE__*/_jsx(ToppingMenuCard, {
            topping: topping,
            onAdd: () => addToppingAsItem(topping),
            onRemove: () => removeOneByKey(topping.id),
            selectedCount: cartProductCount[topping.id] || 0
          }, topping.id))
        })]
      })]
    })]
  });
}