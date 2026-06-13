import { defaultLoyaltyData, getLoyaltyRuleConfigAsync, normalizeLoyaltyData } from "./loyaltyService.js";
import { customerRepository } from "./repositories/customerRepository.js";
import { loyaltyRepository } from "./repositories/loyaltyRepository.js";
import { getCustomerKey } from "./storageService.js";

function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

function isVoucherActive(voucher = {}, now = new Date()) {
  if (!voucher || typeof voucher !== "object") return false;
  if (voucher.used || voucher.canceled || voucher.cancelled) return false;

  const expiredAt = toText(voucher.expiredAt || voucher.expiry || voucher.endAt || voucher.end_at);
  if (!expiredAt) return true;

  const expiryTime = new Date(`${expiredAt.slice(0, 10)}T23:59:59`).getTime();
  if (!Number.isFinite(expiryTime)) return true;
  return expiryTime >= now.getTime();
}

function normalizeVoucher(voucher = {}) {
  const code = toText(voucher.code).toUpperCase();
  const title = toText(voucher.title || voucher.name || "Voucher khách hàng");
  return {
    ...voucher,
    id: toText(voucher.id || code || title),
    code,
    title,
    expiredAt: toText(voucher.expiredAt || voucher.expiry || voucher.endAt || voucher.end_at)
  };
}

function buildCustomerDisplayName(profile = null, phone = "") {
  return toText(
    profile?.name ||
      profile?.registeredCustomerName ||
      profile?.orderCustomerName ||
      profile?.customerName ||
      ""
  ) || (phone ? "Khách thành viên" : "");
}

export async function lookupPosCustomerByPhone(phone = "") {
  const phoneKey = getCustomerKey(phone);
  if (!phoneKey) {
    return {
      ok: false,
      reason: "invalid_phone",
      message: "Nhập đủ số điện thoại để tra khách."
    };
  }

  const [profile, loyalty, loyaltyRule] = await Promise.all([
    customerRepository.getUserByPhoneAsync(phoneKey),
    loyaltyRepository.getByPhoneAsync(phoneKey, defaultLoyaltyData).then(normalizeLoyaltyData),
    getLoyaltyRuleConfigAsync()
  ]);

  const availableVouchers = (loyalty.voucherHistory || [])
    .map(normalizeVoucher)
    .filter((voucher) => isVoucherActive(voucher))
    .slice(0, 6);

  return {
    ok: true,
    phone: phoneKey,
    profile: profile || null,
    customerName: buildCustomerDisplayName(profile, phoneKey),
    loyalty,
    loyaltyRule,
    availableVouchers,
    message: profile ? "Đã tìm thấy khách hàng." : "Khách mới hoặc chưa có hồ sơ."
  };
}
