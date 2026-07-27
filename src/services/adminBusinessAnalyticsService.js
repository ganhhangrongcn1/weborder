import { getAdminSupabaseClient } from "./supabase/adminSupabaseClient.js";

const BUSINESS_ANALYTICS_RPC = "get_admin_business_analytics";
const MISSING_RPC_CODES = new Set(["42883", "PGRST202"]);
const BUSINESS_ANALYTICS_CACHE_TTL_MS = 60000;
const businessAnalyticsCache = new Map();
const businessAnalyticsInFlight = new Map();

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapProduct(item = {}) {
  return {
    name: String(item.name || "Món chưa đặt tên"),
    quantity: toNumber(item.quantity),
    revenue: toNumber(item.revenue),
  };
}

function mapSummary(row = {}) {
  const finance = row.finance_summary || {};
  return {
    source: "rpc",
    finance: {
      totalOrders: toNumber(finance.total_orders),
      grossRevenue: toNumber(finance.gross_revenue),
      netRevenue: toNumber(finance.net_revenue),
      discountAmount: toNumber(finance.discount_amount),
      voucherAmount: toNumber(finance.voucher_amount),
      platformFee: toNumber(finance.platform_fee),
      revenueGap: toNumber(finance.revenue_gap),
    },
    topByQuantity: (row.top_products_by_quantity || []).map(mapProduct),
    topByRevenue: (row.top_products_by_revenue || []).map(mapProduct),
    slowProducts: (row.slow_products_30_days || []).map(mapProduct),
    hourlyRevenue: (row.hourly_revenue || []).map((item) => ({
      hour: toNumber(item.hour),
      totalOrders: toNumber(item.total_orders),
      netRevenue: toNumber(item.net_revenue),
    })),
    branches: (row.branch_performance || []).map((item) => ({
      branchUuid: String(item.branch_uuid || ""),
      branchName: String(item.branch_name || "Chưa xác định"),
      totalOrders: toNumber(item.total_orders),
      grossRevenue: toNumber(item.gross_revenue),
      netRevenue: toNumber(item.net_revenue),
      averageOrderValue: toNumber(item.average_order_value),
    })),
    channels: (row.channel_finance || []).map((item) => ({
      group: String(item.group || ""),
      totalOrders: toNumber(item.total_orders),
      grossRevenue: toNumber(item.gross_revenue),
      promotionAmount: toNumber(item.promotion_amount),
      platformFee: toNumber(item.platform_fee),
      netRevenue: toNumber(item.net_revenue),
    })),
  };
}

async function callBusinessAnalyticsRpc(client, dateRange = {}, { includeBranchUuid = true } = {}) {
  const branchName = String(dateRange.branchName || dateRange.branchFilter || "").trim();
  const branchUuid = String(dateRange.branchUuid || "").trim();
  const params = {
    p_date_from: dateRange.dateFrom,
    p_date_to: dateRange.dateTo,
    p_branch_name: branchName || null,
  };
  if (includeBranchUuid) {
    params.p_branch_uuid = branchUuid || null;
  }
  return client.rpc(BUSINESS_ANALYTICS_RPC, params);
}

function buildBusinessAnalyticsCacheKey(dateRange = {}) {
  return [
    String(dateRange.dateFrom || ""),
    String(dateRange.dateTo || ""),
    String(dateRange.branchUuid || ""),
    String(dateRange.branchName || dateRange.branchFilter || "")
  ].join("|");
}

export async function getAdminBusinessAnalyticsRpc(dateRange = {}) {
  const client = await getAdminSupabaseClient();
  if (!client || !dateRange.dateFrom || !dateRange.dateTo) return null;

  const cacheKey = buildBusinessAnalyticsCacheKey(dateRange);
  const cached = businessAnalyticsCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < BUSINESS_ANALYTICS_CACHE_TTL_MS) {
    return cached.value;
  }
  if (businessAnalyticsInFlight.has(cacheKey)) {
    return businessAnalyticsInFlight.get(cacheKey);
  }

  const request = (async () => {
    const { data, error } = await callBusinessAnalyticsRpc(client, dateRange, {
      includeBranchUuid: true,
    });

    if (error) {
      if (MISSING_RPC_CODES.has(String(error.code || ""))) return null;
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const value = row ? mapSummary(row) : null;
    if (value) {
      businessAnalyticsCache.set(cacheKey, {
        cachedAt: Date.now(),
        value
      });
    }
    return value;
  })().finally(() => {
    businessAnalyticsInFlight.delete(cacheKey);
  });

  businessAnalyticsInFlight.set(cacheKey, request);
  return request;
}

export default {
  getAdminBusinessAnalyticsRpc,
};
