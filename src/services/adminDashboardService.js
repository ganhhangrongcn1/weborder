import {
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient,
} from "./supabase/supabaseRuntimeClient.js";

const DASHBOARD_SUMMARY_RPC = "get_admin_dashboard_summary";
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
    cancelRate: toNumber(metrics.cancel_rate),
  };
}

function mapSummary(row = {}) {
  return {
    source: "rpc",
    totalCustomers: toNumber(row.total_customers),
    current: mapMetrics(row.current_metrics),
    previous: mapMetrics(row.previous_metrics),
    week: mapMetrics(row.week_metrics),
    channels: Array.isArray(row.channel_breakdown)
      ? row.channel_breakdown.map((item) => ({
          channel: String(item.channel || "website"),
          totalOrders: toNumber(item.total_orders),
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

export async function getAdminDashboardSummaryRpc(dateRange = {}) {
  const client = getSupabaseRuntimeClient() || (await initSupabaseRuntimeClient());
  if (!client || !dateRange.dateFrom || !dateRange.dateTo) return null;

  let { data, error } = await callDashboardSummaryRpc(client, dateRange, {
    includeBranchUuid: true,
  });
  if (error && MISSING_RPC_CODES.has(String(error.code || ""))) {
    ({ data, error } = await callDashboardSummaryRpc(client, dateRange, {
      includeBranchUuid: false,
    }));
  }

  if (error) {
    if (MISSING_RPC_CODES.has(String(error.code || ""))) return null;
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapSummary(row) : null;
}

export default {
  getAdminDashboardSummaryRpc,
};
