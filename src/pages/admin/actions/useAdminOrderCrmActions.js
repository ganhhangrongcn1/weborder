import {
  buildCustomersFromOrderListAsync,
  buildCustomersFromOrdersAsync,
  giftVoucherToCustomer,
  cancelCustomerVoucher
} from "../../../services/crmService.js";
import { buildAdminOrderFeed, readPartnerOrdersForAdmin } from "../../../services/adminOrderFeedService.js";
import { recordAdminRequest } from "../../../services/adminRequestAuditService.js";
import { appendBulkGiftHistoryAsync } from "../../../services/crmCampaignService.js";

export default function useAdminOrderCrmActions({
  orderStorage,
  setOrdersSnapshot,
  setCrmSnapshot
}) {
  const getErrorCode = (error) => String(error?.code || error?.message || "").trim();

  const patchCustomerLoyaltyInSnapshot = (phone, loyalty) => {
    const key = String(phone || "").trim();
    if (!key || !loyalty) return;
    setCrmSnapshot((current) => {
      const safeCurrent = current && typeof current === "object" ? current : { customers: [], loyaltyConfig: {} };
      const customers = Array.isArray(safeCurrent.customers) ? safeCurrent.customers : [];
      const nextCustomers = customers.map((customer) => {
        if (String(customer?.phone || "").trim() !== key) return customer;
        return {
          ...customer,
          currentPoints: Number(loyalty?.totalPoints || customer?.currentPoints || 0),
          vouchers: Array.isArray(loyalty?.voucherHistory) ? loyalty.voucherHistory : customer?.vouchers || [],
          pointsHistory: Array.isArray(loyalty?.pointHistory) ? loyalty.pointHistory : customer?.pointsHistory || []
        };
      });
      return {
        ...safeCurrent,
        customers: nextCustomers
      };
    });
  };

  const refreshCrmSnapshot = async () => {
    const [webOrdersResult, partnerOrdersResult] = await Promise.allSettled([
      orderStorage?.getAllAsync?.({ includeItems: false }),
      readPartnerOrdersForAdmin({ includeItems: false })
    ]);
    const webOrders = webOrdersResult.status === "fulfilled" ? webOrdersResult.value : [];
    recordAdminRequest("order updated web orders", "orders");
    const partnerOrders = partnerOrdersResult.status === "fulfilled" ? partnerOrdersResult.value : [];
    const combinedOrders = buildAdminOrderFeed(webOrders, partnerOrders);
    const nextSnapshot = await buildCustomersFromOrderListAsync(combinedOrders, orderStorage);
    setCrmSnapshot(nextSnapshot);
    setOrdersSnapshot(Array.isArray(webOrders) ? webOrders : []);
    return nextSnapshot;
  };

  const refreshCrmOnly = async () => {
    const nextSnapshot = await buildCustomersFromOrdersAsync(orderStorage, {
      skipReconcile: true,
      forceSupportRefresh: true
    });
    setCrmSnapshot(nextSnapshot);
    return nextSnapshot;
  };

  const handleGiftVoucher = async (phone, voucher, options = {}) => {
    const nextLoyalty = await giftVoucherToCustomer(phone, voucher, {
      sourceType: "crm_single",
      sourceLabel: "CRM - tặng tay",
      ...options
    });
    patchCustomerLoyaltyInSnapshot(phone, nextLoyalty);
    return nextLoyalty;
  };

  const handleBulkGiftVoucher = async (phones = [], voucher, options = {}) => {
    const uniquePhones = Array.from(new Set(
      (Array.isArray(phones) ? phones : [])
        .map((phone) => String(phone || "").trim())
        .filter(Boolean)
    ));
    if (!uniquePhones.length) {
      return {
        successCount: 0,
        failedCount: 0,
        duplicateCount: 0,
        unregisteredCount: 0,
        successPhones: [],
        failedPhones: [],
        duplicatePhones: [],
        unregisteredPhones: [],
        results: []
      };
    }

    const grantBatchId = String(options?.grantBatchId || `crm-bulk-${Date.now()}`).trim();
    const bulkGiftOptions = {
      ...options,
      sourceType: String(options?.sourceType || "crm_bulk").trim() || "crm_bulk",
      sourceLabel: String(options?.sourceLabel || "CRM - gửi theo nhóm").trim() || "CRM - gửi theo nhóm",
      grantBatchId
    };

    const results = await Promise.allSettled(
      uniquePhones.map((phone) => giftVoucherToCustomer(phone, voucher, bulkGiftOptions))
    );

    const successPhones = [];
    const failedPhones = [];
    const duplicatePhones = [];
    const unregisteredPhones = [];

    results.forEach((result, index) => {
      const phone = uniquePhones[index];
      if (result.status === "fulfilled") {
        patchCustomerLoyaltyInSnapshot(phone, result.value);
        successPhones.push(phone);
        return;
      }

      failedPhones.push(phone);
      if (getErrorCode(result.reason) === "CRM_DUPLICATE_ACTIVE_VOUCHER") {
        duplicatePhones.push(phone);
      }
      if (getErrorCode(result.reason) === "CRM_CUSTOMER_NOT_REGISTERED") {
        unregisteredPhones.push(phone);
      }
      console.error("[crm] bulk gift voucher failed", { phone, error: result.reason });
    });

    const historyEntry = await appendBulkGiftHistoryAsync({
      campaignKey: options?.campaignKey || "",
      campaignLabel: options?.campaignLabel || "Tặng theo bộ lọc CRM",
      filterValue: options?.filterValue || "all",
      audience: options?.audience || "all",
      voucherId: String(voucher?.id || "").trim(),
      voucherCode: String(voucher?.code || "").trim().toUpperCase(),
      voucherName: String(voucher?.name || voucher?.title || "Voucher CRM").trim(),
      sourceType: bulkGiftOptions.sourceType,
      sourceLabel: bulkGiftOptions.sourceLabel,
      totalRecipients: uniquePhones.length,
      successCount: successPhones.length,
      failedCount: failedPhones.length,
      duplicateCount: duplicatePhones.length,
      unregisteredCount: unregisteredPhones.length,
      successPhones,
      failedPhones,
      duplicatePhones,
      unregisteredPhones
    });

    return {
      successCount: successPhones.length,
      failedCount: failedPhones.length,
      duplicateCount: duplicatePhones.length,
      unregisteredCount: unregisteredPhones.length,
      successPhones,
      failedPhones,
      duplicatePhones,
      unregisteredPhones,
      results,
      historyEntry
    };
  };

  const handleCancelVoucher = async (phone, voucherId) => {
    const nextLoyalty = await cancelCustomerVoucher(phone, voucherId);
    patchCustomerLoyaltyInSnapshot(phone, nextLoyalty);
    return nextLoyalty;
  };

  const handleOrderUpdated = async () => {
    await refreshCrmSnapshot();
  };

  return {
    handleGiftVoucher,
    handleBulkGiftVoucher,
    handleCancelVoucher,
    handleOrderUpdated,
    refreshCrmOnly
  };
}
