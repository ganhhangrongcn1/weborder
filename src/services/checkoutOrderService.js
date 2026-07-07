import { getCustomerKey } from "./storageService.js";

import { coreSupabaseRepository } from "./repositories/coreSupabaseRepository.js";

const VOUCHER_REASON_MESSAGES = {
  voucher_code_required: "Voucher chưa có mã hợp lệ. Vui lòng chọn lại voucher.",
  loyalty_owner_required: "Voucher loyalty chỉ dùng được khi đăng nhập đúng tài khoản đã nhận voucher.",
  loyalty_wallet_not_found: "Không tìm thấy ví voucher của tài khoản này.",
  loyalty_voucher_not_found: "Voucher không còn trong ví của khách.",
  loyalty_voucher_code_mismatch: "Thông tin voucher trong ví không còn khớp.",
  loyalty_voucher_used: "Voucher này đã được sử dụng.",
  loyalty_voucher_canceled: "Voucher này đã bị thu hồi.",
  loyalty_voucher_expired: "Voucher này đã hết hạn.",
  coupon_not_found: "Mã voucher không còn tồn tại.",
  voucher_source_mismatch: "Loại voucher không phù hợp với cách sử dụng hiện tại.",
  coupon_inactive: "Voucher đang tạm ngưng áp dụng.",
  coupon_not_started: "Voucher chưa đến thời gian sử dụng.",
  coupon_expired: "Voucher đã hết hạn.",
  coupon_usage_limit_reached: "Voucher đã hết lượt sử dụng.",
  coupon_per_user_limit_reached: "Tài khoản này đã dùng hết lượt của voucher.",
  voucher_min_order_not_met: "Đơn hàng chưa đạt giá trị tối thiểu của voucher.",
  voucher_zero_discount: "Voucher chưa được thiết lập giá trị giảm hợp lệ.",
  voucher_discount_mismatch: "Giá trị giảm đã thay đổi. Vui lòng chọn lại voucher.",
  voucher_validation_unavailable: "Chưa thể xác minh voucher. Vui lòng thử lại sau."
};

function createVoucherValidationError(reason = "voucher_invalid") {
  const error = new Error(VOUCHER_REASON_MESSAGES[reason] || "Voucher không còn hợp lệ.");
  error.code = "CHECKOUT_VOUCHER_INVALID";
  error.reason = reason;
  return error;
}

export function getCheckoutVoucherErrorMessage(error) {
  if (error?.code === "CHECKOUT_VOUCHER_INVALID") {
    return VOUCHER_REASON_MESSAGES[error?.reason] || error.message || "Voucher không còn hợp lệ.";
  }

  const message = String(error?.message || "");
  const match = message.match(/voucher_invalid:([a-z0-9_]+)/i);
  if (!match?.[1]) return "";
  return VOUCHER_REASON_MESSAGES[match[1].toLowerCase()] || "Voucher không còn hợp lệ.";
}

export async function validateCheckoutVoucherBeforeOrder({
  orderId = "",
  customerPhone = "",
  subtotal = 0,
  promoDiscount = 0,
  promoCode = "",
  promoSource = "",
  promoVoucherId = "",
  at = ""
} = {}) {
  const requestedCode = String(promoCode || "").trim().toUpperCase();
  const requestedDiscount = Math.max(0, Number(promoDiscount || 0));

  if (!requestedCode && requestedDiscount <= 0) {
    return {
      promoDiscount: 0,
      promoCode: "",
      promoSource: "",
      promoVoucherId: ""
    };
  }
  if (!requestedCode) throw createVoucherValidationError("voucher_code_required");

  const result = await coreSupabaseRepository.validateCheckoutVoucher({
    orderId,
    customerPhone,
    subtotal,
    promoCode: requestedCode,
    promoSource,
    promoVoucherId,
    at
  });
  if (!result) throw createVoucherValidationError("voucher_validation_unavailable");
  if (!result.valid) throw createVoucherValidationError(result.reason);
  if (Math.abs(requestedDiscount - result.discountAmount) > 0.009) {
    throw createVoucherValidationError("voucher_discount_mismatch");
  }

  return {
    promoDiscount: result.discountAmount,
    promoCode: result.promoCode,
    promoSource: result.promoSource,
    promoVoucherId: result.promoVoucherId
  };
}

export function validateCheckoutContact({ deliveryInfo, fulfillmentType }) {
  if (!deliveryInfo.name || !deliveryInfo.phone || (fulfillmentType === "delivery" && !deliveryInfo.address)) {
    return {
      ok: false,
      message: fulfillmentType === "pickup"
        ? "Vui lòng nhập tên và số điện thoại để quán xác nhận người đến lấy và tích điểm."
        : "Vui lòng nhập đủ tên, số điện thoại và địa chỉ giao hàng."
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
  pointsSpent,
  pointsDiscount,
  deliveryDistanceKm,
  deliveryInfo,
  fulfillmentType,
  selectedBranchInfo,
  deliverySourceBranch,
  pickupTimeText,
  orderSource = "online",
  paymentMethod = "COD"
}) {
  return {
    totalAmount: checkoutTotal,
    subtotal,
    pointsBaseAmount: Math.max(Number(subtotal || 0) - Number(promoDiscount || 0), 0),
    shippingFee: checkoutShip,
    originalShippingFee: baseCheckoutShip,
    shippingSupportDiscount: autoShipSupport,
    promoDiscount,
    promoCode: selectedPromo?.code || "",
    promoSource: selectedPromo?.source || "",
    promoVoucherId: selectedPromo?.couponId || selectedPromo?.id || "",
    pointsSpent,
    pointsDiscount,
    pointsDiscountAmount: pointsDiscount,
    distanceKm: deliveryDistanceKm,
    lat: deliveryInfo.lat,
    lng: deliveryInfo.lng,
    deliveryInfo,
    fulfillmentType,
    orderSource,
    branchInfo: fulfillmentType === "pickup" ? selectedBranchInfo : deliverySourceBranch,
    pickupTimeText: fulfillmentType === "pickup" ? pickupTimeText : "",
    paymentMethod
  };
}
