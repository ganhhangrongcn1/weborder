import OrderManager from "./orders/OrderManager.jsx";
import AdminCustomerSection from "./customers/AdminCustomerSection.jsx";
import {
  buildCustomersFromCrmAnalyticsAsync,
  buildCustomersFromOrderListAsync,
  getCustomerTier
} from "../../services/crmService.js";
import { buildAdminOrderFeed, readPartnerOrdersForAdmin } from "../../services/adminOrderFeedService.js";
import { recordAdminRequest } from "../../services/adminRequestAuditService.js";
import { customerRepository } from "../../services/repositories/customerRepository.js";
import { buildVietnamDateRange, hasDateRange } from "../../utils/adminDateRange.js";
import {
  branchOptionMatchesOrder,
  buildBranchFilterOptions
} from "../../services/branchIdentityService.js";

function mapAdminStatusToOrderStatus(nextStatus) {
  if (nextStatus === "new") return "pending_zalo";
  if (nextStatus === "doing") return "confirmed";
  if (nextStatus === "delivering") return "delivering";
  if (nextStatus === "done") return "done";
  return "pending_zalo";
}

function getSelectedBranchOption(branches = [], selectedBranchFilter = "all") {
  if (!selectedBranchFilter || selectedBranchFilter === "all") return null;
  return buildBranchFilterOptions(branches).find((branch) => branch.value === selectedBranchFilter) || null;
}

function filterOrdersByBranch(orders = [], branchOption = null) {
  if (!branchOption) return Array.isArray(orders) ? orders : [];
  return (Array.isArray(orders) ? orders : []).filter((order) => branchOptionMatchesOrder(order, branchOption));
}

