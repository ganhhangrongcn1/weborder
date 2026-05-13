import AdminOrdersCrmSection from "../AdminOrdersCrmSection.js";
import { jsx as _jsx } from "react/jsx-runtime";
export default function AdminOrdersPage({
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
  orderStorage,
  branches = []
}) {
  return /*#__PURE__*/_jsx(AdminOrdersCrmSection, {
    section: "orders",
    customerAdminTab: "crm",
    setCustomerAdminTab: () => {},
    ordersSnapshot: ordersSnapshot,
    setOrdersSnapshot: setOrdersSnapshot,
    onOrderUpdated: onOrderUpdated,
    crmSnapshot: crmSnapshot,
    setCrmSnapshot: setCrmSnapshot,
    selectedCustomerPhone: selectedCustomerPhone,
    setSelectedCustomerPhone: setSelectedCustomerPhone,
    onAdjustPoints: onAdjustPoints,
    onResetPoints: onResetPoints,
    onGiftVoucher: onGiftVoucher,
    orderStorage: orderStorage,
    branches: branches
  });
}