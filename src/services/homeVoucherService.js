import { freeshipMinSubtotal } from "../constants/storeConfig.js";
import { formatMoney } from "../utils/format.js";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function isDateInRange(startAt = "", endAt = "", now = new Date()) {
  const startText = String(startAt || "").trim();
  const endText = String(endAt || "").trim();
  const nowTime = now.getTime();

  if (startText) {
    const start = new Date(`${startText.slice(0, 10)}T00:00:00`);
    if (!Number.isNaN(start.getTime()) && nowTime < start.getTime()) return false;
  }

  if (endText) {
    const end = new Date(`${endText.slice(0, 10)}T23:59:59`);
    if (!Number.isNaN(end.getTime()) && nowTime > end.getTime()) return false;
  }

  return true;
}

function formatDiscountTitle(coupon = {}) {
  const value = Number(coupon.value || 0);
  if (coupon.discountType === "percent") return `Giảm ${value}%`;
  return `Giảm ${formatMoney(value)}`;
}

function formatMinimumOrder(value = 0) {
  const amount = Number(value || 0);
  return amount > 0 ? `Đơn tối thiểu ${formatMoney(amount)}` : "Áp dụng mọi đơn";
}

function getCouponKey(coupon = {}, prefix = "coupon") {
  return `${prefix}-${coupon.id || coupon.code || coupon.title || coupon.name || "unknown"}`;
}

function normalizeCouponCard(coupon = {}, source = "coupon") {
  const isLoyalty = source === "loyalty" || String(coupon.voucherType || "") === "loyalty";
  const maxDiscount = Number(coupon.maxDiscount || 0);
  const discountTitle = Number(coupon.value || 0) > 0
    ? formatDiscountTitle(coupon)
    : String(coupon.title || coupon.name || "Ưu đãi dành cho bạn");

  return {
    id: getCouponKey(coupon, isLoyalty ? "loyalty" : "coupon"),
    type: isLoyalty ? "loyalty" : "coupon",
    badge: isLoyalty ? "THÀNH VIÊN" : "ƯU ĐÃI",
    title: coupon.name || formatDiscountTitle(coupon),
    reward: discountTitle,
    code: String(coupon.code || "ƯU ĐÃI").trim().toUpperCase(),
    icon: isLoyalty ? "gift" : "tag",
    lines: [
      formatMinimumOrder(coupon.minOrder),
      maxDiscount > 0 ? `Tối đa ${formatMoney(maxDiscount)}` : ""
    ].filter(Boolean),
    priority: isLoyalty ? 10 : 40
  };
}

function buildLoyaltyCards(coupons = [], loyalty = {}, now = new Date(), isRegisteredCustomer = false, currentPhone = "") {
  if (!isRegisteredCustomer || !String(currentPhone || "").trim()) return [];

  const activeLoyaltyCoupons = toArray(coupons)
    .filter((coupon) => coupon?.active !== false)
    .filter((coupon) => String(coupon?.voucherType || "") === "loyalty")
    .filter((coupon) => isDateInRange(coupon.startAt, coupon.endAt || coupon.expiry, now));

  const couponById = Object.fromEntries(activeLoyaltyCoupons.map((coupon) => [String(coupon.id || ""), coupon]));
  const couponByCode = Object.fromEntries(activeLoyaltyCoupons.map((coupon) => [String(coupon.code || "").toUpperCase(), coupon]));
  const earnedVouchers = toArray(loyalty?.voucherHistory)
    .filter((voucher) => voucher && !voucher.used && !voucher.canceled)
    .filter((voucher) => isDateInRange("", voucher.expiredAt || voucher.endAt || voucher.expiry, now));

  const cards = earnedVouchers.map((voucher) => {
    const matchedCoupon =
      couponById[String(voucher.couponId || "")] ||
      couponByCode[String(voucher.code || "").toUpperCase()] ||
      null;

    return normalizeCouponCard({
      ...(matchedCoupon || {}),
      id: voucher.id || matchedCoupon?.id,
      code: voucher.code || matchedCoupon?.code,
      name: voucher.title || voucher.name || matchedCoupon?.name,
      discountType: matchedCoupon?.discountType || voucher.discountType || "fixed",
      value: Number(matchedCoupon?.value || voucher.value || 0),
      maxDiscount: Number(matchedCoupon?.maxDiscount || voucher.maxDiscount || 0),
      minOrder: Number(matchedCoupon?.minOrder || voucher.minOrder || 0),
      voucherType: "loyalty"
    }, "loyalty");
  });

  return cards;
}

