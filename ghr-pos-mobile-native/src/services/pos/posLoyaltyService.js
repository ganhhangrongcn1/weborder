import { supabase } from "../supabase/client";
import { normalizeCustomerPhone } from "./posCustomerService";

function toText(value = "") {
  return String(value ?? "").normalize("NFC").trim();
}

function toNumber(value = 0) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeSourceKey(value = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeVoucherHistory(row = {}) {
  const vouchers = Array.isArray(row.vouchers)
    ? row.vouchers
    : Array.isArray(getObject(row.metadata).voucherHistory)
      ? getObject(row.metadata).voucherHistory
      : [];
  return vouchers;
}

function buildOrderLoyaltyIdempotencyKey(orderId = "", action = "") {
  const safeOrderId = toText(orderId).replace(/\s+/g, "-").slice(0, 120);
  const safeAction = toText(action).toUpperCase();
  return `loyalty-v2:ORDER:${safeOrderId}:${safeAction}:v1`.slice(0, 200);
}

async function processOrderLoyalty({ orderId = "", action = "" } = {}) {
  if (!supabase || !orderId || !action) return null;

  const safeAction = toText(action).toUpperCase();
  const { data, error } = await supabase.rpc("process_order_loyalty", {
    p_source_type: "ORDER",
    p_source_order_id: toText(orderId),
    p_action: safeAction,
    p_idempotency_key: buildOrderLoyaltyIdempotencyKey(orderId, safeAction)
  });
  if (error) throw error;

  return Array.isArray(data) ? data[0] || null : data || null;
}

async function markLoyaltyVoucherUsed({ phone, voucherId = "", voucherCode = "", orderId = "", usedAt = "" }) {
  if (!supabase || !phone || (!voucherId && !voucherCode)) return;

  const { data, error } = await supabase
    .from("loyalty_accounts")
    .select("customer_phone,total_points,vouchers,metadata")
    .eq("customer_phone", phone)
    .maybeSingle();

  if (error || !data) return;

  const normalizedVoucherId = toText(voucherId);
  const normalizedVoucherCode = toText(voucherCode).toUpperCase();
  const nowIso = usedAt || new Date().toISOString();
  const metadata = getObject(data.metadata);
  const nextVouchers = normalizeVoucherHistory(data).map((voucher) => {
    const sameId = normalizedVoucherId && toText(voucher?.id) === normalizedVoucherId;
    const sameCode = normalizedVoucherCode && toText(voucher?.code).toUpperCase() === normalizedVoucherCode;
    if (!sameId && !sameCode) return voucher;
    return {
      ...voucher,
      used: true,
      usedAt: nowIso,
      orderCode: toText(orderId || voucher?.orderCode)
    };
  });

  await supabase
    .from("loyalty_accounts")
    .update({
      vouchers: nextVouchers,
      metadata: {
        ...metadata,
        voucherHistory: nextVouchers,
        lastVoucherUsedOrderId: toText(orderId),
        lastVoucherUsedAt: nowIso
      },
      updated_at: new Date().toISOString()
    })
    .eq("customer_phone", phone);
}

export async function applyPosOrderLoyaltyMobile({
  phone = "",
  orderId = "",
  createdAt = new Date().toISOString(),
  pointsDiscount = 0,
  promoSource = "",
  promoVoucherId = "",
  promoCode = ""
} = {}) {
  const normalizedPhone = normalizeCustomerPhone(phone);
  const normalizedOrderId = toText(orderId);
  if (!supabase || !normalizedPhone || !normalizedOrderId) {
    return { ok: true, skipped: true };
  }

  // POS chỉ gửi SPEND qua loyalty V2 và đánh dấu voucher.
  // Điểm thưởng được loyalty V2 cộng đúng một lần khi bếp hoàn tất đơn.
  const spendPoints = Math.max(0, Math.floor(toNumber(pointsDiscount, 0)));
  let spendResult = null;

  if (spendPoints > 0) {
    spendResult = await processOrderLoyalty({
      orderId: normalizedOrderId,
      action: "SPEND"
    });
  }

  if (normalizeSourceKey(promoSource) === "loyalty" && (promoVoucherId || promoCode)) {
    await markLoyaltyVoucherUsed({
      phone: normalizedPhone,
      voucherId: promoVoucherId,
      voucherCode: promoCode,
      orderId: normalizedOrderId,
      usedAt: createdAt
    });
  }

  return {
    ok: true,
    pointsEarned: 0,
    pointsSpent: spendPoints,
    spendApplied: Boolean(spendResult?.applied),
    voucherUsed: normalizeSourceKey(promoSource) === "loyalty" && Boolean(promoVoucherId || promoCode)
  };
}

export function summarizeOrderLoyaltyWarnings(results = []) {
  return getArray(results)
    .filter((result) => !result?.ok && result?.message)
    .map((result) => result.message)
    .join(" ");
}
