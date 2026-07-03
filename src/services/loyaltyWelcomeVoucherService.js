import { defaultLoyaltyData, normalizeLoyaltyData } from "./loyaltyService.js";
import { normalizeLoyaltyProgramConfig } from "./loyaltyProgramConfigService.js";
import { catalogConfigRepository } from "./repositories/catalogConfigRepository.js";
import { loyaltyRepository } from "./repositories/loyaltyRepository.js";
import { getCustomerKey } from "./storageService.js";
import { getCouponValidDaysAfterGrant, resolveGrantedVoucherExpiry } from "./voucherTemplateService.js";

function toDateKey(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeCode(value = "") {
  return String(value || "").trim().toUpperCase();
}

function isDateInRange(startAt = "", endAt = "", now = new Date()) {
  const nowTime = now.getTime();
  const startText = String(startAt || "").trim();
  const endText = String(endAt || "").trim();

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

function findCouponByRef(coupons = [], ref = "") {
  const target = String(ref || "").trim();
  const targetCode = normalizeCode(ref);
  if (!target && !targetCode) return null;

  return (Array.isArray(coupons) ? coupons : []).find((coupon) => {
    const couponId = String(coupon?.id || "").trim();
    const couponCode = normalizeCode(coupon?.code);
    return (target && couponId === target) || (targetCode && couponCode === targetCode);
  }) || null;
}

function hasReceivedWelcomeVoucher(loyalty = {}) {
  return (Array.isArray(loyalty?.voucherHistory) ? loyalty.voucherHistory : []).some((voucher) => (
    String(voucher?.type || "").trim().toUpperCase() === "WELCOME_REGISTER"
  ));
}

function buildGrantedVoucher(coupon = {}, config = {}, now = new Date()) {
  const createdAt = toDateKey(now);
  const validDaysAfterGrant = getCouponValidDaysAfterGrant(
    coupon,
    Number(config?.welcomeVoucherValidityDays || 7)
  );
  const expiry = resolveGrantedVoucherExpiry(coupon, {
    createdAt,
    fallbackDays: validDaysAfterGrant
  });

  return {
    id: `welcome-voucher-${Date.now()}`,
    type: "WELCOME_REGISTER",
    couponId: String(coupon?.id || "").trim(),
    code: normalizeCode(coupon?.code),
    discountType: coupon?.discountType === "percent" ? "percent" : "fixed",
    value: Number(coupon?.value || 0),
    maxDiscount: Number(coupon?.maxDiscount || 0),
    minOrder: Number(coupon?.minOrder || 0),
    title: String(coupon?.name || coupon?.title || "Voucher chao thanh vien moi"),
    createdAt,
    validDaysAfterGrant,
    used: false,
    canceled: false,
    orderCode: "",
    expiredAt: expiry
  };
}

export async function grantWelcomeVoucherToNewMemberIfEligible(phone = "", options = {}) {
  const key = getCustomerKey(phone);
  if (!key) return { ok: false, granted: false, reason: "invalid_phone" };

  const config = normalizeLoyaltyProgramConfig(
    await loyaltyRepository.getCrmConfigAsync({})
  );
  if (!config.welcomeVoucherEnabled) {
    return { ok: true, granted: false, reason: "welcome_voucher_disabled", config };
  }
  if (!config.welcomeVoucherId) {
    return { ok: true, granted: false, reason: "welcome_voucher_missing", config };
  }

  const coupons = await catalogConfigRepository.getAsync("ghr_coupons", []);
  const selectedCoupon = findCouponByRef(coupons, config.welcomeVoucherId);
  if (!selectedCoupon) {
    return { ok: true, granted: false, reason: "selected_coupon_not_found", config };
  }
  if (String(selectedCoupon?.voucherType || "checkout") !== "loyalty") {
    return { ok: true, granted: false, reason: "selected_coupon_not_loyalty", config, coupon: selectedCoupon };
  }
  if (selectedCoupon?.active === false) {
    return { ok: true, granted: false, reason: "selected_coupon_inactive", config, coupon: selectedCoupon };
  }

  const now = options?.now instanceof Date ? options.now : new Date();
  if (!isDateInRange(selectedCoupon?.startAt, selectedCoupon?.endAt || selectedCoupon?.expiry, now)) {
    return { ok: true, granted: false, reason: "selected_coupon_out_of_date", config, coupon: selectedCoupon };
  }

  const current = normalizeLoyaltyData(
    await loyaltyRepository.getByPhoneAsync(key, {
      ...defaultLoyaltyData,
      phone: key
    })
  );
  if (hasReceivedWelcomeVoucher(current)) {
    return { ok: true, granted: false, reason: "welcome_voucher_already_granted", config, coupon: selectedCoupon, loyalty: current };
  }

  const nextVoucher = buildGrantedVoucher(selectedCoupon, config, now);
  const nextLoyalty = normalizeLoyaltyData({
    ...current,
    phone: key,
    voucherHistory: [nextVoucher, ...(current.voucherHistory || [])]
  });
  const savedLoyalty = await loyaltyRepository.saveByPhoneAsync(key, nextLoyalty, defaultLoyaltyData);

  return {
    ok: true,
    granted: true,
    reason: "welcome_voucher_granted",
    config,
    coupon: selectedCoupon,
    voucher: nextVoucher,
    loyalty: savedLoyalty
  };
}

export default {
  grantWelcomeVoucherToNewMemberIfEligible
};