export default function AdminOrdersCrmSection({
  section,
  customerControls,
  customerAdminTab,
  setCustomerAdminTab,
  ordersSnapshot,
  setOrdersSnapshot,
  onOrderUpdated,
  crmSnapshot,
  setCrmSnapshot,
  selectedCustomerPhone,
  setSelectedCustomerPhone,
  onGiftVoucher,
  onCancelVoucher,
  onSaveLoyaltyConfig,
  orderStorage,
  branches = [],
  selectedBranchFilter = "all",
  coupons = [],
  ordersDateFrom,
  setOrdersDateFrom,
  ordersDateTo,
  setOrdersDateTo,
  ordersDatePreset,
  setOrdersDatePreset,
  customersDateFrom,
  setCustomersDateFrom,
  customersDateTo,
  setCustomersDateTo,
  customersDatePreset,
  setCustomersDatePreset
}) {
  const activeDateRange = section === "customers"
    ? buildVietnamDateRange(customersDateFrom, customersDateTo)
    : buildVietnamDateRange(ordersDateFrom, ordersDateTo);
  const selectedBranchOption = getSelectedBranchOption(branches, selectedBranchFilter);

  const refreshCrm = async ({ forceSupportRefresh = false } = {}) => {
    const canUseFastCrmSnapshot = section === "customers" && !hasDateRange(activeDateRange) && !selectedBranchOption;
    if (canUseFastCrmSnapshot) {
      try {
        const fastSnapshot = await buildCustomersFromCrmAnalyticsAsync({ forceSupportRefresh });
        if (fastSnapshot?.crmAnalytics?.source === "rpc") {
          setCrmSnapshot(fastSnapshot);
          return fastSnapshot;
        }
      } catch (error) {
        console.warn("[admin][crm] manual fast refresh failed, falling back to order snapshot", error);
      }
    }

    const [ordersResult, partnerOrdersResult] = await Promise.allSettled([
      orderStorage?.getAllAsync?.({
        ...activeDateRange,
        requireRemote: section === "orders",
        includeItems: section !== "customers"
      }),
      readPartnerOrdersForAdmin({ ...activeDateRange, includeItems: section !== "customers" })
    ]);
    const nextOrders = ordersResult.status === "fulfilled" ? ordersResult.value : [];
    recordAdminRequest("manual refresh web orders", "orders");
    const partnerOrders = partnerOrdersResult.status === "fulfilled" ? partnerOrdersResult.value : [];
    const combinedOrders = buildAdminOrderFeed(nextOrders, partnerOrders);
    const scopedCrmOrders = section === "customers"
      ? filterOrdersByBranch(combinedOrders, selectedBranchOption)
      : combinedOrders;
    const crmResult = await buildCustomersFromOrderListAsync(scopedCrmOrders, orderStorage, {
      dateRange: activeDateRange,
      forceSupportRefresh
    })
      .then((value) => ({ status: "fulfilled", value }))
      .catch((reason) => ({ status: "rejected", reason }));
    const nextCrm = crmResult.status === "fulfilled" ? crmResult.value : { customers: [], loyaltyConfig: {} };
    if (ordersResult.status === "rejected") {
      console.error("[admin][orders] failed to refresh", ordersResult.reason);
    }
    if (partnerOrdersResult.status === "rejected") {
      console.error("[admin][partner-orders] failed to refresh", partnerOrdersResult.reason);
    }
    if (crmResult.status === "rejected") {
      console.error("[admin][crm] failed to refresh", crmResult.reason);
    }
    setCrmSnapshot(nextCrm);
    setOrdersSnapshot(Array.isArray(nextOrders) ? nextOrders : []);
    return nextCrm;
  };

  const saveLoyaltyConfig = async (nextConfig) => {
    const savedResult = await Promise.resolve(
      onSaveLoyaltyConfig?.(nextConfig || crmSnapshot?.loyaltyConfig || {})
    );
    const savedConfig = savedResult?.config || nextConfig || crmSnapshot?.loyaltyConfig || {};
    setCrmSnapshot((current) => ({
      ...(current || {}),
      loyaltyConfig: savedConfig
    }));
    return savedConfig;
  };

  const updateOrderStatus = async (orderId, nextStatus) => {
    const normalized = mapAdminStatusToOrderStatus(nextStatus);
    try {
      if (typeof orderStorage?.updateOrderAsync === "function") {
        await orderStorage.updateOrderAsync(orderId, { status: normalized });
      } else {
        orderStorage?.updateOrder?.(orderId, { status: normalized });
      }
      await refreshCrm();
    } catch (error) {
      console.error("[admin][orders] update status failed", error);
      window.alert("Cập nhật trạng thái thất bại. Khả năng do RLS/permission của bảng orders.");
    }
  };

  return (
    <>
      {section === "orders" && (
        <OrderManager
          ordersSnapshot={ordersSnapshot}
          updateOrderStatus={updateOrderStatus}
          onOpenDetail={() => {}}
          branches={branches}
          selectedBranchFilter={selectedBranchFilter}
          registeredCustomersByPhone={customerRepository.getUsers()}
          ordersDateFrom={ordersDateFrom}
          setOrdersDateFrom={setOrdersDateFrom}
          ordersDateTo={ordersDateTo}
          setOrdersDateTo={setOrdersDateTo}
          ordersDatePreset={ordersDatePreset}
          setOrdersDatePreset={setOrdersDatePreset}
        />
      )}

      {section === "customers" && (
        <AdminCustomerSection
          customerControls={customerControls}
          customerAdminTab={customerAdminTab}
          setCustomerAdminTab={setCustomerAdminTab}
          crmSnapshot={crmSnapshot}
          selectedCustomerPhone={selectedCustomerPhone}
          setSelectedCustomerPhone={setSelectedCustomerPhone}
          refreshCrm={refreshCrm}
          giftVoucherToCustomer={onGiftVoucher}
          cancelCustomerVoucher={onCancelVoucher}
          showCustomerTier={getCustomerTier}
          setCrmSnapshot={setCrmSnapshot}
          handleSaveLoyaltyRatio={saveLoyaltyConfig}
          coupons={coupons}
          customersDateFrom={customersDateFrom}
          setCustomersDateFrom={setCustomersDateFrom}
          customersDateTo={customersDateTo}
          setCustomersDateTo={setCustomersDateTo}
          customersDatePreset={customersDatePreset}
          setCustomersDatePreset={setCustomersDatePreset}
        />
      )}
    </>
  );
}
