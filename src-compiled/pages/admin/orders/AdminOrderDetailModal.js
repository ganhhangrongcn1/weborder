import { formatMoney } from "../../../utils/format.js";
import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export default function AdminOrderDetailModal({
  order,
  onClose
}) {
  const items = order.items || [];
  const subtotalValue = Number(order.subtotal ?? items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0));
  const shippingFee = Number(order.shippingFee ?? order.deliveryFee ?? 0);
  const totalValue = Number(order.totalAmount || order.total || 0);
  const isPickupOrder = String(order.fulfillmentType || "").toLowerCase() === "pickup";
  return /*#__PURE__*/_jsx("div", {
    className: "admin-modal-backdrop",
    onClick: onClose,
    children: /*#__PURE__*/_jsxs("section", {
      className: "admin-product-modal",
      onClick: event => event.stopPropagation(),
      children: [/*#__PURE__*/_jsxs("div", {
        className: "admin-product-modal-head",
        children: [/*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsxs("h2", {
            children: ["Chi ti\u1EBFt \u0111\u01A1n ", order.orderCode || order.id]
          }), /*#__PURE__*/_jsxs("p", {
            children: [order.customerName || "Khách", " \u2022 ", order.customerPhone || order.phone || "--"]
          })]
        }), /*#__PURE__*/_jsx("button", {
          onClick: onClose,
          children: "X"
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-product-form",
        children: [/*#__PURE__*/_jsxs("label", {
          children: ["T\u1ED5ng ti\u1EC1n", /*#__PURE__*/_jsx("input", {
            value: formatMoney(totalValue),
            readOnly: true
          })]
        }), /*#__PURE__*/_jsxs("label", {
          children: ["Th\u1EDDi gian", /*#__PURE__*/_jsx("input", {
            value: order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : "--",
            readOnly: true
          })]
        }), /*#__PURE__*/_jsxs("label", {
          className: "wide",
          children: ["\u0110\u1ECBa ch\u1EC9", /*#__PURE__*/_jsx("input", {
            value: order.deliveryAddress || order.branchAddress || "--",
            readOnly: true
          })]
        }), /*#__PURE__*/_jsxs("div", {
          className: "admin-option-section",
          children: [/*#__PURE__*/_jsx("div", {
            className: "admin-option-head",
            children: /*#__PURE__*/_jsx("h3", {
              children: "M\xF3n trong \u0111\u01A1n"
            })
          }), items.map((item, index) => /*#__PURE__*/_jsxs("div", {
            className: "admin-option-group",
            children: [/*#__PURE__*/_jsxs("div", {
              className: "admin-option-group-row",
              children: [/*#__PURE__*/_jsx("strong", {
                children: item.name
              }), /*#__PURE__*/_jsxs("span", {
                children: ["x", item.quantity || 1]
              }), /*#__PURE__*/_jsx("span", {
                children: formatMoney(Number(item.lineTotal || 0))
              })]
            }), (item.toppings || []).length > 0 && /*#__PURE__*/_jsx("div", {
              className: "admin-option-item-row",
              children: /*#__PURE__*/_jsx("small", {
                children: (item.toppings || []).map(topping => `${topping.name}${topping.quantity ? ` x${topping.quantity}` : ""}`).join(", ")
              })
            })]
          }, `${item.id || item.name}-${index}`)), /*#__PURE__*/_jsxs("div", {
            className: "admin-option-group",
            children: [/*#__PURE__*/_jsxs("div", {
              className: "admin-option-group-row",
              children: [/*#__PURE__*/_jsx("strong", {
                children: "T\u1EA1m t\xEDnh m\xF3n"
              }), /*#__PURE__*/_jsx("span", {
                children: formatMoney(subtotalValue)
              })]
            }), /*#__PURE__*/_jsxs("div", {
              className: "admin-option-group-row",
              children: [/*#__PURE__*/_jsx("strong", {
                children: "Ph\xED giao h\xE0ng"
              }), /*#__PURE__*/_jsx("span", {
                children: isPickupOrder ? "0đ (Tự đến lấy)" : formatMoney(shippingFee)
              })]
            }), /*#__PURE__*/_jsxs("div", {
              className: "admin-option-group-row",
              children: [/*#__PURE__*/_jsx("strong", {
                children: "Th\xE0nh ti\u1EC1n"
              }), /*#__PURE__*/_jsx("span", {
                children: formatMoney(totalValue)
              })]
            })]
          })]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "admin-modal-actions",
        children: [/*#__PURE__*/_jsx("span", {}), /*#__PURE__*/_jsx("button", {
          className: "admin-secondary",
          onClick: onClose,
          children: "\u0110\xF3ng"
        })]
      })]
    })
  });
}