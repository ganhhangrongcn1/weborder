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
      orderStorage?.getAllAsync?.(),
      readPartnerOrdersForAdmin()
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
    handleCancelVoucher,
    handleOrderUpdated
  };
}
