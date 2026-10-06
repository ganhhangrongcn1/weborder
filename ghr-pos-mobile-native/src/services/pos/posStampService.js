import { supabase } from "../supabase/client";
import { normalizeCustomerPhone } from "./posCustomerService";

const cache = new Map();
const pending = new Map();
let generation = 0;
export const posStampRequestStats = { requests: 0, hits: 0, shared: 0 };
export function invalidatePosStamps() { generation += 1; cache.clear(); pending.clear(); }
export async function readPosStamps(phone, { force = false } = {}) {
  const normalized = normalizeCustomerPhone(phone);
  if (!supabase || !/^0[35789]\d{8}$/.test(normalized)) return null;
  const { data } = await supabase.auth.getSession();
  if (!data?.session?.user?.id) throw new Error("Đăng nhập POS để xem tem.");
  const key = `${data.session.user.id}:${normalized}`;
  if (pending.has(key)) { posStampRequestStats.shared += 1; return pending.get(key); }
  const saved = cache.get(key);
  if (!force && saved && Date.now() - saved.at < 60000) { posStampRequestStats.hits += 1; return saved.value; }
  posStampRequestStats.requests += 1;
  const version = generation;
  const controller = new globalThis.AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  const request = supabase.rpc("get_stamp_summary", { p_phone: normalized }).abortSignal(controller.signal).then(({ data: result, error }) => {
    if (error) throw error;
    if (version === generation) cache.set(key, { value: result, at: Date.now() });
    return result;
  }).finally(() => { clearTimeout(timeout); if (pending.get(key) === request) pending.delete(key); });
  pending.set(key, request);
  return request;
}
export async function withPosStampSummary(order = {}, phone = "", options = {}) {
  if (order.stampSummary) return order;
  try { return { ...order, stampSummary: await readPosStamps(phone || order.customerPhone || order.customer_phone, options) }; }
  catch { return order; }
}
export function makePosStampGift(product, phone) {
  return { ...product, cartId: `stamp-${product.id}`, quantity: 1, price: 0, unitTotal: 0, lineTotal: 0,
    originalPrice: undefined, originalLineTotal: undefined, salePrice: undefined,
    selectedOptions: [], toppings: [], note: "Quà đổi 10 tem", stampGift: true,
    stampPhone: normalizeCustomerPhone(phone), metadata: { stampGift: true } };
}
export default { readPosStamps, makePosStampGift, invalidatePosStamps };
