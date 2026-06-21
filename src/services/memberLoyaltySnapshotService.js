import { defaultLoyaltyData, normalizeLoyaltyData, resolveVoucherUsageFromOrders } from "./loyaltyService.js";
import { loyaltyRepository } from "./repositories/loyaltyRepository.js";
import { getCustomerKey } from "./storageService.js";

export function composeMemberLoyaltySnapshot(loyalty = {}, orders = []) {
  const normalized = normalizeLoyaltyData(loyalty || defaultLoyaltyData);
  return normalizeLoyaltyData({
    ...normalized,
    voucherHistory: resolveVoucherUsageFromOrders(normalized.voucherHistory || [], orders || [])
  });
}

export function getStoredMemberLoyaltySnapshot(
  phone = "",
  { orders = [], fallback = defaultLoyaltyData } = {}
) {
  const key = getCustomerKey(phone);
  if (!key) return composeMemberLoyaltySnapshot(fallback, orders);

  return composeMemberLoyaltySnapshot(
    loyaltyRepository.getByPhone(key, { ...fallback, phone: key }),
    orders
  );
}

export async function getMemberLoyaltySnapshot(
  phone = "",
  { orders = [], fallback = defaultLoyaltyData } = {}
) {
  const key = getCustomerKey(phone);
  if (!key) return composeMemberLoyaltySnapshot(fallback, orders);

  const remote = await loyaltyRepository.getByPhoneAsync(key, {
    ...fallback,
    phone: key
  });
  return composeMemberLoyaltySnapshot(remote, orders);
}

export default {
  composeMemberLoyaltySnapshot,
  getStoredMemberLoyaltySnapshot,
  getMemberLoyaltySnapshot
};
