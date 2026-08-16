import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../../../components/Icon.jsx";
import CustomerCRM from "./CustomerCRM.jsx";
import LoyaltySettings from "./LoyaltySettings.jsx";

const CRM_VIEW_PATHS = {
  analysis: "/admin/customer-overview",
  customers: "/admin/customers",
  campaigns: "/admin/campaigns",
  history: "/admin/campaigns"
};

export default function AdminCustomerSection({
  customerControls = null,
  customerAdminTab,
  crmSnapshot,
  crmLoadState,
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
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const crmInitialView = customerAdminTab === "overview"
    ? "analysis"
    : customerAdminTab === "campaigns"
      ? "campaigns"
      : "customers";

  const handleRefreshCrm = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshCrm?.({ forceSupportRefresh: true });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCrmViewChange = (nextView) => {
    const nextPath = CRM_VIEW_PATHS[nextView];
    if (nextPath) navigate(nextPath);
  };

  return (
    <div className="admin-stack">
      <section className="admin-panel admin-customer-switcher">
        <div className="admin-customer-switcher-row">
          <div className="admin-customer-context">
            <span>Khách hàng & Marketing</span>
            <strong>
              {customerAdminTab === "overview" ? "Tổng quan khách hàng" : null}
              {customerAdminTab === "crm" ? "Khách hàng / CRM" : null}
              {customerAdminTab === "loyalty" ? "Thành viên & tích điểm" : null}
              {customerAdminTab === "campaigns" ? "Chiến dịch" : null}
            </strong>
          </div>
          <div className="admin-customer-controls">
            {customerControls}
            {customerAdminTab !== "loyalty" ? (
              <button
                type="button"
                className={`crm-refresh-btn ${isRefreshing ? "is-loading" : ""}`}
                onClick={handleRefreshCrm}
                disabled={isRefreshing}
              >
                <Icon name="back" size={16} />
                <span>{isRefreshing ? "Đang tải..." : "Tải lại"}</span>
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {customerAdminTab !== "loyalty" ? (
        <CustomerCRM
          initialView={crmInitialView}
          onViewChange={handleCrmViewChange}
          crmSnapshot={crmSnapshot}
          crmLoadState={crmLoadState}
          onRefreshCrm={handleRefreshCrm}
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
