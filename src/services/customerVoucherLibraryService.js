import { isPromotionAllowedForChannel } from "./promotionChannelService.js";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function isDateInRange(startAt = "", endAt = "", now = new Date()) {
  const startText = String(startAt || "").trim();
  const endText = String(endAt || "").trim();
  const currentTime = now.getTime();

  if (startText) {
    const start = new Date(`${startText.slice(0, 10)}T00:00:00`);
    if (!Number.isNaN(start.getTime()) && currentTime < start.getTime()) return false;
  }

  if (endText) {
    const end = new Date(`${endText.slice(0, 10)}T23:59:59`);
    if (!Number.isNaN(end.getTime()) && currentTime > end.getTime()) return false;
  }

  return true;
}

function hasRemainingGlobalUsage(coupon = {}) {
  const usageLimit = Number(coupon.usageLimit || 0);
  if (usageLimit <= 0) return true;
  return Number(coupon.totalUsed || 0) < usageLimit;
}

function countCustomerUses(coupon = {}, orders = []) {
  const couponCode = normalizeCode(coupon.code);
  if (!couponCode) return 0;

  return toArray(orders).reduce((count, order) => {
    const status = String(order?.status || order?.orderStatus || "").trim().toLowerCase();
    if (["cancel", "canceled", "cancelled", "refunded"].includes(status)) return count;

    const orderCode = normalizeCode(
      order?.promoCode || order?.promo_code || order?.metadata?.promoCode
    );
    return orderCode === couponCode ? count + 1 : count;
  }, 0);
}

function hasRemainingCustomerUsage(coupon = {}, orders = []) {
  const perUserLimit = Number(coupon.perUserLimit || 0);
  if (perUserLimit <= 0) return true;
  return countCustomerUses(coupon, orders) < perUserLimit;
}

function getVoucherKey(voucher = {}) {
  return normalizeCode(voucher.code) || String(voucher.id || voucher.couponId || "").trim();
}

export function selectUsablePublicVouchers({
  coupons = [],
  orders = [],
  channel = "web",
  now = new Date()
} = {}) {
  return toArray(coupons)
    .filter((coupon) => coupon && coupon.active !== false)
    .filter((coupon) => String(coupon.voucherType || "checkout") !== "loyalty")
    .filter((coupon) => normalizeCode(coupon.code))
    .filter((coupon) => isPromotionAllowedForChannel(coupon, channel))
    .filter((coupon) => isDateInRange(coupon.startAt, coupon.endAt || coupon.expiry, now))
    .filter((coupon) => hasRemainingGlobalUsage(coupon))
    .filter((coupon) => hasRemainingCustomerUsage(coupon, orders))
    .map((coupon) => ({
      ...coupon,
      source: "checkout",
      title: coupon.title || coupon.name || `Mã ${normalizeCode(coupon.code)}`
    }));
}

export function buildCustomerVoucherLibrary({
  walletVouchers = [],
  coupons = [],
  orders = [],
  channel = "web",
  now = new Date()
} = {}) {
  const publicVouchers = selectUsablePublicVouchers({ coupons, orders, channel, now });
  const merged = new Map();

  publicVouchers.forEach((voucher) => {
    const key = getVoucherKey(voucher);
    if (key) merged.set(key, voucher);
  });

  // Voucher đã cấp vào ví được ưu tiên nếu trùng mã với voucher công khai.
  toArray(walletVouchers).forEach((voucher) => {
    const key = getVoucherKey(voucher);
    if (key) merged.set(key, voucher);
  });

  return Array.from(merged.values());
}
