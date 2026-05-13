import OrderManager from "./orders/OrderManager.js";
import AdminCustomerSection from "./customers/AdminCustomerSection.js";
import { buildCustomersFromOrdersAsync, getCustomerTier } from "../../services/crmService.js";
import { customerRepository } from "../../services/repositories/customerRepository.js";
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
function mapAdminStatusToOrderStatus(nextStatus) {
  if (nextStatus === "new") return "pending_zalo";
  if (nextStatus === "doing") return "confirmed";
  if (nextStatus === "delivering") return "delivering";
  if (nextStatus === "done") return "done";
  return "pending_zalo";
}
export default function AdminOrdersCrmSection({
  section,
  customerAdminTab,
  setCustomerAdminTab,
  ordersSnapshot,
  setOrdersSnapshot,
  onOrderUpdated,
  crmSnapshot,
  setCrmSnapshot,
  selectedCustomerPhone,
  setSelectedCustomerPhone,
  onAdjustPoints,
  onResetPoints,
  onGiftVoucher,
  onCancelVoucher,
  onSaveLoyaltyConfig,
  orderStorage,
  branches = [],
  coupons = []
}) {
  const refreshCrm = async () => {
    const [ordersResult, crmResult] = await Promise.allSettled([orderStorage?.getAllAsync?.(), buildCustomersFromOrdersAsync(orderStorage)]);
    const nextOrders = ordersResult.status === "fulfilled" ? ordersResult.value : [];
    const nextCrm = crmResult.status === "fulfilled" ? crmResult.value : {
      customers: [],
      loyaltyConfig: {}
    };
    if (ordersResult.status === "rejected") {
      console.error("[admin][orders] failed to refresh", ordersResult.reason);
    }
    if (crmResult.status === "rejected") {
      console.error("[admin][crm] failed to refresh", crmResult.reason);
    }
    setCrmSnapshot(nextCrm);
    setOrdersSnapshot(Array.isArray(nextOrders) ? nextOrders : []);
    return nextCrm;
  };
  const saveLoyaltyConfig = async nextConfig => {
    onSaveLoyaltyConfig?.(nextConfig || crmSnapshot?.loyaltyConfig || {});
    return await refreshCrm();
  };
  const updateOrderStatus = async (orderId, nextStatus) => {
    const normalized = mapAdminStatusToOrderStatus(nextStatus);
    try {
      if (typeof orderStorage?.updateOrderAsync === "function") {
        await orderStorage.updateOrderAsync(orderId, {
          status: normalized
        });
      } else {
        orderStorage?.updateOrder?.(orderId, {
          status: normalized
        });
      }
      await refreshCrm();
      onOrderUpdated?.();
    } catch (error) {
      console.error("[admin][orders] update status failed", error);
      window.alert("Cập nhật trạng thái thất bại. Khả năng do RLS/permission của bảng orders.");
    }
  };
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [section === "orders" && /*#__PURE__*/_jsx(OrderManager, {
      ordersSnapshot: ordersSnapshot,
      updateOrderStatus: updateOrderStatus,
      onOpenDetail: () => {},
      branches: branches,
      registeredCustomersByPhone: customerRepository.getUsers()
    }), section === "customers" && /*#__PURE__*/_jsx(AdminCustomerSection, {
      customerAdminTab: customerAdminTab,
      setCustomerAdminTab: setCustomerAdminTab,
      crmSnapshot: crmSnapshot,
      selectedCustomerPhone: selectedCustomerPhone,
      setSelectedCustomerPhone: setSelectedCustomerPhone,
      refreshCrm: refreshCrm,
      adjustCustomerPoints: onAdjustPoints,
      resetCustomerPoints: onResetPoints,
      giftVoucherToCustomer: onGiftVoucher,
      cancelCustomerVoucher: onCancelVoucher,
      showCustomerTier: getCustomerTier,
      setCrmSnapshot: setCrmSnapshot,
      handleSaveLoyaltyRatio: saveLoyaltyConfig,
      coupons: coupons
    })]
  });
}