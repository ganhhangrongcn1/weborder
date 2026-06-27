import { getMemberLoyaltySnapshot } from "./memberLoyaltySnapshotService.js";
import { getCustomerOrderSummary } from "./orderSummaryService.js";
import {
  getPartnerOrdersByPhone,
  mergeCustomerLookupOrders
} from "./partnerOrderService.js";
import { getCustomerKey } from "./storageService.js";

export const EMPTY_ACCOUNT_SUMMARY = {
  totalOrders: 0,
  totalSpent: 0,
  claimedPoints: 0,
  pendingPoints: 0
};

function getFulfilledValue(result, fallback) {
  return result?.status === "fulfilled" ? result.value : fallback;
}

function getRejectedMessage(result) {
  if (result?.status !== "rejected") return "";
  return String(result.reason?.message || result.reason || "").trim();
}

export async function getAccountOverview(
  phone = "",
  {
    fallbackOrders = [],
    fallbackLoyalty = {}
  } = {}
) {
  const phoneKey = getCustomerKey(phone);
  if (!phoneKey) {
    return {
      summary: null,
      loyalty: fallbackLoyalty,
      recentOrders: [],
      latestOrder: null,
      error: "Không xác định được tài khoản khách hàng."
    };
  }

  const [summaryResult, partnerOrdersResult, loyaltyResult] = await Promise.allSettled([
    getCustomerOrderSummary(phoneKey),
    getPartnerOrdersByPhone(phoneKey, {
      limit: 3,
      includeItems: false,
      hydrateCustomerProfile: false,
      throwOnError: true
    }),
    getMemberLoyaltySnapshot(phoneKey, {
      orders: fallbackOrders,
      fallback: fallbackLoyalty
    })
  ]);

  const summary = getFulfilledValue(summaryResult, null);
  const webOrders = Array.isArray(fallbackOrders) ? fallbackOrders.slice(0, 3) : [];
  const partnerOrders = getFulfilledValue(partnerOrdersResult, []);
  const recentOrders = mergeCustomerLookupOrders(webOrders, partnerOrders).slice(0, 3);
  const loyalty = getFulfilledValue(loyaltyResult, fallbackLoyalty);
  const errors = [
    getRejectedMessage(summaryResult),
    getRejectedMessage(partnerOrdersResult),
    getRejectedMessage(loyaltyResult)
  ].filter(Boolean);

  return {
    summary,
    loyalty,
    recentOrders,
    latestOrder: recentOrders[0] || null,
    error: errors.length
      ? "Một phần dữ liệu chưa thể đồng bộ. Bạn có thể thử tải lại."
      : ""
  };
}

export default {
  EMPTY_ACCOUNT_SUMMARY,
  getAccountOverview
};
