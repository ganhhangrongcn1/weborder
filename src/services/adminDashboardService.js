import { getAdminSupabaseClient } from "./supabase/adminSupabaseClient.js";

const DASHBOARD_SUMMARY_RPC = "get_admin_dashboard_summary";
const MISSING_RPC_CODES = new Set(["42883", "PGRST202"]);
const DASHBOARD_SUMMARY_CACHE_TTL_MS = 60000;
const dashboardSummaryCache = new Map();
const dashboardSummaryInFlight = new Map();

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapMetrics(metrics = {}) {
  return {
    totalOrders: toNumber(metrics.total_orders),
    netRevenue: toNumber(metrics.net_revenue),
    averageOrderValue: toNumber(metrics.average_order_value),
    pendingOrders: toNumber(metrics.pending_orders),
    preparingOrders: toNumber(metrics.preparing_orders),
    deliveringOrders: toNumber(metrics.delivering_orders),
    cancelledOrders: toNumber(metrics.cancelled_orders),
    completedOrders: toNumber(metrics.completed_orders),
    cancelRate: toNumber(metrics.cancel_rate),
  };
}

function mapSummary(row = {}) {
  return {
    source: "rpc",
    totalCustomers: toNumber(row.total_customers),
    periodCustomers: toNumber(row.period_customers),
    current: mapMetrics(row.current_metrics),
    previous: mapMetrics(row.previous_metrics),
    week: mapMetrics(row.week_metrics),
    channels: Array.isArray(row.channel_breakdown)
      ? row.channel_breakdown.map((item) => ({
          channel: String(item.channel || "website"),
          totalOrders: toNumber(item.total_orders),
          revenueOrderCount: toNumber(item.revenue_order_count),
          netRevenue: toNumber(item.net_revenue),
        }))
      : [],
  };
}

async function callDashboardSummaryRpc(client, dateRange = {}, { includeBranchUuid = true } = {}) {
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
  return client.rpc(DASHBOARD_SUMMARY_RPC, params);
}

function mergeMetrics(items = []) {
  const merged = items.reduce((result, item) => ({
    totalOrders: result.totalOrders + toNumber(item?.totalOrders),
    netRevenue: result.netRevenue + toNumber(item?.netRevenue),
    pendingOrders: result.pendingOrders + toNumber(item?.pendingOrders),
    preparingOrders: result.preparingOrders + toNumber(item?.preparingOrders),
    deliveringOrders: result.deliveringOrders + toNumber(item?.deliveringOrders),
    cancelledOrders: result.cancelledOrders + toNumber(item?.cancelledOrders),
    completedOrders: result.completedOrders + toNumber(item?.completedOrders),
  }), {
    totalOrders: 0,
    netRevenue: 0,
    pendingOrders: 0,
    preparingOrders: 0,
    deliveringOrders: 0,
    cancelledOrders: 0,
    completedOrders: 0,
  });
  return {
    ...merged,
    averageOrderValue: merged.totalOrders ? merged.netRevenue / merged.totalOrders : 0,
    cancelRate: merged.totalOrders ? merged.cancelledOrders / merged.totalOrders : 0,
  };
}

function mergeDashboardSummaries(summaries = []) {
  const channels = new Map();
  summaries.forEach((summary) => {
    (summary?.channels || []).forEach((item) => {
      const current = channels.get(item.channel) || { channel: item.channel, totalOrders: 0, revenueOrderCount: 0, netRevenue: 0 };
      current.totalOrders += toNumber(item.totalOrders);
      current.revenueOrderCount += toNumber(item.revenueOrderCount);
      current.netRevenue += toNumber(item.netRevenue);
      channels.set(item.channel, current);
    });
  });
  return {
    source: "rpc",
    totalCustomers: summaries.reduce((sum, item) => sum + toNumber(item?.totalCustomers), 0),
    periodCustomers: summaries.reduce((sum, item) => sum + toNumber(item?.periodCustomers), 0),
    current: mergeMetrics(summaries.map((item) => item?.current)),
    previous: mergeMetrics(summaries.map((item) => item?.previous)),
    week: mergeMetrics(summaries.map((item) => item?.week)),
    channels: [...channels.values()],
  };
}

function buildDashboardSummaryCacheKey(dateRange = {}) {
  return [
    String(dateRange.dateFrom || ""),
    String(dateRange.dateTo || ""),
    String(dateRange.branchUuid || ""),
    String(dateRange.branchName || dateRange.branchFilter || "")
  ].join("|");
}

export async function getAdminDashboardSummaryRpc(dateRange = {}, { force = false } = {}) {
  const client = await getAdminSupabaseClient();
  if (!client || !dateRange.dateFrom || !dateRange.dateTo) return null;

  const cacheKey = buildDashboardSummaryCacheKey(dateRange);
  const cached = dashboardSummaryCache.get(cacheKey);
  if (!force && cached && Date.now() - cached.cachedAt < DASHBOARD_SUMMARY_CACHE_TTL_MS) {
    return cached.value;
  }
  if (dashboardSummaryInFlight.has(cacheKey)) {
    return dashboardSummaryInFlight.get(cacheKey);
  }

  const request = (async () => {
    const { data, error } = await callDashboardSummaryRpc(client, dateRange, {
      includeBranchUuid: true,
    });

    if (error) {
      if (MISSING_RPC_CODES.has(String(error.code || ""))) return null;
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const value = row ? mapSummary(row) : null;
    if (value) {
      dashboardSummaryCache.set(cacheKey, {
        cachedAt: Date.now(),
        value
      });
    }
    return value;
  })().finally(() => {
    dashboardSummaryInFlight.delete(cacheKey);
  });

  dashboardSummaryInFlight.set(cacheKey, request);
  return request;
}

export async function getAdminDashboardSummaryForBranchesRpc(dateRange = {}, branchOptions = [], options = {}) {
  const safeBranches = Array.isArray(branchOptions) ? branchOptions.filter((item) => item?.value) : [];
  if (!safeBranches.length) return getAdminDashboardSummaryRpc(dateRange, options);
  const summaries = await Promise.all(safeBranches.map((branch) => getAdminDashboardSummaryRpc({
    ...dateRange,
    branchUuid: branch.value,
    branchName: branch.label,
    branchFilter: branch.label,
  }, options)));
  const available = summaries.filter(Boolean);
  return available.length ? mergeDashboardSummaries(available) : null;
}

export default {
  getAdminDashboardSummaryRpc,
  getAdminDashboardSummaryForBranchesRpc,
};
