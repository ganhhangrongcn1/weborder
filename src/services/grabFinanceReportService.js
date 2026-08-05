import { getAdminSupabaseClient } from "./supabase/adminSupabaseClient.js";
const FUNCTION_NAME = "partner-review-source-api";

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const DETAIL_FIELDS = [
  "orderValueAmount", "merchantDiscountAmount", "deliveryDiscountAmount", "voucherAmount", "offerAmount",
  "advertisingAmount", "advertisingTaxAmount", "serviceFeeAmount", "channelCommissionAmount",
  "deliveryCommissionAmount", "commissionTaxAmount", "vatAmount", "withholdingTaxAmount",
  "merchantChargesAmount", "detailedTransactionCount"
];

function normalizeDetails(value = {}) {
  return Object.fromEntries(DETAIL_FIELDS.map((field) => [field, toNumber(value?.[field])]));
}

function normalizeDailyTotals(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({ ...item, ...normalizeDetails(item) }));
}

export async function getGrabFinanceReport({ fromDate, toDate, branchOption = null } = {}) {
  const client = await getAdminSupabaseClient();
  if (!client || !fromDate || !toDate) return null;

  const { data, error } = await client.functions.invoke(FUNCTION_NAME, {
    body: {
      action: "finance_report",
      from_date: fromDate,
      to_date: toDate,
      branch_uuid: branchOption?.value || ""
    }
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || "Không thể tải báo cáo tài chính Grab.");

  const accounts = (Array.isArray(data.data?.accounts) ? data.data.accounts : []).map((account) => ({
    ...account,
    grossSalesAmount: toNumber(account?.grossSalesAmount),
    netRevenueAmount: toNumber(account?.netRevenueAmount),
    netIncomeAmount: toNumber(account?.netIncomeAmount),
    totalOrders: toNumber(account?.totalOrders),
    totalPayments: toNumber(account?.totalPayments),
    ...normalizeDetails(account),
    dailyTotals: normalizeDailyTotals(account?.dailyTotals)
  }));

  return {
    source: "grab-finance-api",
    fromDate: String(data.data?.fromDate || fromDate),
    toDate: String(data.data?.toDate || toDate),
    currency: String(data.data?.currency || "VND"),
    netRevenueAmount: toNumber(data.data?.netRevenueAmount),
    netIncomeAmount: toNumber(data.data?.netIncomeAmount),
    grossSalesAmount: toNumber(data.data?.grossSalesAmount),
    totalOrders: toNumber(data.data?.totalOrders),
    totalPayments: toNumber(data.data?.totalPayments),
    accountCount: toNumber(data.data?.accountCount),
    snapshotCount: toNumber(data.data?.snapshotCount),
    ...normalizeDetails(data.data),
    lastSyncedAt: data.data?.lastSyncedAt || null,
    dailyTotals: normalizeDailyTotals(data.data?.dailyTotals),
    accounts
  };
}

export default { getGrabFinanceReport };
