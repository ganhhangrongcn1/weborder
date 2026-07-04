import CustomerCRM from "./CustomerCRM.jsx";
import LoyaltySettings from "./LoyaltySettings.jsx";

export default function AdminCustomerSection({
  customerControls = null,
  customerAdminTab,
  setCustomerAdminTab,
  crmSnapshot,
  selectedCustomerPhone,
  setSelectedCustomerPhone,
  refreshCrm,
  giftVoucherToCustomer,
  bulkGiftVoucherToCustomers,
  cancelCustomerVoucher,
  showCustomerTier,
  setCrmSnapshot,
  handleSaveLoyaltyRatio,
  coupons = [],
  customersDateFrom,
  setCustomersDateFrom,
  customersDateTo,
  setCustomersDateTo,
  customersDatePreset,
  setCustomersDatePreset
}) {
  return (
    <div className="admin-stack">
      <section className="admin-panel admin-customer-switcher">
        <div className="admin-customer-switcher-row">
          <div className="admin-menu-tabs">
            <button type="button" className={customerAdminTab === "crm" ? "active" : ""} onClick={() => setCustomerAdminTab("crm")}>CRM</button>
            <button type="button" className={customerAdminTab === "loyalty" ? "active" : ""} onClick={() => setCustomerAdminTab("loyalty")}>Quản lý tích điểm</button>
          </div>
          {customerControls ? <div className="admin-customer-controls">{customerControls}</div> : null}
        </div>
      </section>

      {customerAdminTab === "crm" ? (
        <CustomerCRM
          crmSnapshot={crmSnapshot}
          selectedCustomerPhone={selectedCustomerPhone}
          setSelectedCustomerPhone={setSelectedCustomerPhone}
          refreshCrm={refreshCrm}
          giftVoucherToCustomer={giftVoucherToCustomer}
          bulkGiftVoucherToCustomers={bulkGiftVoucherToCustomers}
          cancelCustomerVoucher={cancelCustomerVoucher}
          showCustomerTier={showCustomerTier}
          coupons={coupons}
          customersDateFrom={customersDateFrom}
          setCustomersDateFrom={setCustomersDateFrom}
          customersDateTo={customersDateTo}
          setCustomersDateTo={setCustomersDateTo}
          customersDatePreset={customersDatePreset}
          setCustomersDatePreset={setCustomersDatePreset}
        />
      ) : (
        <LoyaltySettings
          crmSnapshot={crmSnapshot}
          setCrmSnapshot={setCrmSnapshot}
          onSave={handleSaveLoyaltyRatio}
          coupons={coupons}
          refreshCrm={refreshCrm}
        />
      )}
    </div>
  );
}
