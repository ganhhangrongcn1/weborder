import OrderManager from "./orders/OrderManager.jsx";
import AdminCustomerSection from "./customers/AdminCustomerSection.jsx";
import { buildCustomersFromOrdersAsync, getCustomerTier } from "../../services/crmService.js";
import { customerRepository } from "../../services/repositories/customerRepository.js";

function mapAdminStatusToOrderStatus(nextStatus) {
  if (nextStatus === "new") return "pending_zalo";
  if (nextStatus === "doing") return "confirmed";
  if (nextStatus === "delivering") return "delivering";
  if (nextStatus === "done") return "done";
  return "pending_zalo";
}

function buildDateRangeFromInputs(dateFromValue = "", dateToValue = "") {
  const fromText = String(dateFromValue || "").trim();
  const toText = String(dateToValue || "").trim();
  if (!fromText && !toText) return {};
  const fromDate = fromText ? new Date(`${fromText}T00:00:00`) : null;
  const toDate = toText ? new Date(`${toText}T00:00:00`) : null;
  if (fromDate && Number.isNaN(fromDate.getTime())) return {};
  if (toDate && Number.isNaN(toDate.getTime())) return {};
  let start = fromDate;
  let end = toDate;
  if (start && end && start.getTime() > end.getTime()) {
    const temp = start;
    start = end;
    end = temp;
  }
  const range = {};
  if (start) range.dateFrom = start.toISOString();
  if (end) {
    const nextEnd = new Date(end);
    nextEnd.setDate(nextEnd.getDate() + 1);
    range.dateTo = nextEnd.toISOString();
  }
  return range;
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
    ? buildDateRangeFromInputs(customersDateFrom, customersDateTo)
    : buildDateRangeFromInputs(ordersDateFrom, ordersDateTo);

  const refreshCrm = async () => {
    const [ordersResult, crmResult] = await Promise.allSettled([
      orderStorage?.getAllAsync?.(activeDateRange),
      buildCustomersFromOrdersAsync(orderStorage, { dateRange: activeDateRange })
    ]);
    const nextOrders = ordersResult.status === "fulfilled" ? ordersResult.value : [];
    const nextCrm = crmResult.status === "fulfilled" ? crmResult.value : { customers: [], loyaltyConfig: {} };
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

  const saveLoyaltyConfig = async (nextConfig) => {
    onSaveLoyaltyConfig?.(nextConfig || crmSnapshot?.loyaltyConfig || {});
    return await refreshCrm();
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
          customerAdminTab={customerAdminTab}
          setCustomerAdminTab={setCustomerAdminTab}
          crmSnapshot={crmSnapshot}
          selectedCustomerPhone={selectedCustomerPhone}
          setSelectedCustomerPhone={setSelectedCustomerPhone}
          refreshCrm={refreshCrm}
          adjustCustomerPoints={onAdjustPoints}
          resetCustomerPoints={onResetPoints}
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