function getProductNameById(products = [], productId = "") {
  const normalizedProductId = String(productId || "").trim();
  if (!normalizedProductId) return "";
  const matchedProduct = toArray(products).find((product) => String(product?.id || "").trim() === normalizedProductId);
  return String(matchedProduct?.name || "").trim();
}

function buildGiftCards(smartPromotions = [], products = [], now = new Date()) {
  return toArray(smartPromotions)
    .filter((promotion) => promotion?.active !== false)
    .filter((promotion) => promotion?.type === "gift_threshold" || promotion?.reward?.type === "gift")
    .filter((promotion) => isDateInRange(promotion.startAt, promotion.endAt, now))
    .map((promotion) => {
      const minSubtotal = Number(promotion?.condition?.minSubtotal || 0);
      const giftName =
        getProductNameById(products, promotion?.reward?.productId) ||
        String(promotion?.reward?.name || promotion?.reward?.title || promotion?.reward?.value || "").trim() ||
        "Món tặng";

      return {
        id: `gift-${promotion.id || giftName}`,
        type: "gift",
        badge: "TẶNG MÓN",
        title: promotion.title || promotion.name || "Đủ mức nhận quà",
        reward: `Tặng ${giftName}`,
        code: "TỰ ĐỘNG",
        icon: "gift",
        lines: [
          formatMinimumOrder(minSubtotal),
          "Áp dụng khi đặt món đủ điều kiện"
        ],
        priority: 20
      };
    });
}

function buildFreeshipCards(smartPromotions = [], now = new Date()) {
  return toArray(smartPromotions)
    .filter((promotion) => promotion?.active !== false)
    .filter((promotion) => promotion?.type === "free_shipping" || promotion?.reward?.type === "shipping_discount")
    .filter((promotion) => isDateInRange(promotion.startAt, promotion.endAt, now))
    .map((promotion) => {
      const minSubtotal = Number(promotion?.condition?.minSubtotal || freeshipMinSubtotal);
      const maxSupportShipFee = Number(promotion?.condition?.maxSupportShipFee || 0);

      return {
        id: `freeship-${promotion.id || minSubtotal}`,
        type: "freeship",
        badge: "PHÍ SHIP",
        title: promotion.title || promotion.name || "Hỗ trợ phí ship",
        reward: maxSupportShipFee > 0 ? `Hỗ trợ ship tối đa ${formatMoney(maxSupportShipFee)}` : "Hỗ trợ toàn bộ phí ship",
        code: String(promotion.code || promotion.couponCode || "TỰ ĐỘNG").toUpperCase(),
        icon: "bike",
        lines: [
          `Đơn từ ${formatMoney(minSubtotal)}`,
          maxSupportShipFee > 0 ? `Tối đa ${formatMoney(maxSupportShipFee)}` : "Hỗ trợ phí giao hàng"
        ],
        priority: 30
      };
    });
}

function buildCouponCards(coupons = [], now = new Date()) {
  return toArray(coupons)
    .filter((coupon) => coupon?.active !== false)
    .filter((coupon) => String(coupon?.voucherType || "checkout") !== "loyalty")
    .filter((coupon) => isDateInRange(coupon.startAt, coupon.endAt || coupon.expiry, now))
    .map((coupon) => normalizeCouponCard(coupon, "coupon"));
}

export function buildHomeVoucherCards({
  coupons = [],
  smartPromotions = [],
  loyalty = {},
  products = [],
  currentPhone = "",
  isRegisteredCustomer = false,
  now = new Date()
} = {}) {
  const cards = [
    ...buildLoyaltyCards(coupons, loyalty, now, isRegisteredCustomer, currentPhone),
    ...buildGiftCards(smartPromotions, products, now),
    ...buildFreeshipCards(smartPromotions, now),
    ...buildCouponCards(coupons, now)
  ];

  const seen = new Set();
  return cards
    .filter((card) => {
      const key = `${card.type}-${card.code || ""}-${card.title || card.reward || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((first, second) => first.priority - second.priority);
}
