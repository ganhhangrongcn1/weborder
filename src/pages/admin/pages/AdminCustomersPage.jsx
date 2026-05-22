import AdminOrdersCrmSection from "../AdminOrdersCrmSection.jsx";
import AdminRequestAuditBadge from "../AdminRequestAuditBadge.jsx";

export default function AdminCustomersPage({
  customerAdminTab,
  setCustomerAdminTab,
  ordersSnapshot,
  setOrdersSnapshot,
  onOrderUpdated,
  crmSnapshot,
  setCrmSnapshot,
  adminRequestAudit,
  resetAdminRequestAudit,
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
    <>
      <div style={{ marginBottom: 12 }}>
        <AdminRequestAuditBadge audit={adminRequestAudit} onReset={resetAdminRequestAudit} />
      </div>

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
    </>
  );
}
