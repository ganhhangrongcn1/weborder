import { getStampClient, stampRpc } from "./repositories/stampRepository.js";
import { createStampRequestCache } from "./stampRequestCache.js";
import { getCustomerKey } from "./storageService.js";

const cache = createStampRequestCache();
export const stampRequestStats = cache.stats;
export function invalidateStamps() { cache.clear(); }
export async function readStampSummary(phone = "", { force = false, admin = false, kitchen = false } = {}) {
  const client = await getStampClient(admin, kitchen);
  const { data } = client ? await client.auth.getSession() : { data: null };
  const userId = data?.session?.user?.id || "guest";
  const key = getCustomerKey(phone);
  if (key && (userId === "guest" || !/^0[35789]\d{8}$/.test(key))) throw new Error("Đăng nhập và dùng số điện thoại hợp lệ để xem tem.");
  return cache.get(`${admin}:${kitchen}:${userId}:${key}:summary`, () => stampRpc("get_stamp_summary", { p_phone: key }, { admin, kitchen }), force);
}
export async function readStampHistory(phone, before = null) {
  const client = await getStampClient();
  const { data } = client ? await client.auth.getSession() : { data: null };
  if (!data?.session?.user?.id) return [];
  const key = getCustomerKey(phone);
  return cache.get(`${data.session.user.id}:${key}:history:${before || 0}`,
    () => stampRpc("get_stamp_history", { p_phone: key, p_before: before }));
}
export async function saveStampProgram(enabled, ids) {
  const result = await stampRpc("save_stamp_program", { p_enabled: enabled, p_gift_ids: ids }, { admin: true, write: true });
  invalidateStamps();
  return result;
}
export function buildStampGift(product, phone) {
  return {
    ...product, cartId: `stamp-${product.id}`, quantity: 1, price: 0, unitTotal: 0, lineTotal: 0,
    originalPrice: undefined, originalLineTotal: undefined, salePrice: undefined,
    toppings: [], spice: "", note: "Quà đổi 10 tem", stampGift: true, stampPhone: getCustomerKey(phone),
    metadata: { stampGift: true }
  };
}
export default { readStampSummary, readStampHistory, saveStampProgram, buildStampGift, invalidateStamps };
