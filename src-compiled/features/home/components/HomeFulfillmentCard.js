import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function HomeFulfillmentCard({
  homeFulfillment,
  onDelivery,
  onPickup,
  selectedDeliveryBranchInfo
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "pickup-time-card",
    children: [/*#__PURE__*/_jsxs("div", {
      className: "pickup-mode-tabs service-tabs",
      children: [/*#__PURE__*/_jsx("button", {
        onClick: onDelivery,
        className: homeFulfillment === "delivery" ? "active" : "",
        children: "Giao h\xE0ng"
      }), /*#__PURE__*/_jsx("button", {
        onClick: onPickup,
        className: homeFulfillment === "pickup" ? "active" : "",
        children: "T\u1EF1 \u0111\u1EBFn l\u1EA5y"
      })]
    }), /*#__PURE__*/_jsx("span", {
      className: "text-xs font-bold text-brown/60",
      children: homeFulfillment === "pickup" ? "Chọn chi nhánh và giờ lấy trước khi vào menu." : `Giao từ ${selectedDeliveryBranchInfo?.name || "chi nhánh gần bạn"} để tính phí ship chính xác.`
    })]
  });
}