import { buildCustomersFromOrderListAsync, buildCustomersFromOrdersAsync, giftVoucherToCustomer, cancelCustomerVoucher } from "../../../services/crmService.js";
import { buildAdminOrderFeed, readPartnerOrdersForAdmin } from "../../../services/adminOrderFeedService.js";
import { recordAdminRequest } from "../../../services/adminRequestAuditService.js";

export default function useAdminOrderCrmActions({
  orderStorage,
  setOrdersSnapshot,
  setCrmSnapshot
}) {
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

  const handleGiftVoucher = async (phone, voucher) => {
    const nextLoyalty = await giftVoucherToCustomer(phone, voucher);
    patchCustomerLoyaltyInSnapshot(phone, nextLoyalty);
    return nextLoyalty;
  };

  const handleBulkGiftVoucher = async (phones = [], voucher) => {
    const uniquePhones = Array.from(new Set(
      (Array.isArray(phones) ? phones : [])
        .map((phone) => String(phone || "").trim())
        .filter(Boolean)
    ));
    if (!uniquePhones.length) {
      return {
        successCount: 0,
        failedCount: 0,
        successPhones: [],
        failedPhones: [],
        results: []
      };
    }

    const results = await Promise.allSettled(
      uniquePhones.map((phone) => giftVoucherToCustomer(phone, voucher))
    );

    const successPhones = [];
    const failedPhones = [];

    results.forEach((result, index) => {
      const phone = uniquePhones[index];
      if (result.status === "fulfilled") {
        patchCustomerLoyaltyInSnapshot(phone, result.value);
        successPhones.push(phone);
        return;
      }
      failedPhones.push(phone);
      console.error("[crm] bulk gift voucher failed", { phone, error: result.reason });
    });

    return {
      successCount: successPhones.length,
      failedCount: failedPhones.length,
      successPhones,
      failedPhones,
      results
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
    handleOrderUpdated
  };
}
