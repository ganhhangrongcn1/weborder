import { calculateOrderPoints, getLoyaltyRuleConfigAsync } from "./loyaltyService.js";
import {
  EMPTY_ORDER_COUNT_SUMMARY,
  appendOrderCountSummary,
  buildOrderCountingPhoneVariants,
  isCompletedOrderForCounting,
  isExcludedOrderForCounting,
  toOrderCountingNumber
} from "./customerOrderCountingService.js";
import { getCustomerOrderCountSummaryRpc } from "./customerOrderCountingRpcService.js";
import { getCustomerKey } from "./storageService.js";
import { getSupabaseRuntimeClient, initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";
import {
  buildLoyaltyOrderPointLookup,
  getNetOrderPoints
} from "./loyaltyLedgerUtils.js";

const PAGE_SIZE = 1000;

const EMPTY_SUMMARY = {
  ...EMPTY_ORDER_COUNT_SUMMARY,
  claimedPoints: 0,
  pendingPoints: 0
};

function normalizeLedgerRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((entry) => ({
    type: entry.entry_type,
    orderId: entry.order_id,
    partnerOrderId: entry.partner_order_id,
    partnerOrderCode: entry.partner_order_code,
    points: Number(entry.points || 0),
    amount: Number(entry.amount || 0)
  }));
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

function mergeRowsById(...collections) {
  const rowMap = new Map();

  collections.flat().forEach((row) => {
    const id = String(row?.id || row?.order_code || "").trim();
    if (!id || rowMap.has(id)) return;
    rowMap.set(id, row);
  });

  return [...rowMap.values()];
}

async function getClient() {
  return getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
}

export async function getCustomerOrderSummary(phone = "") {
  const phoneKey = getCustomerKey(phone);
  if (!phoneKey) return { ...EMPTY_SUMMARY };

  const rpcSummary = await getCustomerOrderCountSummaryRpc(phoneKey);
  if (rpcSummary) return rpcSummary;

  const client = await getClient();
  if (!client) return { ...EMPTY_SUMMARY };

  const phoneVariants = buildOrderCountingPhoneVariants([phoneKey]);

  const [webOrdersByPhone, partnerOrdersByKey, partnerOrdersByPhone, rawLedgerRows, loyaltyRule] = await Promise.all([
    fetchAllPages(() => client
      .from("orders")
      .select("id,order_code,status,total_amount,points_earned,customer_phone")
      .in("customer_phone", phoneVariants)
      .order("created_at", { ascending: false })),
    fetchAllPages(() => client
      .from("partner_orders")
      .select("id,order_code,display_order_code,customer_phone,customer_phone_key,total_amount,points_base_amount,point_status,order_status,nexpos_status")
      .in("customer_phone_key", phoneVariants)
      .order("order_time", { ascending: false })),
    fetchAllPages(() => client
      .from("partner_orders")
      .select("id,order_code,display_order_code,customer_phone,customer_phone_key,total_amount,points_base_amount,point_status,order_status,nexpos_status")
      .in("customer_phone", phoneVariants)
      .order("order_time", { ascending: false })),
    fetchAllPages(() => client
      .from("loyalty_ledger")
      .select("entry_type,order_id,partner_order_id,partner_order_code,points,amount")
      .in("customer_phone", phoneVariants)),
    getLoyaltyRuleConfigAsync()
  ]);

  const webOrders = mergeRowsById(webOrdersByPhone);
  const partnerOrders = mergeRowsById(partnerOrdersByKey, partnerOrdersByPhone);
  const loyaltyLookup = buildLoyaltyOrderPointLookup(normalizeLedgerRows(rawLedgerRows));

  const claimedPoints = [
    ...webOrders.map((order) => getNetOrderPoints(loyaltyLookup, {
      id: order.id,
      orderCode: order.order_code
    })),
    ...partnerOrders.map((order) => getNetOrderPoints(loyaltyLookup, {
      sourceType: "partner",
      id: order.id,
      orderCode: order.order_code,
      displayOrderCode: order.display_order_code,
      partnerOrderId: order.id,
      partnerOrderCode: order.display_order_code || order.order_code
    }))
  ].reduce((sum, points) => sum + Math.max(0, Number(points || 0)), 0);

  const summary = { ...EMPTY_SUMMARY, claimedPoints };

  webOrders.forEach((order) => {
    if (isExcludedOrderForCounting(order.status)) return;

    const total = toOrderCountingNumber(order.total_amount);
    Object.assign(summary, appendOrderCountSummary(summary, total, 1));

    const netPoints = getNetOrderPoints(loyaltyLookup, {
      id: order.id,
      orderCode: order.order_code
    });
    const points = toOrderCountingNumber(order.points_earned) || calculateOrderPoints(total, loyaltyRule);
    if (netPoints <= 0 && isCompletedOrderForCounting(order.status) && points > 0) {
      summary.pendingPoints += points;
    }
  });

  partnerOrders.forEach((order) => {
    if (isExcludedOrderForCounting(order.order_status, order.nexpos_status)) return;

    const total = toOrderCountingNumber(order.total_amount);
    const pointBase = toOrderCountingNumber(order.points_base_amount) || total;
    const points = calculateOrderPoints(pointBase, loyaltyRule);
    const pointStatus = String(order.point_status || "pending").toLowerCase();
    const netPoints = getNetOrderPoints(loyaltyLookup, {
      sourceType: "partner",
      id: order.id,
      orderCode: order.order_code,
      displayOrderCode: order.display_order_code,
      partnerOrderId: order.id,
      partnerOrderCode: order.display_order_code || order.order_code
    });

    Object.assign(summary, appendOrderCountSummary(summary, total, 1));

    if (netPoints <= 0 && !["claimed", "rejected", "expired"].includes(pointStatus) && points > 0) {
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
