import Icon from "../../../components/Icon.js";
import CheckoutMilestoneSuggest from "./CheckoutMilestoneSuggest.js";
import CheckoutCard from "./CheckoutCard.js";
import CheckoutTotalCard from "./CheckoutTotalCard.js";
import { formatMoney } from "../../../utils/format.js";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
export default function CheckoutPricingSection({
  subtotal,
  addToCart,
  openOptionModal,
  products,
  toppings,
  coupons,
  smartPromotions,
  selectedPromo,
  setSelectedPromo,
  setIsPromoModalOpen,
  availablePoints,
  usePoints,
  setUsePoints,
  pointsDiscount,
  earnedPreviewPoints,
  originalSubtotal,
  giftSavingAmount,
  checkoutShip,
  baseCheckoutShip,
  autoShipSupport,
  configSupportLimit,
  customerExtraShip,
  shippingConfig,
  checkoutTotal,
  cart,
  promoDiscount,
  fulfillmentType,
  deliveryDistanceKm,
  setIsDeliveryFeeModalOpen
}) {
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsx(CheckoutMilestoneSuggest, {
      subtotal: subtotal,
      addToCart: addToCart,
      openOptionModal: openOptionModal,
      products: products,
      toppings: toppings,
      coupons: coupons,
      smartPromotions: smartPromotions
    }), /*#__PURE__*/_jsx(CheckoutCard, {
      title: "Khuy\u1EBFn m\xE3i",
      children: /*#__PURE__*/_jsxs("button", {
        onClick: () => setIsPromoModalOpen(true),
        className: "promo-select",
        children: [selectedPromo ? `${selectedPromo.code} · -${formatMoney(selectedPromo.discount)}` : "Chọn mã khuyến mãi", " ", /*#__PURE__*/_jsx("span", {
          children: "\u203A"
        })]
      })
    }), /*#__PURE__*/_jsx(CheckoutCard, {
      title: "D\xF9ng \u0111i\u1EC3m th\u01B0\u1EDFng",
      children: /*#__PURE__*/_jsxs("div", {
        className: "points-row",
        children: [/*#__PURE__*/_jsxs("div", {
          children: [/*#__PURE__*/_jsxs("strong", {
            children: ["B\u1EA1n c\xF3 ", availablePoints.toLocaleString("vi-VN"), " \u0111i\u1EC3m"]
          }), /*#__PURE__*/_jsx("span", {
            children: usePoints ? `Đã áp dụng -${formatMoney(pointsDiscount)} vào đơn hàng` : `Bạn sẽ nhận được +${earnedPreviewPoints} điểm khi đặt đơn`
          })]
        }), /*#__PURE__*/_jsx("input", {
          type: "checkbox",
          checked: usePoints,
          onChange: event => setUsePoints(event.target.checked),
          className: "toggle-input"
        })]
      })
    }), /*#__PURE__*/_jsx(CheckoutCard, {
      title: "Ph\u01B0\u01A1ng th\u1EE9c thanh to\xE1n",
      children: /*#__PURE__*/_jsxs("button", {
        className: "payment-card active",
        children: [/*#__PURE__*/_jsx(Icon, {
          name: "bag",
          size: 18
        }), /*#__PURE__*/_jsxs("span", {
          children: [/*#__PURE__*/_jsx("strong", {
            children: "Ti\u1EC1n m\u1EB7t (COD)"
          }), /*#__PURE__*/_jsx("small", {
            children: "Thanh to\xE1n khi nh\u1EADn h\xE0ng"
          })]
        })]
      })
    }), /*#__PURE__*/_jsx(CheckoutTotalCard, {
      subtotal: subtotal,
      originalSubtotal: originalSubtotal,
      giftSavingAmount: giftSavingAmount,
      ship: checkoutShip,
      originalShip: baseCheckoutShip,
      shippingSupportDiscount: autoShipSupport,
      shippingSupportMax: configSupportLimit,
      customerExtraShip: customerExtraShip,
      supportShippingEnabled: Boolean(shippingConfig.supportShippingEnabled),
      total: checkoutTotal,
      count: cart.reduce((sum, item) => sum + item.quantity, 0),
      promoDiscount: promoDiscount,
      promoCode: selectedPromo?.code,
      pointsDiscount: pointsDiscount,
      fulfillmentType: fulfillmentType,
      distanceKm: deliveryDistanceKm,
      onShowDeliveryFee: () => setIsDeliveryFeeModalOpen(true)
    })]
  });
}