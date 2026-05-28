import { getCustomerKey } from "./storageService.js";
import { getSupabaseRuntimeClient, initSupabaseRuntimeClient } from "./supabase/supabaseRuntimeClient.js";

const RPC_MISSING_CODES = new Set(["42883", "PGRST202"]);
const RPC_UNAVAILABLE_TTL_MS = 5 * 60 * 1000;
const unavailableRpcCache = new Map();

function toText(value = "") {
  return String(value || "").trim();
}

function toNumber(value = 0, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isMissingRpcError(error) {
  const code = toText(error?.code);
  const message = toText(error?.message).toLowerCase();

  if (RPC_MISSING_CODES.has(code)) return true;

  return [
    "could not find the function",
    "function public.",
    "does not exist"
  ].some((needle) => message.includes(needle));
}

function isRpcTemporarilyUnavailable(name = "") {
  const key = toText(name);
  if (!key) return false;

  const cachedAt = unavailableRpcCache.get(key);
  if (!cachedAt) return false;

  if (Date.now() - cachedAt > RPC_UNAVAILABLE_TTL_MS) {
    unavailableRpcCache.delete(key);
    return false;
  }

  return true;
}

function markRpcTemporarilyUnavailable(name = "", error = null) {
  if (!isMissingRpcError(error)) return;

  const key = toText(name);
  if (!key) return;
  unavailableRpcCache.set(key, Date.now());
}

async function getClientReady() {
  return getSupabaseRuntimeClient() || await initSupabaseRuntimeClient();
}

function mapOrderSummaryRow(row = {}) {
  return {
    totalOrders: Math.max(0, toNumber(row.total_orders, 0)),
    totalSpent: Math.round(Math.max(0, toNumber(row.total_spent, 0))),
    claimedPoints: Math.round(Math.max(0, toNumber(row.claimed_points, 0))),
    pendingPoints: Math.round(Math.max(0, toNumber(row.pending_points, 0)))
  };
}

function mapMonthlyGiftStatsRow(row = {}) {
  const claimed = Boolean(row.claimed);

  return {
    monthlyOrderCount: Math.max(0, toNumber(row.monthly_order_count, 0)),
    allTimeStats: {
      totalOrders: Math.max(0, toNumber(row.total_orders, 0)),
      totalSpent: Math.max(0, toNumber(row.total_spent, 0))
    },
    claim: claimed
      ? {
          id: toText(row.claim_id),
          claimed_at: row.claimed_at || "",
          claimed_order_code: toText(row.claimed_order_code),
          claimed_by_name: toText(row.claimed_by_name),
          order_count_at_claim: Math.max(0, toNumber(row.order_count_at_claim, 0))
        }
      : null
  };
}

export async function getCustomerOrderCountSummaryRpc(phone = "") {
  const phoneKey = getCustomerKey(phone);
  const rpcName = "get_customer_order_count_summary";

  if (!phoneKey || isRpcTemporarilyUnavailable(rpcName)) return null;

  const client = await getClientReady();
  if (!client) return null;

  try {
    const { data, error } = await client.rpc(rpcName, {
      p_phone: phoneKey
    });

    if (error) {
      markRpcTemporarilyUnavailable(rpcName, error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    return mapOrderSummaryRow(row);
  } catch (error) {
    markRpcTemporarilyUnavailable(rpcName, error);
    return null;
  }
}

export async function getMonthlyCustomerGiftStatsByPhonesRpc({
  monthKey = "",
  phoneKeys = []
} = {}) {
  const rpcName = "get_monthly_customer_gift_stats_by_phones";
  const normalizedPhones = [...new Set(
    (Array.isArray(phoneKeys) ? phoneKeys : [])
      .map((phone) => getCustomerKey(phone))
      .filter(Boolean)
  )];

  if (!toText(monthKey) || !normalizedPhones.length || isRpcTemporarilyUnavailable(rpcName)) {
    return null;
  }

  const client = await getClientReady();
  if (!client) return null;

  try {
    const { data, error } = await client.rpc(rpcName, {
      p_reward_month: toText(monthKey),
      p_customer_phones: normalizedPhones
    });

    if (error) {
      markRpcTemporarilyUnavailable(rpcName, error);
      return null;
    }

    const rows = Array.isArray(data) ? data : [];
    const statsMap = new Map();

    rows.forEach((row) => {
      const customerKey = getCustomerKey(row?.customer_key || row?.customer_phone || "");
      if (!customerKey) return;
      statsMap.set(customerKey, mapMonthlyGiftStatsRow(row));
    });

    return statsMap;
  } catch (error) {
    markRpcTemporarilyUnavailable(rpcName, error);
    return null;
  }
}

export default {
  getCustomerOrderCountSummaryRpc,
  getMonthlyCustomerGiftStatsByPhonesRpc
};
