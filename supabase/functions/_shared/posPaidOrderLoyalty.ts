import { createClient } from "npm:@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;

function toText(value: unknown = "") {
  return String(value ?? "").trim();
}

function toNumber(value: unknown = 0) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function getObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function normalizeSourceKey(value: unknown = "") {
  return toText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function settlePaidPosOrderLoyalty(
  supabase: ReturnType<typeof createClient>,
  order: JsonRecord
) {
  const orderId = toText(order.id);
  const metadata = getObject(order.metadata);
  const phone = toText(order.customer_phone);
  if (!orderId || !phone || toText(metadata.source).toLowerCase() !== "pos_mobile") return;

  const pointsSpent = Math.max(0, Math.floor(toNumber(metadata.pointsSpent)));
  if (pointsSpent > 0) {
    const { error } = await supabase.rpc("process_order_loyalty", {
      p_source_type: "ORDER",
      p_source_order_id: orderId,
      p_action: "SPEND",
      p_idempotency_key: `loyalty-v2:ORDER:${orderId}:SPEND:v1`
    });
    if (error) throw error;
  }

  if (normalizeSourceKey(metadata.promoSource) !== "loyalty") return;
  const voucherId = toText(metadata.promoVoucherId);
  const voucherCode = toText(order.promo_code || metadata.promoCode).toUpperCase();
  if (!voucherId && !voucherCode) return;

  const { data: account, error: readError } = await supabase
    .from("loyalty_accounts")
    .select("vouchers,metadata")
    .eq("customer_phone", phone)
    .maybeSingle();
  if (readError || !account) return;

  const accountMetadata = getObject(account.metadata);
  const vouchers = Array.isArray(account.vouchers)
    ? account.vouchers
    : Array.isArray(accountMetadata.voucherHistory)
      ? accountMetadata.voucherHistory
      : [];
  const usedAt = new Date().toISOString();
  const nextVouchers = vouchers.map((voucher) => {
    const item = getObject(voucher);
    const sameId = voucherId && toText(item.id) === voucherId;
    const sameCode = voucherCode && toText(item.code).toUpperCase() === voucherCode;
    if (!sameId && !sameCode) return voucher;
    return { ...item, used: true, usedAt, orderCode: orderId };
  });

  await supabase
    .from("loyalty_accounts")
    .update({
      vouchers: nextVouchers,
      metadata: {
        ...accountMetadata,
        voucherHistory: nextVouchers,
        lastVoucherUsedOrderId: orderId,
        lastVoucherUsedAt: usedAt
      },
      updated_at: usedAt
    })
    .eq("customer_phone", phone);
}
