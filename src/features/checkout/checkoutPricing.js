import { getActivePromotions } from "../../utils/pureHelpers.js";
import { buildUsedVoucherLookupFromOrders } from "../../services/loyaltyService.js";

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isExpired(dateValue) {
  if (!dateValue) return false;
  return String(dateValue).slice(0, 10) < getDateKey();
}

function calculateCouponDiscount(coupon, subtotal) {
  const value = Number(coupon.value || 0);
  if (coupon.discountType === "percent") {
    const rawDiscount = Math.floor(Number(subtotal || 0) * value / 100);
    const maxDiscount = Number(coupon.maxDiscount || 0);
    return maxDiscount > 0 ? Math.min(rawDiscount, maxDiscount) : rawDiscount;
  }
  return value;
}

function normalizeCheckoutCoupon(coupon, subtotal, formatMoney, source = "checkout") {
  const minOrder = Number(coupon.minOrder || 0);
  const discount = Number(subtotal || 0) >= minOrder ? calculateCouponDiscount(coupon, subtotal) : 0;
  const discountText = coupon.discountType === "percent"
    ? `${Number(coupon.value || 0)}%`
    : formatMoney(Number(coupon.value || 0));

  return {
    id: `${source}-${coupon.id || coupon.code}`,
    source,
    couponId: coupon.id || "",
    title: coupon.name || `${coupon.code} giảm ${discountText}`,
    code: coupon.code,
    discount,
    condition: minOrder ? `Cần đơn từ ${formatMoney(minOrder)}` : "Áp dụng cho mọi đơn"
  };
}

