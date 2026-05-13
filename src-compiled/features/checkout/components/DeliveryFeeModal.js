import CustomerBottomSheet from "../../../components/customer/CustomerBottomSheet.js";
import { defaultDeliveryZones } from "../../../constants/storeConfig.js";
import { formatMoney } from "../../../utils/format.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function DeliveryFeeModal({
  zones,
  fulfillmentType,
  distanceKm,
  deliveryFee: currentDeliveryFee,
  source,
  onClose
}) {
  const isPickup = fulfillmentType === "pickup";
  return /*#__PURE__*/_jsx(CustomerBottomSheet, {
    title: "Ph\xED giao h\xE0ng",
    subtitle: "Ph\xED giao h\xE0ng \u0111\u01B0\u1EE3c t\xEDnh theo qu\xE3ng \u0111\u01B0\u1EDDng t\u1EEB chi nh\xE1nh giao \u0111\u1EBFn \u0111\u1ECBa ch\u1EC9 c\u1EE7a b\u1EA1n.",
    ariaLabel: "Gi\u1EA3i th\xEDch ph\xED giao h\xE0ng",
    onClose: onClose,
    className: "promo-sheet",
    children: isPickup ? /*#__PURE__*/_jsx("div", {
      className: "delivery-fee-note",
      children: "B\u1EA1n ch\u1ECDn t\u1EF1 \u0111\u1EBFn l\u1EA5y n\xEAn kh\xF4ng ph\xE1t sinh ph\xED giao h\xE0ng."
    }) : /*#__PURE__*/_jsxs("div", {
      className: "delivery-fee-list",
      children: [/*#__PURE__*/_jsx("div", {
        children: /*#__PURE__*/_jsxs("span", {
          children: ["Kho\u1EA3ng c\xE1ch hi\u1EC7n t\u1EA1i: ", distanceKm ? `${distanceKm.toFixed(1)}km` : "Chưa xác định"]
        })
      }), /*#__PURE__*/_jsx("div", {
        children: /*#__PURE__*/_jsxs("span", {
          children: ["Ph\xED giao h\xE0ng d\u1EF1 ki\u1EBFn: ", formatMoney(currentDeliveryFee || 0)]
        })
      }), /*#__PURE__*/_jsx("div", {
        children: /*#__PURE__*/_jsxs("span", {
          children: ["C\xE1ch t\xEDnh ph\xED: ", source || "Theo khoảng cách giao hàng"]
        })
      }), (zones.length ? zones : defaultDeliveryZones).map((zone, index) => /*#__PURE__*/_jsx("div", {
        children: /*#__PURE__*/_jsx("span", {
          children: zone
        })
      }, `${zone}-${index}`))]
    })
  });
}