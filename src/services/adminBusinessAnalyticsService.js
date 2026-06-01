import {
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient,
} from "./supabase/supabaseRuntimeClient.js";

const BUSINESS_ANALYTICS_RPC = "get_admin_business_analytics";
const MISSING_RPC_CODES = new Set(["42883", "PGRST202"]);

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
      branchName: String(item.branch_name || "Chưa xác định"),
      totalOrders: toNumber(item.total_orders),
      grossRevenue: toNumber(item.gross_revenue),
      netRevenue: toNumber(item.net_revenue),
      averageOrderValue: toNumber(item.average_order_value),
    })),
  };
}

export async function getAdminBusinessAnalyticsRpc(dateRange = {}) {
  const client = getSupabaseRuntimeClient() || (await initSupabaseRuntimeClient());
  if (!client || !dateRange.dateFrom || !dateRange.dateTo) return null;

  const branchFilter = String(dateRange.branchFilter || "").trim();

  const { data, error } = await client.rpc(BUSINESS_ANALYTICS_RPC, {
    p_date_from: dateRange.dateFrom,
    p_date_to: dateRange.dateTo,
    p_branch_name: branchFilter || null,
  });

  if (error) {
    if (MISSING_RPC_CODES.has(String(error.code || ""))) return null;
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapSummary(row) : null;
}

export default {
  getAdminBusinessAnalyticsRpc,
};
