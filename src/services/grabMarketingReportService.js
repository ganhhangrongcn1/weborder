import { getAdminSupabaseClient } from "./supabase/adminSupabaseClient.js";

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const normalize = (item = {}) => ({
  ...item,
  spendAmount: number(item.spendAmount), salesAmount: number(item.salesAmount),
  ordersCount: number(item.ordersCount), impressionsCount: number(item.impressionsCount),
  clicksCount: number(item.clicksCount), costPerOrder: item.costPerOrder == null ? null : number(item.costPerOrder),
  roas: item.roas == null ? null : number(item.roas), ctr: item.ctr == null ? null : number(item.ctr)
});

export async function getGrabMarketingReport({ fromDate, toDate, branchOption = null } = {}) {
  const client = await getAdminSupabaseClient();
  const { data, error } = await client.functions.invoke("partner-review-source-api", {
    body: { action: "marketing_report", from_date: fromDate, to_date: toDate, branch_uuid: branchOption?.value || "" }
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.message || "Không thể tải báo cáo Marketing Grab.");
  const value = data.data || {};
  return { ...normalize(value), fromDate, toDate, lastSyncedAt: value.lastSyncedAt || null,
    channels: (value.channels || []).map(normalize), accounts: (value.accounts || []).map(normalize),
    campaigns: (value.campaigns || []).map(normalize) };
}

export default { getGrabMarketingReport };
