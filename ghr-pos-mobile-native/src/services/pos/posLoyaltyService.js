import { supabase } from "../supabase/client";
import { normalizeCustomerPhone } from "./posCustomerService";

const DEFAULT_LOYALTY_RULE = {
  currencyPerPoint: 100,
  pointPerUnit: 1
};

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

function calculateOrderPoints(amount = 0, loyaltyRule = DEFAULT_LOYALTY_RULE) {
  const currencyPerPoint = Math.max(1, toNumber(loyaltyRule.currencyPerPoint, 100));
  const pointPerUnit = Math.max(1, toNumber(loyaltyRule.pointPerUnit, 1));
  return Math.floor((toNumber(amount, 0) / currencyPerPoint) * pointPerUnit);
}

function isSettlementDone(status = "") {
  return ["done", "completed", "complete", "finish", "finished", "served", "hoan_tat", "hoantat"].includes(
    normalizeSourceKey(status)
  );
}

function normalizeVoucherHistory(row = {}) {
  const vouchers = Array.isArray(row.vouchers)
    ? row.vouchers
    : Array.isArray(getObject(row.metadata).voucherHistory)
      ? getObject(row.metadata).voucherHistory
      : [];
  return vouchers;
}

async function applyLoyaltyEvent({ phone, entryType, points, orderId, amount, title, note, metadata, createdAt }) {
  if (!supabase || !phone || !entryType || !points) return;

  const { error } = await supabase.rpc("apply_loyalty_event", {
    p_customer_phone: phone,
    p_entry_type: entryType,
    p_points: Math.trunc(toNumber(points, 0)),
    p_order_id: toText(orderId) || null,
    p_amount: toNumber(amount, 0),
    p_title: toText(title),
    p_note: toText(note),
    p_metadata: getObject(metadata),
    p_created_at: createdAt || new Date().toISOString()
  });

  if (error) throw error;
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
  amount = 0,
  createdAt = new Date().toISOString(),
  orderStatus = "",
  pointsDiscount = 0,
  promoSource = "",
  promoVoucherId = "",
  promoCode = "",
  loyaltyRule = null
} = {}) {
  const normalizedPhone = normalizeCustomerPhone(phone);
  const normalizedOrderId = toText(orderId);
  if (!supabase || !normalizedPhone || !normalizedOrderId) {
    return { ok: true, skipped: true };
  }

  const rule = {
    ...DEFAULT_LOYALTY_RULE,
    ...getObject(loyaltyRule)
  };
  const spendPoints = Math.max(0, Math.floor(toNumber(pointsDiscount, 0)));
  const earnPoints = isSettlementDone(orderStatus) ? calculateOrderPoints(amount, rule) : 0;
  const tasks = [];

  if (earnPoints > 0) {
    tasks.push(
      applyLoyaltyEvent({
        phone: normalizedPhone,
        entryType: "ORDER_EARN",
        points: earnPoints,
        orderId: normalizedOrderId,
        amount,
        title: `Tích điểm đơn ${normalizedOrderId}`,
        note: "Tích điểm từ đơn POS",
        metadata: {
          source: "pos_mobile",
          type: "ORDER_EARN",
          orderId: normalizedOrderId
        },
        createdAt
      })
    );
  }

  if (spendPoints > 0) {
    tasks.push(
      applyLoyaltyEvent({
        phone: normalizedPhone,
        entryType: "ORDER_SPEND",
        points: -spendPoints,
        orderId: normalizedOrderId,
        amount,
        title: `Dùng điểm đơn ${normalizedOrderId}`,
        note: "Dùng điểm khi thanh toán POS",
        metadata: {
          source: "pos_mobile",
          type: "ORDER_SPEND",
          orderId: normalizedOrderId
        },
        createdAt
      })
    );
  }

  if (tasks.length) {
    await Promise.all(tasks);
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
    pointsEarned: earnPoints,
    pointsSpent: spendPoints,
    voucherUsed: normalizeSourceKey(promoSource) === "loyalty" && Boolean(promoVoucherId || promoCode)
  };
}

export function summarizeOrderLoyaltyWarnings(results = []) {
  return getArray(results)
    .filter((result) => !result?.ok && result?.message)
    .map((result) => result.message)
    .join(" ");
}
