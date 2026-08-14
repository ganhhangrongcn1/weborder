import { getAdminSupabaseClient } from "./supabase/adminSupabaseClient.js";

const DASHBOARD_REVENUE_RPC = "get_admin_dashboard_revenue_series";
const MISSING_RPC_CODES = new Set(["42883", "PGRST202"]);

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
  };
}

function mapRevenueSeries(row = {}) {
  return {
    source: "rpc",
    metrics: mapMetrics(row.metrics),
    dailyRevenue: (row.daily_revenue || []).map((item) => ({
      date: String(item.date || ""),
      totalOrders: toNumber(item.total_orders),
      netRevenue: toNumber(item.net_revenue),
    })),
  };
}

function mergeRevenueSeries(seriesList = []) {
  const daily = new Map();
  seriesList.forEach((series) => {
    (series?.dailyRevenue || []).forEach((item) => {
      const current = daily.get(item.date) || { date: item.date, totalOrders: 0, netRevenue: 0 };
      current.totalOrders += toNumber(item.totalOrders);
      current.netRevenue += toNumber(item.netRevenue);
      daily.set(item.date, current);
    });
  });
  const totalOrders = seriesList.reduce((sum, item) => sum + toNumber(item?.metrics?.totalOrders), 0);
  const netRevenue = seriesList.reduce((sum, item) => sum + toNumber(item?.metrics?.netRevenue), 0);
  const sumMetric = (key) => seriesList.reduce((sum, item) => sum + toNumber(item?.metrics?.[key]), 0);
  return {
    source: "rpc",
    metrics: {
      totalOrders,
      netRevenue,
      averageOrderValue: totalOrders ? netRevenue / totalOrders : 0,
      pendingOrders: sumMetric("pendingOrders"),
      preparingOrders: sumMetric("preparingOrders"),
      deliveringOrders: sumMetric("deliveringOrders"),
      cancelledOrders: sumMetric("cancelledOrders"),
      completedOrders: sumMetric("completedOrders"),
    },
    dailyRevenue: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

async function callRevenueRpc(client, dateRange = {}, { includeBranchUuid = true } = {}) {
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
  return client.rpc(DASHBOARD_REVENUE_RPC, params);
}

export async function getAdminDashboardRevenueSeriesRpc(dateRange = {}) {
  const client = await getAdminSupabaseClient();
  if (!client || !dateRange.dateFrom || !dateRange.dateTo) return null;

  const { data, error } = await callRevenueRpc(client, dateRange, {
    includeBranchUuid: true,
  });

  if (error) {
    if (MISSING_RPC_CODES.has(String(error.code || ""))) return null;
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapRevenueSeries(row) : null;
}

export async function getAdminDashboardRevenueSeriesForBranchesRpc(dateRange = {}, branchOptions = []) {
  const safeBranches = Array.isArray(branchOptions) ? branchOptions.filter((item) => item?.value) : [];
  if (!safeBranches.length) return getAdminDashboardRevenueSeriesRpc(dateRange);
  const series = await Promise.all(safeBranches.map((branch) => getAdminDashboardRevenueSeriesRpc({
    ...dateRange,
    branchUuid: branch.value,
    branchName: branch.label,
    branchFilter: branch.label,
  })));
  const available = series.filter(Boolean);
  return available.length ? mergeRevenueSeries(available) : null;
}

export default {
  getAdminDashboardRevenueSeriesRpc,
  getAdminDashboardRevenueSeriesForBranchesRpc,
};
