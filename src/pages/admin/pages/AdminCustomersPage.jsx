import AdminOrdersCrmSection from "../AdminOrdersCrmSection.jsx";

export default function AdminCustomersPage({
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
  coupons = [],
  customersDateFrom,
  setCustomersDateFrom,
  customersDateTo,
  setCustomersDateTo,
  customersDatePreset,
  setCustomersDatePreset
}) {
  return (
    <AdminOrdersCrmSection
      section="customers"
      customerAdminTab={customerAdminTab}
      setCustomerAdminTab={setCustomerAdminTab}
      ordersSnapshot={ordersSnapshot}
      setOrdersSnapshot={setOrdersSnapshot}
      onOrderUpdated={onOrderUpdated}
      crmSnapshot={crmSnapshot}
      setCrmSnapshot={setCrmSnapshot}
      selectedCustomerPhone={selectedCustomerPhone}
      setSelectedCustomerPhone={setSelectedCustomerPhone}
      onAdjustPoints={onAdjustPoints}
      onResetPoints={onResetPoints}
      onGiftVoucher={onGiftVoucher}
      onCancelVoucher={onCancelVoucher}
      onSaveLoyaltyConfig={onSaveLoyaltyConfig}
      orderStorage={orderStorage}
      coupons={coupons}
      customersDateFrom={customersDateFrom}
      setCustomersDateFrom={setCustomersDateFrom}
      customersDateTo={customersDateTo}
      setCustomersDateTo={setCustomersDateTo}
      customersDatePreset={customersDatePreset}
      setCustomersDatePreset={setCustomersDatePreset}
    />
  );
}
