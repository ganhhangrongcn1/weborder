import { buildCustomersFromOrdersAsync, adjustCustomerPoints, resetCustomerPoints, giftVoucherToCustomer, cancelCustomerVoucher } from "../../../services/crmService.js";

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

  const reloadOrdersSnapshot = async () => {
    const all = await orderStorage?.getAllAsync?.();
    setOrdersSnapshot(Array.isArray(all) ? all : []);
  };

  const refreshCrmSnapshot = async () => {
    const nextSnapshot = await buildCustomersFromOrdersAsync(orderStorage);
    setCrmSnapshot(nextSnapshot);
    await reloadOrdersSnapshot();
    return nextSnapshot;
  };

  const refreshCrmOnly = async () => {
    const nextSnapshot = await buildCustomersFromOrdersAsync(orderStorage, { skipReconcile: true });
    setCrmSnapshot(nextSnapshot);
    return nextSnapshot;
  };

  const handleAdjustPoints = async (phone, delta) => {
    await adjustCustomerPoints(phone, delta);
    return await refreshCrmOnly();
  };

  const handleResetPoints = async (phone) => {
    await resetCustomerPoints(phone);
    return await refreshCrmOnly();
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
    handleAdjustPoints,
    handleResetPoints,
    handleGiftVoucher,
    handleCancelVoucher,
    handleOrderUpdated
  };
}
