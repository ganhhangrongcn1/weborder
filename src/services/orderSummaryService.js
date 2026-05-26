import { calculateOrderPoints, getLoyaltyRuleConfigAsync } from "./loyaltyService.js";
import { getCustomerKey } from "./storageService.js";
import { getSupabaseRuntimeClient, initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";

const PAGE_SIZE = 1000;

const EMPTY_SUMMARY = {
  totalOrders: 0,
  totalSpent: 0,
  claimedPoints: 0,
  pendingPoints: 0
};

function normalizeStatus(value = "") {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "");
}

function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isCancelledStatus(...values) {
  return values.some((value) => ["cancel", "canceled", "cancelled", "huy", "dahuy", "refunded"].includes(normalizeStatus(value)));
}

function isCompletedStatus(...values) {
  return values.some((value) => ["done", "completed", "complete", "finish", "finished", "served", "hoantat"].includes(normalizeStatus(value)));
}

function getOrderIds(order = {}) {
  return [
    order.id,
    order.order_code,
    order.display_order_code,
    order.partner_order_code
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

async function fetchAllPages(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function buildEarnedLookup(ledgerRows = []) {
  const orderIds = new Set();
  const partnerOrderIds = new Set();
  let claimedPoints = 0;

  (Array.isArray(ledgerRows) ? ledgerRows : []).forEach((entry) => {
    const type = String(entry.entry_type || "").toUpperCase();
    const points = toNumber(entry.points);
    if (!["ORDER_EARN", "PARTNER_ORDER_EARN"].includes(type) || points <= 0) return;

    claimedPoints += points;
    const orderId = String(entry.order_id || "").trim();
    const partnerOrderId = String(entry.partner_order_id || "").trim();
    const partnerOrderCode = String(entry.partner_order_code || "").trim();

    if (orderId) orderIds.add(orderId);
    if (partnerOrderId) partnerOrderIds.add(partnerOrderId);
    if (partnerOrderCode) orderIds.add(partnerOrderCode);
  });

  return { orderIds, partnerOrderIds, claimedPoints };
}

async function getClient() {
  return getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
}

export async function getCustomerOrderSummary(phone = "") {
  const phoneKey = getCustomerKey(phone);
  if (!phoneKey) return { ...EMPTY_SUMMARY };

  const client = await getClient();
  if (!client) return { ...EMPTY_SUMMARY };

  const [webOrders, partnerOrders, ledgerRows, loyaltyRule] = await Promise.all([
    fetchAllPages(() => client
      .from("orders")
      .select("id,order_code,status,total_amount,points_earned,customer_phone")
      .eq("customer_phone", phoneKey)
      .order("created_at", { ascending: false })),
    fetchAllPages(() => client
      .from("partner_orders")
      .select("id,order_code,display_order_code,customer_phone,customer_phone_key,total_amount,points_base_amount,point_status,order_status,nexpos_status")
      .eq("customer_phone_key", phoneKey)
      .order("order_time", { ascending: false })),
    fetchAllPages(() => client
      .from("loyalty_ledger")
      .select("entry_type,order_id,partner_order_id,partner_order_code,points,amount")
      .eq("customer_phone", phoneKey)),
    getLoyaltyRuleConfigAsync()
  ]);

  const earnedLookup = buildEarnedLookup(ledgerRows);
  const summary = { ...EMPTY_SUMMARY, claimedPoints: earnedLookup.claimedPoints };

  webOrders.forEach((order) => {
    if (isCancelledStatus(order.status)) return;

    const total = toNumber(order.total_amount);
    summary.totalOrders += 1;
    summary.totalSpent += total;

    const alreadyEarned = getOrderIds(order).some((id) => earnedLookup.orderIds.has(id));
    const points = toNumber(order.points_earned) || calculateOrderPoints(total, loyaltyRule);
    if (!alreadyEarned && isCompletedStatus(order.status) && points > 0) {
      summary.pendingPoints += points;
    }
  });

  partnerOrders.forEach((order) => {
    if (isCancelledStatus(order.order_status, order.nexpos_status)) return;

    const total = toNumber(order.total_amount);
    const pointBase = toNumber(order.points_base_amount) || total;
    const points = calculateOrderPoints(pointBase, loyaltyRule);
    const pointStatus = String(order.point_status || "pending").toLowerCase();
    const alreadyEarned = earnedLookup.partnerOrderIds.has(String(order.id || "").trim()) ||
      getOrderIds(order).some((id) => earnedLookup.orderIds.has(id));

    summary.totalOrders += 1;
    summary.totalSpent += total;

    if (!alreadyEarned && pointStatus === "claimed" && points > 0) {
      summary.claimedPoints += points;
      return;
    }

    if (!alreadyEarned && !["claimed", "rejected", "expired"].includes(pointStatus) && points > 0) {
      summary.pendingPoints += points;
    }
  });

  return {
    totalOrders: summary.totalOrders,
    totalSpent: Math.round(summary.totalSpent),
    claimedPoints: Math.round(summary.claimedPoints),
    pendingPoints: Math.round(summary.pendingPoints)
  };
}
