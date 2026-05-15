import Icon from "../../../components/Icon.js";
import { formatMoney } from "../../../utils/format.js";
import { spiceLevels } from "../../../constants/storeConfig.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function OptionGroup({
  title,
  children
}) {
  return /*#__PURE__*/_jsxs("div", {
    children: [/*#__PURE__*/_jsx("h2", {
      className: "label",
      children: title
    }), /*#__PURE__*/_jsx("div", {
      className: "mt-3 flex flex-wrap gap-2",
      children: children
    })]
  });
}
export default function ProductDetailModal({
  navigate,
  selectedProduct,
  selectedSpice,
  setSelectedSpice,
  selectedToppings,
  setSelectedToppings,
  quantity,
  setQuantity,
  addToCart,
  toppings
}) {
  const badgeText = String(selectedProduct?.badge || "").trim();
  const toppingTotal = selectedToppings.reduce((sum, topping) => sum + topping.price, 0);
  const total = (selectedProduct.price + toppingTotal) * quantity;
  function toggleTopping(topping) {
    setSelectedToppings(current => current.some(item => item.id === topping.id) ? current.filter(item => item.id !== topping.id) : [...current, topping]);
  }
  return /*#__PURE__*/_jsxs("section", {
    className: "pb-5",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "relative",
      children: [/*#__PURE__*/_jsx("img", {
        src: selectedProduct.image,
        alt: selectedProduct.name,
        className: "h-72 w-full rounded-b-[34px] object-cover"
      }), /*#__PURE__*/_jsxs("div", {
        className: "absolute inset-x-4 top-4 flex items-center justify-between",
        children: [/*#__PURE__*/_jsx("button", {
          onClick: () => navigate("menu", "menu"),
          className: "float-btn",
          children: "\u2039"
        }), /*#__PURE__*/_jsxs("div", {
          className: "flex gap-2",
          children: [/*#__PURE__*/_jsx("button", {
            "aria-label": "Chia s\u1EBB",
            className: "float-btn",
            children: /*#__PURE__*/_jsx(Icon, {
              name: "share",
              size: 18
            })
          }), /*#__PURE__*/_jsx("button", {
            "aria-label": "Y\xEAu th\xEDch",
            className: "float-btn text-orange-600",
            children: /*#__PURE__*/_jsx(Icon, {
              name: "heart",
              size: 18
            })
          })]
        })]
      }), badgeText ? /*#__PURE__*/_jsx("span", {
        className: "absolute bottom-4 left-4 rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase text-white",
        children: badgeText
      }) : null]
    }), /*#__PURE__*/_jsxs("div", {
      className: "space-y-5 px-4 pt-5",
      children: [/*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsxs("div", {
          className: "mb-2 inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-600",
          children: ["\u0110\xE3 b\xE1n ", selectedProduct.sold]
        }), /*#__PURE__*/_jsx("h1", {
          className: "text-2xl font-black leading-tight text-brown",
          children: selectedProduct.name
        }), /*#__PURE__*/_jsx("p", {
          className: "mt-2 text-sm font-semibold text-brown/60",
          children: selectedProduct.description
        }), /*#__PURE__*/_jsxs("p", {
          className: "mt-3 flex items-center gap-1 text-sm font-bold text-brown/70",
          children: [/*#__PURE__*/_jsx(Icon, {
            name: "star",
            size: 16,
            className: "text-orange-500"
          }), " ", selectedProduct.rating, " (", selectedProduct.reviews, ") \xB7 \u0110\xE3 b\xE1n ", selectedProduct.sold]
        })]
      }), /*#__PURE__*/_jsx(OptionGroup, {
        title: "Ch\u1ECDn v\u1ECB",
        children: spiceLevels.map(level => /*#__PURE__*/_jsx("button", {
          onClick: () => setSelectedSpice(level),
          className: `option ${selectedSpice === level ? "option-active" : ""}`,
          children: level
        }, level))
      }), /*#__PURE__*/_jsx(OptionGroup, {
        title: "Topping th\xEAm",
        children: /*#__PURE__*/_jsx("div", {
          className: "no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1",
          children: toppings.map(topping => {
            const active = selectedToppings.some(item => item.id === topping.id);
            return /*#__PURE__*/_jsxs("button", {
              onClick: () => toggleTopping(topping),
              className: `topping-card ${active ? "topping-active" : ""}`,
              children: ["+ ", topping.name, /*#__PURE__*/_jsx("span", {
                children: formatMoney(topping.price)
              })]
            }, topping.id);
          })
        })
      }), /*#__PURE__*/_jsxs("label", {
        className: "block",
        children: [/*#__PURE__*/_jsx("span", {
          className: "label",
          children: "Ghi ch\xFA"
        }), /*#__PURE__*/_jsx("input", {
          className: "input",
          placeholder: "V\xED d\u1EE5: Kh\xF4ng h\xE0nh, \xEDt cay,..."
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "flex items-center justify-between",
        children: [/*#__PURE__*/_jsx("span", {
          className: "label",
          children: "S\u1ED1 l\u01B0\u1EE3ng"
        }), /*#__PURE__*/_jsxs("div", {
          className: "flex items-center gap-3",
          children: [/*#__PURE__*/_jsx("button", {
            onClick: () => setQuantity(Math.max(1, quantity - 1)),
            className: "qty-btn",
            children: "-"
          }), /*#__PURE__*/_jsx("span", {
            className: "w-8 text-center font-black",
            children: quantity
          }), /*#__PURE__*/_jsx("button", {
            onClick: () => setQuantity(quantity + 1),
            className: "qty-btn text-orange-600",
            children: "+"
          })]
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "grid grid-cols-4 gap-2",
        children: ["Freeship", "An toàn", "30-45 phút", "Đổi trả"].map(text => /*#__PURE__*/_jsx("div", {
          className: "rounded-2xl bg-white px-2 py-3 text-center text-[11px] font-bold text-brown/65 shadow-soft",
          children: text
        }, text))
      })]
    }), /*#__PURE__*/_jsx("div", {
      className: "sticky bottom-[72px] z-30 mt-5 bg-gradient-to-t from-cream via-cream px-4 pt-4",
      children: /*#__PURE__*/_jsxs("button", {
        onClick: () => addToCart(selectedProduct, selectedSpice, selectedToppings, quantity),
        className: "cta w-full",
        children: ["Th\xEAm v\xE0o gi\u1ECF - ", formatMoney(total)]
      })
    })]
  });
}