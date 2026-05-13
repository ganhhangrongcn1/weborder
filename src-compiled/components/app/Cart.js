import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Cart({
  cart,
  setCart,
  updateQty,
  onEditItem,
  isEditableItem,
  CheckoutCard,
  addonCategory,
  formatMoney,
  Icon
}) {
  const getToppingRows = item => {
    const rows = {};
    (item.toppings || []).forEach(topping => {
      const key = topping.id || topping.name;
      rows[key] = rows[key] || {
        name: topping.name,
        quantity: 0
      };
      rows[key].quantity += Number(topping.quantity || 1);
    });
    return Object.values(rows);
  };
  return /*#__PURE__*/_jsx(CheckoutCard, {
    title: "M\xF3n \u0111\xE3 ch\u1ECDn",
    action: cart.length ? "Xóa tất cả" : "",
    onAction: () => setCart([]),
    children: /*#__PURE__*/_jsx("div", {
      className: "space-y-3",
      children: cart.map(item => /*#__PURE__*/_jsxs("div", {
        onClick: () => {
          if (isEditableItem?.(item)) onEditItem?.(item);
        },
        className: `checkout-cart-item ${item.category === addonCategory ? "checkout-cart-addon" : ""}`,
        style: {
          cursor: isEditableItem?.(item) ? "pointer" : "default"
        },
        children: [item.category !== addonCategory && /*#__PURE__*/_jsx("img", {
          src: item.image,
          alt: item.name
        }), /*#__PURE__*/_jsxs("div", {
          className: "min-w-0 flex-1",
          children: [/*#__PURE__*/_jsx("h3", {
            children: item.name
          }), /*#__PURE__*/_jsx("span", {
            className: "checkout-spice-pill",
            children: item.autoGiftByPromo ? "Quà tặng" : item.spice
          }), getToppingRows(item).length > 0 && /*#__PURE__*/_jsx("div", {
            className: "checkout-topping-list",
            children: getToppingRows(item).map(topping => /*#__PURE__*/_jsxs("span", {
              children: [/*#__PURE__*/_jsx("em", {
                children: topping.name
              }), /*#__PURE__*/_jsxs("strong", {
                children: ["x", topping.quantity]
              })]
            }, topping.name))
          }), item.note && /*#__PURE__*/_jsxs("div", {
            className: "checkout-note-pill",
            children: ["Ghi ch\xFA: ", item.note]
          }), /*#__PURE__*/_jsxs("div", {
            className: "mt-2 flex items-center justify-between gap-2",
            children: [item.autoGiftByPromo ? /*#__PURE__*/_jsx("div", {
              className: "text-xs text-brown/60",
              children: "T\u1EF1 \u0111\u1ED9ng th\xEAm khi \u0111\u1EE7 m\u1ED1c"
            }) : /*#__PURE__*/_jsxs("div", {
              className: "flex items-center gap-2",
              children: [/*#__PURE__*/_jsx("button", {
                onClick: event => {
                  event.stopPropagation();
                  updateQty(item.cartId, -1);
                },
                className: "qty-btn",
                children: "-"
              }), /*#__PURE__*/_jsx("span", {
                className: "w-5 text-center text-sm font-black",
                children: item.quantity
              }), /*#__PURE__*/_jsx("button", {
                onClick: event => {
                  event.stopPropagation();
                  updateQty(item.cartId, 1);
                },
                className: "qty-btn text-orange-600",
                children: "+"
              })]
            }), /*#__PURE__*/_jsxs("div", {
              className: "text-right",
              children: [item.autoGiftByPromo && Number(item.originalLineTotal || 0) > 0 ? /*#__PURE__*/_jsx("div", {
                className: "text-[11px] text-brown/40 line-through",
                children: formatMoney(item.originalLineTotal)
              }) : null, /*#__PURE__*/_jsx("strong", {
                children: formatMoney(item.lineTotal)
              })]
            })]
          })]
        }), item.autoGiftByPromo ? null : /*#__PURE__*/_jsx("button", {
          onClick: event => {
            event.stopPropagation();
            setCart(items => items.filter(cartItem => cartItem.cartId !== item.cartId));
          },
          className: "checkout-remove",
          "aria-label": `Xóa ${item.name}`,
          children: /*#__PURE__*/_jsx(Icon, {
            name: "trash",
            size: 15
          })
        })]
      }, item.cartId))
    })
  });
}