function dedupeByCode(items) {
  const result = [];
  const seen = new Set();
  items.forEach((item) => {
    const key = String(item?.code || item?.id || "").trim().toUpperCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
}

function dedupeByCodePreferLoyalty(items) {
  const map = new Map();
  (items || []).forEach((item) => {
    const key = String(item?.code || item?.id || "").trim().toUpperCase();
    if (!key) return;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, item);
      return;
    }
    const prevIsLoyalty = String(prev?.source || "").toLowerCase() === "loyalty";
    const nextIsLoyalty = String(item?.source || "").toLowerCase() === "loyalty";
    if (!prevIsLoyalty && nextIsLoyalty) {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
}

export function buildCheckoutPromoCodes(coupons, fallbackCoupons, subtotal, formatMoney, loyaltyVouchers = [], orders = []) {
  const adminCheckoutCoupons = (coupons.length ? coupons : fallbackCoupons)
    .filter((coupon) => coupon.active !== false && String(coupon.voucherType || "checkout") !== "loyalty")
    .filter((coupon) => !isExpired(coupon.endAt || coupon.expiry))
    .map((coupon) => normalizeCheckoutCoupon(coupon, subtotal, formatMoney, "checkout"));

  const loyaltyUsageLookup = buildUsedVoucherLookupFromOrders(orders);
  const customerLoyaltyCoupons = loyaltyVouchers
    .filter((voucher) => {
      if (!voucher) return false;
      const voucherId = String(voucher.id || "").trim();
      const voucherCode = String(voucher.code || "").trim().toUpperCase();
      const usedByOrder =
        (voucherId && loyaltyUsageLookup.byId.has(voucherId)) ||
        (voucherCode && loyaltyUsageLookup.byCode.has(voucherCode));
      return !usedByOrder && voucher.used !== true;
    })
    .filter((voucher) => voucher.canceled !== true)
    .filter((voucher) => String(voucher.code || "").trim())
    .filter((voucher) => !isExpired(voucher.expiredAt || voucher.endAt || voucher.expiry))
    .map((coupon) => ({
      id: coupon.id || coupon.code,
      code: coupon.code,
      name: coupon.title || coupon.name || coupon.code,
      discountType: coupon.discountType || "fixed",
      value: Number(coupon.value || 0),
      maxDiscount: Number(coupon.maxDiscount || 0),
      minOrder: Number(coupon.minOrder || 0)
    }));

  return dedupeByCodePreferLoyalty([
    ...adminCheckoutCoupons,
    ...customerLoyaltyCoupons.map((coupon) => normalizeCheckoutCoupon(coupon, subtotal, formatMoney, "loyalty"))
  ]);
}

export function buildShippingZonesFromConfig(shippingConfig, deliveryFee, freeshipMinSubtotal, formatMoney) {
  const maxSupportShipFee = Number(shippingConfig.maxSupportShipFee || 0);
  return [
    `0-3km \u0111\u1ea7u: ${formatMoney(Number(shippingConfig.baseFeeFirst3Km || deliveryFee))}`,
    `M\u1ed7i km sau: +${formatMoney(Number(shippingConfig.feePerNextKm || 0))}/km`,
    `Freeship \u0111\u01a1n t\u1eeb ${formatMoney(Number(shippingConfig.freeShipThreshold || freeshipMinSubtotal))}`,
    `Qu\u00e1n h\u1ed7 tr\u1ee3 ship t\u1ed1i \u0111a: ${maxSupportShipFee > 0 ? formatMoney(maxSupportShipFee) : "Kh\u00f4ng gi\u1edbi h\u1ea1n"}`,
    `B\u00e1n k\u00ednh giao t\u1ed1i \u0111a: ${Number(shippingConfig.maxRadiusKm || 0)}km`
  ];
}

export function calculateCheckoutPricing({
  fulfillmentType,
  baseShippingByConfig,
  smartPromotions,
  subtotal,
  shippingConfig,
  freeshipMinSubtotal,
  selectedPromo,
  availablePoints,
  usePoints,
  loyaltyRule
}) {
  const baseCheckoutShip = fulfillmentType === "pickup" ? 0 : baseShippingByConfig;
  const activeFreeShipPromo = getActivePromotions(smartPromotions, "checkout").find(
    (promotion) => promotion.type === "free_shipping" || promotion.reward.type === "shipping_discount"
  );
  const freeShipMinSubtotal = activeFreeShipPromo?.condition?.minSubtotal ?? Number(shippingConfig.freeShipThreshold || freeshipMinSubtotal);
  const promoSupportCap = Number(
    activeFreeShipPromo?.condition?.maxSupportShipFee ??
    activeFreeShipPromo?.reward?.maxSupportShipFee ??
    0
  );
  const promoShipSupport =
    fulfillmentType !== "pickup" && activeFreeShipPromo && subtotal >= freeShipMinSubtotal
      ? promoSupportCap > 0
        ? Math.min(baseCheckoutShip, promoSupportCap)
        : baseCheckoutShip
      : 0;
  const configSupportCap = Number(shippingConfig.maxSupportShipFee || 0);
  const configSupportLimit = configSupportCap > 0 ? configSupportCap : baseCheckoutShip;
  const configShipSupport =
    fulfillmentType !== "pickup" && shippingConfig.supportShippingEnabled && subtotal >= Number(shippingConfig.freeShipThreshold || freeshipMinSubtotal)
      ? Math.min(baseCheckoutShip, configSupportLimit)
      : 0;
  const autoShipSupport = Math.min(baseCheckoutShip, Math.max(promoShipSupport, configShipSupport));
  const checkoutShip = fulfillmentType === "pickup" ? 0 : Math.max(baseCheckoutShip - autoShipSupport, 0);
  const customerExtraShip = fulfillmentType === "pickup" ? 0 : checkoutShip;
  const promoDiscount = selectedPromo?.discount || 0;
  const currencyPerPoint = Math.max(1, Number(loyaltyRule?.currencyPerPoint || 1000));
  const pointPerUnit = Math.max(1, Number(loyaltyRule?.pointPerUnit || 1));
  const redeemPointUnit = Math.max(1, Number(loyaltyRule?.redeemPointUnit || 1));
  const redeemValue = Math.max(1, Number(loyaltyRule?.redeemValue || 1));
  const earnedPreviewPoints = Math.floor((Number(subtotal || 0) / currencyPerPoint) * pointPerUnit);
  const maxDiscountFromPoints = Math.floor(Number(availablePoints || 0) / redeemPointUnit) * redeemValue;
  const pointsDiscount = usePoints ? Math.min(maxDiscountFromPoints, Math.max(subtotal + checkoutShip - promoDiscount, 0)) : 0;
  const checkoutTotal = Math.max(subtotal - promoDiscount - pointsDiscount + checkoutShip, 0);

  return {
    baseCheckoutShip,
    autoShipSupport,
    checkoutShip,
    customerExtraShip,
    configSupportLimit,
    promoDiscount,
    currencyPerPoint,
    pointPerUnit,
    redeemPointUnit,
    redeemValue,
    earnedPreviewPoints,
    pointsDiscount,
    checkoutTotal
  };
}
