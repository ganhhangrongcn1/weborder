import {
  getSupabaseRuntimeClient,
  initSupabaseRuntimeClient,
} from "./supabase/supabaseRuntimeClient.js";

const CRM_ANALYTICS_RPC = "get_admin_crm_analytics";
const MISSING_RPC_CODES = new Set(["42883", "PGRST202"]);

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapCustomer(item = {}) {
  return {
    phone: String(item.customer_phone || ""),
    name: String(item.customer_name || "Khách hàng"),
    profileSource: String(item.profile_source || "profile"),
    totalOrders: toNumber(item.total_orders),
    rawOrderCount: toNumber(item.raw_order_count),
    totalSpent: toNumber(item.total_spent),
    firstOrderAt: item.first_order_at || null,
    lastOrderAt: item.last_order_at || null,
    daysSinceLastOrder: item.days_since_last_order === null ? null : toNumber(item.days_since_last_order),
    lastBranch: String(item.last_branch || "Chưa xác định"),
    lastChannel: String(item.last_channel || "website"),
    orders30Days: toNumber(item.orders_30_days),
    isVip: Boolean(item.is_vip),
    voucherSegment: String(item.voucher_segment || "none"),
  };
}

function mapTopCustomer(item = {}) {
  return {
    phone: String(item.customer_phone || ""),
    name: String(item.customer_name || "Khách hàng"),
    totalOrders: toNumber(item.total_orders),
    totalSpent: toNumber(item.total_spent),
  };
}

function mapSummary(row = {}) {
  const summary = row.summary || {};
  const options = row.filter_options || {};
  const customers = (row.customers || []).map(mapCustomer);
  return {
    source: "rpc",
    summary: {
      totalCustomers: toNumber(summary.total_customers),
      customersWithOrders: toNumber(summary.customers_with_orders),
      repeatCustomers30Days: toNumber(summary.repeat_customers_30_days),
      repeatRate30Days: toNumber(summary.repeat_rate_30_days),
      newCustomers7Days: toNumber(summary.new_customers_7_days),
      newCustomers30Days: toNumber(summary.new_customers_30_days),
      inactive7Days: toNumber(summary.inactive_7_days),
      inactive15Days: toNumber(summary.inactive_15_days),
      inactive30Days: toNumber(summary.inactive_30_days),
      vipCustomers: toNumber(summary.vip_customers),
    },
    customers,
    customersByPhone: new Map(customers.map((customer) => [customer.phone, customer])),
    topBySpent: (row.top_customers_by_spent || []).map(mapTopCustomer),
    topByOrders: (row.top_customers_by_orders || []).map(mapTopCustomer),
    filterOptions: {
      branches: Array.isArray(options.branches) ? options.branches.map(String) : [],
      channels: Array.isArray(options.channels) ? options.channels.map(String) : [],
    },
    voucherSegments: (row.voucher_segments || []).map((item) => ({
      segment: String(item.segment || "none"),
      customerCount: toNumber(item.customer_count),
    })),
    vipCriteria: {
      minTotalSpent: toNumber(row.vip_criteria?.min_total_spent),
      minTotalOrders: toNumber(row.vip_criteria?.min_total_orders),
      rule: String(row.vip_criteria?.rule || ""),
    },
  };
}

export async function getAdminCrmAnalyticsRpc() {
  const client = getSupabaseRuntimeClient() || (await initSupabaseRuntimeClient());
  if (!client) return null;

  try {
    const { data, error } = await client.rpc(CRM_ANALYTICS_RPC);
    if (error) {
      const message = String(error.message || "").toLowerCase();
      if (
        MISSING_RPC_CODES.has(String(error.code || "")) ||
        message.includes("could not find the function") ||
        message.includes("does not exist")
      ) {
        return null;
      }
      console.warn("[adminCrmAnalyticsService] crm analytics rpc unavailable", error);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    return row ? mapSummary(row) : null;
  } catch (error) {
    console.warn("[adminCrmAnalyticsService] crm analytics rpc failed", error);
    return null;
  }
}

export default {
  getAdminCrmAnalyticsRpc,
};
