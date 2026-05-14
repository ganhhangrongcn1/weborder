import { formatMoney } from "../../../utils/format.js";
import CheckoutCard from "./CheckoutCard.js";
import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export default function CheckoutTotalCard({
  subtotal,
  originalSubtotal = subtotal,
  giftSavingAmount = 0,
  ship,
  originalShip = ship,
  shippingSupportDiscount = 0,
  shippingSupportMax = 0,
  customerExtraShip = 0,
  supportShippingEnabled = false,
  total,
  count,
  promoDiscount,
  promoCode,
  pointsDiscount,
  fulfillmentType,
  distanceKm,
  onShowDeliveryFee
}) {
  const isPickup = fulfillmentType === "pickup";
  const displayedShippingFee = isPickup ? 0 : ship;
  const rawShippingFee = isPickup ? 0 : originalShip;
  const appliedSupportMax = Math.max(0, Number(shippingSupportMax || 0));
  const displayedSubtotal = Number(subtotal || 0);
  const displayedOriginalSubtotal = Math.max(displayedSubtotal, Number(originalSubtotal || displayedSubtotal));
  const hasSubtotalDiscount = displayedOriginalSubtotal > displayedSubtotal;
  const originalTotal = displayedOriginalSubtotal + rawShippingFee;
  const savingOriginalTotal = originalTotal + Math.max(0, Number(giftSavingAmount || 0));
  const savedAmount = Math.max(savingOriginalTotal - total, 0);
  return /*#__PURE__*/_jsx(CheckoutCard, {
    title: "T\u1ED5ng c\u1ED9ng",
    children: /*#__PURE__*/_jsxs("div", {
      className: "checkout-total-summary",
      children: [/*#__PURE__*/_jsxs("div", {
        className: "summary-line",
        children: [/*#__PURE__*/_jsxs("span", {
          children: ["T\u1ED5ng t\u1EA1m t\xEDnh (", count, " m\xF3n)"]
        }), /*#__PURE__*/_jsxs("strong", {
          className: "flex flex-col items-end leading-tight",
          children: [/*#__PURE__*/_jsx("span", {
            children: formatMoney(displayedSubtotal)
          }), hasSubtotalDiscount ? /*#__PURE__*/_jsx("del", {
            className: "text-xs font-semibold text-brown/35",
            children: formatMoney(displayedOriginalSubtotal)
          }) : null]
        })]
      }), /*#__PURE__*/_jsxs("div", {
        className: "summary-line",
        children: [/*#__PURE__*/_jsxs("span", {
          children: ["Ph\xED giao h\xE0ng ", !isPickup && distanceKm ? `(${distanceKm.toFixed(1)}km)` : "", " ", /*#__PURE__*/_jsx("button", {
            type: "button",
            onClick: onShowDeliveryFee,
            className: "fee-info-btn",
            children: "i"
          })]
        }), /*#__PURE__*/_jsx("strong", {
          children: isPickup ? "Không tính phí giao hàng" : shippingSupportDiscount > 0 ? /*#__PURE__*/_jsxs("span", {
            className: "flex items-center gap-2",
            children: [/*#__PURE__*/_jsx("span", {
              children: formatMoney(displayedShippingFee)
            }), /*#__PURE__*/_jsx("del", {
              className: "text-brown/35",
              children: formatMoney(rawShippingFee)
            })]
          }) : formatMoney(displayedShippingFee)
        })]
      }), shippingSupportDiscount > 0 ? /*#__PURE__*/_jsxs("div", {
        className: "summary-line discount-line",
        children: [/*#__PURE__*/_jsxs("span", {
          children: [/*#__PURE__*/_jsx("i", {}), " GHR h\u1ED7 tr\u1EE3 ph\xED ship"]
        }), /*#__PURE__*/_jsxs("strong", {
          children: ["-", formatMoney(shippingSupportDiscount)]
        })]
      }) : null, !isPickup && supportShippingEnabled && appliedSupportMax > 0 ? /*#__PURE__*/_jsxs("div", {
        className: "mt-[-4px] mb-1 text-[10px] leading-4 text-brown/45",
        children: [/*#__PURE__*/_jsx("span", {
          children: "M\u1EE9c h\u1ED7 tr\u1EE3 t\u1ED1i \u0111a: "
        }), /*#__PURE__*/_jsx("span", {
          className: "font-medium",
          children: formatMoney(appliedSupportMax)
        })]
      }) : null, !isPickup && customerExtraShip > 0 ? /*#__PURE__*/_jsxs("div", {
        className: "summary-line",
        children: [/*#__PURE__*/_jsx("span", {
          children: "Ph\u1EA7n ph\xED ship kh\xE1ch tr\u1EA3 th\xEAm"
        }), /*#__PURE__*/_jsx("strong", {
          children: formatMoney(customerExtraShip)
        })]
      }) : null, promoDiscount > 0 ? /*#__PURE__*/_jsxs("div", {
        className: "summary-line discount-line",
        children: [/*#__PURE__*/_jsxs("span", {
          children: [/*#__PURE__*/_jsx("i", {}), " ", promoCode ? `Ưu đãi ${promoCode}` : "Mã khuyến mãi"]
        }), /*#__PURE__*/_jsxs("strong", {
          children: ["-", formatMoney(promoDiscount)]
        })]
      }) : null, pointsDiscount > 0 ? /*#__PURE__*/_jsxs("div", {
        className: "summary-line discount-line",
        children: [/*#__PURE__*/_jsxs("span", {
          children: [/*#__PURE__*/_jsx("i", {}), " D\xF9ng \u0111i\u1EC3m th\u01B0\u1EDFng"]
        }), /*#__PURE__*/_jsxs("strong", {
          children: ["-", formatMoney(pointsDiscount)]
        })]
      }) : null, /*#__PURE__*/_jsxs("div", {
        className: "summary-final",
        children: [/*#__PURE__*/_jsx("span", {
          children: "T\u1ED5ng c\u1ED9ng"
        }), /*#__PURE__*/_jsxs("strong", {
          className: "flex flex-col items-end leading-tight",
          children: [/*#__PURE__*/_jsx("span", {
            children: formatMoney(total)
          }), originalTotal > total ? /*#__PURE__*/_jsx("del", {
            className: "text-sm font-semibold text-brown/35",
            children: formatMoney(originalTotal)
          }) : null]
        })]
      }), savedAmount > 0 ? /*#__PURE__*/_jsxs("div", {
        className: "summary-saving",
        children: [/*#__PURE__*/_jsxs("span", {
          children: ["B\u1EA1n ti\u1EBFt ki\u1EC7m \u0111\u01B0\u1EE3c ", formatMoney(savedAmount)]
        }), /*#__PURE__*/_jsx("del", {
          children: formatMoney(savingOriginalTotal)
        })]
      }) : null]
    })
  });
}