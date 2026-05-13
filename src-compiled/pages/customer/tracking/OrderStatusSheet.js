import { Fragment } from "react";
import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.js";
import { formatMoney } from "../../../utils/format.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function OrderStatusSheet({
  order,
  step,
  formatOrderTime,
  canViewFullOrderCode,
  maskOrderCode,
  onClose
}) {
  const orderItems = order.items || [];
  const subtotalValue = Number(order.subtotal ?? orderItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0));
  const originalShippingFee = Number(order.originalShippingFee ?? order.shippingFee ?? order.deliveryFee ?? 0);
  const shippingSupportDiscount = Number(order.shippingSupportDiscount || 0);
  const shippingFee = Number(order.shippingFee ?? order.deliveryFee ?? 0);
  const promoDiscount = Number(order.promoDiscount || 0);
  const pointsDiscount = Number(order.pointsDiscount || 0);
  const totalValue = Number(order.totalAmount || order.total || 0);
  const isPickupOrder = order.fulfillmentType === "pickup";
  const deliveryStep = {
    title: "Đang giao",
    text: "Đơn đang được giao đến bạn, vui lòng để ý điện thoại nhé."
  };
  const steps = [{
    title: "Đã xác nhận",
    text: "Quán đã nhận thông tin đơn hàng của bạn."
  }, {
    title: "Đang làm",
    text: "Bếp đang chuẩn bị món, bạn chờ một chút nhé."
  }, ...(!isPickupOrder ? [deliveryStep] : []), {
    title: "Hoàn thành",
    text: "Đơn hàng đã hoàn tất."
  }];
  return /*#__PURE__*/_jsxs(CustomerBottomSheet, {
    ariaLabel: "Tr\u1EA1ng th\xE1i \u0111\u01A1n h\xE0ng",
    onClose: onClose,
    className: "promo-sheet",
    showHeader: false,
    children: [/*#__PURE__*/_jsxs("div", {
      className: "flex items-start justify-between gap-3",
      children: [/*#__PURE__*/_jsxs("div", {
        children: [/*#__PURE__*/_jsx("p", {
          className: "text-xs font-bold text-brown/50",
          children: formatOrderTime(order.createdAt)
        }), /*#__PURE__*/_jsx("h2", {
          className: "mt-1 text-xl font-black text-brown",
          children: canViewFullOrderCode ? order.orderCode : maskOrderCode(order.orderCode)
        }), /*#__PURE__*/_jsxs("p", {
          className: "mt-1 text-sm text-brown/60",
          children: [(order.items || []).length, " m\xF3n \xB7 ", formatMoney(order.totalAmount || 0)]
        })]
      }), /*#__PURE__*/_jsx("button", {
        onClick: onClose,
        className: "grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-brown shadow-sm",
        children: "\xD7"
      })]
    }), /*#__PURE__*/_jsx("div", {
      className: "mt-5 space-y-4 rounded-[24px] bg-white p-4 shadow-soft",
      children: steps.map((item, index) => {
        const active = index <= step;
        const current = index === step;
        return /*#__PURE__*/_jsxs("div", {
          className: "flex items-start gap-3",
          children: [/*#__PURE__*/_jsx("span", {
            className: `mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-sm font-black ${active ? "bg-orange-600 text-white" : "bg-cream text-brown/35"}`,
            children: active ? "✓" : index + 1
          }), /*#__PURE__*/_jsxs("div", {
            className: "min-w-0 flex-1",
            children: [/*#__PURE__*/_jsxs("div", {
              className: "flex items-center gap-2",
              children: [/*#__PURE__*/_jsx("strong", {
                className: "text-sm text-brown",
                children: item.title
              }), current && /*#__PURE__*/_jsx("span", {
                className: "rounded-full bg-orange-50 px-2 py-1 text-[10px] font-black uppercase text-orange-600",
                children: "Hi\u1EC7n t\u1EA1i"
              })]
            }), /*#__PURE__*/_jsx("p", {
              className: "mt-1 text-xs leading-5 text-brown/55",
              children: item.text
            })]
          })]
        }, item.title);
      })
    }), /*#__PURE__*/_jsxs("div", {
      className: "order-detail-box",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "order-detail-head",
        children: [/*#__PURE__*/_jsx("h3", {
          children: "Chi ti\u1EBFt \u0111\u01A1n"
        }), /*#__PURE__*/_jsxs("span", {
          children: [orderItems.length, " m\xF3n"]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "order-info-grid",
        children: [/*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("span", {
            children: "H\xECnh th\u1EE9c"
          }), /*#__PURE__*/_jsx("strong", {
            children: isPickupOrder ? "Tự đến lấy" : "Giao tận nơi"
          })]
        }), /*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsx("span", {
            children: "Thanh to\xE1n"
          }), /*#__PURE__*/_jsx("strong", {
            children: order.paymentMethod || "COD"
          })]
        }), isPickupOrder ? /*#__PURE__*/_jsxs(Fragment, {
          children: [/*#__PURE__*/_jsxs("div", {
            className: "wide",
            children: [/*#__PURE__*/_jsx("span", {
              children: "Chi nh\xE1nh l\u1EA5y"
            }), /*#__PURE__*/_jsx("strong", {
              children: order.branchName || "Gánh Hàng Rong"
            }), /*#__PURE__*/_jsx("small", {
              children: order.branchAddress
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "wide",
            children: [/*#__PURE__*/_jsx("span", {
              children: "Gi\u1EDD l\u1EA5y"
            }), /*#__PURE__*/_jsx("strong", {
              children: order.pickupTimeText || "Sớm nhất"
            })]
          })]
        }) : /*#__PURE__*/_jsxs(Fragment, {
          children: [/*#__PURE__*/_jsxs("div", {
            className: "wide",
            children: [/*#__PURE__*/_jsx("span", {
              children: "Ng\u01B0\u1EDDi nh\u1EADn"
            }), /*#__PURE__*/_jsxs("strong", {
              children: [order.customerName || "Khách", " - ", order.customerPhone || order.phone || ""]
            })]
          }), /*#__PURE__*/_jsxs("div", {
            className: "wide",
            children: [/*#__PURE__*/_jsx("span", {
              children: "\u0110\u1ECBa ch\u1EC9"
            }), /*#__PURE__*/_jsx("strong", {
              children: canViewFullOrderCode ? order.deliveryAddress || "Chưa có địa chỉ" : "Địa chỉ đã được ẩn"
            })]
          }), /*#__PURE__*/_jsxs("div", {
            children: [/*#__PURE__*/_jsx("span", {
              children: "Kho\u1EA3ng c\xE1ch"
            }), /*#__PURE__*/_jsx("strong", {
              children: order.distanceKm ? `${Number(order.distanceKm).toFixed(1)}km` : "Chưa rõ"
            })]
          })]
        })]
      }), /*#__PURE__*/_jsx("div", {
        className: "order-detail-list",
        children: orderItems.map(item => {
          const options = [item.spice, ...(item.toppings || []).map(topping => topping.name), item.note ? `Ghi chú: ${item.note}` : ""].filter(Boolean);
          const lineTotal = item.lineTotal || (item.unitTotal || item.price || 0) * (item.quantity || 1);
          return /*#__PURE__*/_jsxs("div", {
            className: "order-detail-item",
            children: [/*#__PURE__*/_jsxs("div", {
              children: [/*#__PURE__*/_jsx("strong", {
                children: item.name
              }), /*#__PURE__*/_jsxs("span", {
                children: ["x", item.quantity || 1]
              }), options.length > 0 && /*#__PURE__*/_jsx("p", {
                children: options.join(" · ")
              })]
            }), /*#__PURE__*/_jsx("em", {
              children: formatMoney(lineTotal)
            })]
          }, item.cartId || `${order.orderCode}-${item.id}-${item.name}`);
        })
      }), /*#__PURE__*/_jsxs("div", {
        className: "order-detail-total",
        children: [/*#__PURE__*/_jsx("span", {
          children: "T\u1EA1m t\xEDnh"
        }), /*#__PURE__*/_jsx("strong", {
          children: formatMoney(subtotalValue)
        })]
      }), !isPickupOrder && /*#__PURE__*/_jsxs("div", {
        className: "order-detail-total compact",
        children: [/*#__PURE__*/_jsxs("span", {
          children: ["Ph\xED giao h\xE0ng", order.distanceKm ? ` (${Number(order.distanceKm).toFixed(1)}km)` : ""]
        }), /*#__PURE__*/_jsx("strong", {
          children: shippingSupportDiscount > 0 ? /*#__PURE__*/_jsxs(Fragment, {
            children: [/*#__PURE__*/_jsx("s", {
              children: formatMoney(originalShippingFee)
            }), " ", formatMoney(shippingFee)]
          }) : formatMoney(shippingFee)
        })]
      }), shippingSupportDiscount > 0 && /*#__PURE__*/_jsxs("div", {
        className: "order-detail-total discount",
        children: [/*#__PURE__*/_jsx("span", {
          children: "GHR h\u1ED7 tr\u1EE3 ph\xED ship"
        }), /*#__PURE__*/_jsxs("strong", {
          children: ["-", formatMoney(shippingSupportDiscount)]
        })]
      }), promoDiscount > 0 && /*#__PURE__*/_jsxs("div", {
        className: "order-detail-total discount",
        children: [/*#__PURE__*/_jsxs("span", {
          children: ["M\xE3 gi\u1EA3m gi\xE1 ", order.promoCode || ""]
        }), /*#__PURE__*/_jsxs("strong", {
          children: ["-", formatMoney(promoDiscount)]
        })]
      }), pointsDiscount > 0 && /*#__PURE__*/_jsxs("div", {
        className: "order-detail-total discount",
        children: [/*#__PURE__*/_jsx("span", {
          children: "D\xF9ng \u0111i\u1EC3m th\u01B0\u1EDFng"
        }), /*#__PURE__*/_jsxs("strong", {
          children: ["-", formatMoney(pointsDiscount)]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "order-detail-total grand",
        children: [/*#__PURE__*/_jsx("span", {
          children: "T\u1ED5ng thanh to\xE1n"
        }), /*#__PURE__*/_jsx("strong", {
          children: formatMoney(totalValue)
        })]
      })]
    })]
  });
}