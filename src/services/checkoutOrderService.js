import { getCustomerKey } from "./storageService.js";

export function validateCheckoutContact({ deliveryInfo, fulfillmentType }) {
  if (!deliveryInfo.name || !deliveryInfo.phone || (fulfillmentType === "delivery" && !deliveryInfo.address)) {
    return {
      ok: false,
      message: "Vui lòng nhập đủ tên, số điện thoại và địa chỉ giao hàng."
    };
  }

  const phoneKey = getCustomerKey(deliveryInfo.phone);
  if (!phoneKey || phoneKey.length < 9) {
    return {
      ok: false,
      message: "Vui lòng nhập số điện thoại hợp lệ để quán lưu đơn và tích điểm."
    };
  }

  return { ok: true };
}

export function buildCreateOrderPayload({
  checkoutTotal,
  subtotal,
  checkoutShip,
  baseCheckoutShip,
  autoShipSupport,
  promoDiscount,
  selectedPromo,
  pointsDiscount,
  deliveryDistanceKm,
  deliveryInfo,
  fulfillmentType,
  selectedBranchInfo,
  deliverySourceBranch,
  pickupTimeText
}) {
  return {
    totalAmount: checkoutTotal,
    pointsBaseAmount: subtotal,
    shippingFee: checkoutShip,
    originalShippingFee: baseCheckoutShip,
    shippingSupportDiscount: autoShipSupport,
    promoDiscount,
    promoCode: selectedPromo?.code || "",
    promoSource: selectedPromo?.source || "",
    promoVoucherId: selectedPromo?.couponId || selectedPromo?.id || "",
    pointsDiscount,
    distanceKm: deliveryDistanceKm,
    lat: deliveryInfo.lat,
    lng: deliveryInfo.lng,
    deliveryInfo,
    fulfillmentType,
    branchInfo: fulfillmentType === "pickup" ? selectedBranchInfo : deliverySourceBranch,
    pickupTimeText: fulfillmentType === "pickup" ? pickupTimeText : "",
    paymentMethod: "COD"
  };
}
