function toDateKey(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateKey, days) {
  const date = new Date(`${String(dateKey || "").slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + Number(days || 0));
  return toDateKey(date);
}

export function getCouponVoucherType(coupon = {}) {
  return String(coupon?.voucherType || "checkout").trim().toLowerCase() === "loyalty"
    ? "loyalty"
    : "checkout";
}

export function normalizeValidDaysAfterGrant(value, fallback = 7) {
  const parsed = Math.floor(Number(value));
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(60, parsed);
  }
  const fallbackParsed = Math.floor(Number(fallback));
  if (Number.isFinite(fallbackParsed) && fallbackParsed > 0) {
    return Math.min(60, fallbackParsed);
  }
  return 7;
}

export function getCouponValidDaysAfterGrant(coupon = {}, fallback = 7) {
  return normalizeValidDaysAfterGrant(coupon?.validDaysAfterGrant, fallback);
}

export function resolveGrantedVoucherExpiry(coupon = {}, {
  createdAt = "",
  fallbackDays = 7
} = {}) {
  const createdDateKey = String(createdAt || "").slice(0, 10) || toDateKey(new Date());
  if (!createdDateKey) return "";

  if (getCouponVoucherType(coupon) === "loyalty") {
    return addDays(createdDateKey, getCouponValidDaysAfterGrant(coupon, fallbackDays));
  }

  return String(coupon?.endAt || coupon?.expiry || "").trim() || addDays(createdDateKey, fallbackDays);
}

export function describeCouponExpiry(coupon = {}, fallbackDays = 7) {
  if (getCouponVoucherType(coupon) === "loyalty") {
    return `${getCouponValidDaysAfterGrant(coupon, fallbackDays)} ngày sau khi nhận`;
  }
  return String(coupon?.endAt || coupon?.expiry || "").trim();
}

export default {
  describeCouponExpiry,
  getCouponValidDaysAfterGrant,
  getCouponVoucherType,
  normalizeValidDaysAfterGrant,
  resolveGrantedVoucherExpiry
};
