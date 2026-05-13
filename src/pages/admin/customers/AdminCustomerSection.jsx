import CustomerCRM from "./CustomerCRM.jsx";
import LoyaltySettings from "./LoyaltySettings.jsx";

export default function AdminCustomerSection({
  customerAdminTab,
  setCustomerAdminTab,
  crmSnapshot,
  selectedCustomerPhone,
  setSelectedCustomerPhone,
  refreshCrm,
  adjustCustomerPoints,
  resetCustomerPoints,
  giftVoucherToCustomer,
  cancelCustomerVoucher,
  showCustomerTier,
  setCrmSnapshot,
  handleSaveLoyaltyRatio,
  coupons = []
}) {
  return (
    <div className="admin-stack">
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Khách hàng / CRM</h2>
            <p>Quản lý dữ liệu khách hàng, loyalty và lịch sử mua hàng.</p>
          </div>
        </div>
        <div className="admin-menu-tabs">
          <button type="button" className={customerAdminTab === "crm" ? "active" : ""} onClick={() => setCustomerAdminTab("crm")}>CRM</button>
          <button type="button" className={customerAdminTab === "loyalty" ? "active" : ""} onClick={() => setCustomerAdminTab("loyalty")}>Quản lý tích điểm</button>
        </div>
      </section>

      {customerAdminTab === "crm" ? (
        <CustomerCRM
          crmSnapshot={crmSnapshot}
          selectedCustomerPhone={selectedCustomerPhone}
          setSelectedCustomerPhone={setSelectedCustomerPhone}
          refreshCrm={refreshCrm}
          adjustCustomerPoints={adjustCustomerPoints}
          resetCustomerPoints={resetCustomerPoints}
          giftVoucherToCustomer={giftVoucherToCustomer}
          cancelCustomerVoucher={cancelCustomerVoucher}
          showCustomerTier={showCustomerTier}
          coupons={coupons}
        />
      ) : (
        <LoyaltySettings crmSnapshot={crmSnapshot} setCrmSnapshot={setCrmSnapshot} onSave={handleSaveLoyaltyRatio} />
      )}
    </div>
  );
}
