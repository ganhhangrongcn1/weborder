import AdminOrdersCrmSection from "../AdminOrdersCrmSection.jsx";
import AdminRequestAuditBadge from "../AdminRequestAuditBadge.jsx";
import { AdminInput, AdminSelect } from "../ui/index.js";

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
  onGiftVoucher,
  onCancelVoucher,
  onSaveLoyaltyConfig,
  orderStorage,
  branches = [],
  selectedBranchFilter = "all",
  coupons = [],
  customersDateFrom,
  setCustomersDateFrom,
  customersDateTo,
  setCustomersDateTo,
  customersDatePreset,
  setCustomersDatePreset
}) {
  const todayText = new Date().toISOString().slice(0, "10");
  const toDateText = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const applyPreset = (preset) => {
    const now = new Date();
    if (preset === "all") {
      setCustomersDateFrom("");
      setCustomersDateTo("");
    }
    if (preset === "today") {
      const value = toDateText(now);
      setCustomersDateFrom(value);
      setCustomersDateTo(value);
    }
    if (preset === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const value = toDateText(yesterday);
      setCustomersDateFrom(value);
      setCustomersDateTo(value);
    }
    if (preset === "week") {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      setCustomersDateFrom(toDateText(monday));
      setCustomersDateTo(toDateText(now));
    }
    if (preset === "month") {
      setCustomersDateFrom(toDateText(new Date(now.getFullYear(), now.getMonth(), 1)));
      setCustomersDateTo(toDateText(now));
    }
    setCustomersDatePreset(preset);
  };

  const customerControls = (
    <>
      <div className="admin-customer-date-controls">
        <label className="admin-dashboard-search admin-dashboard-preset">
          <span>Ngày</span>
          <AdminSelect
            value={customersDatePreset || "all"}
            onChange={(event) => {
              const nextPreset = event.target.value;
              if (nextPreset === "custom") {
                setCustomersDatePreset("custom");
                return;
              }
              applyPreset(nextPreset);
            }}
            options={[
              { value: "all", label: "Tất cả thời gian" },
              { value: "today", label: "Hôm nay" },
              { value: "yesterday", label: "Hôm qua" },
              { value: "week", label: "Tuần này" },
              { value: "month", label: "Tháng này" },
              { value: "custom", label: "Tùy chỉnh..." }
            ]}
          />
        </label>
        {customersDatePreset === "custom" ? (
          <>
            <label className="admin-dashboard-search">
              <span>Từ</span>
              <AdminInput
                type="date"
                value={customersDateFrom || ""}
                max={customersDateTo || todayText}
                onChange={(event) => {
                  setCustomersDateFrom(event.target.value);
                  setCustomersDatePreset("custom");
                }}
              />
            </label>
            <label className="admin-dashboard-search">
              <span>Đến</span>
              <AdminInput
                type="date"
                value={customersDateTo || ""}
                min={customersDateFrom || ""}
                max={todayText}
                onChange={(event) => {
                  setCustomersDateTo(event.target.value);
                  setCustomersDatePreset("custom");
                }}
              />
            </label>
          </>
        ) : null}
      </div>

      <details className="admin-orders-audit-details admin-crm-audit-details">
        <summary>Nguồn dữ liệu</summary>
        <AdminRequestAuditBadge audit={adminRequestAudit} onReset={resetAdminRequestAudit} />
      </details>
    </>
  );

  return (
    <>
      <AdminOrdersCrmSection
        section="customers"
        customerControls={customerControls}
        customerAdminTab={customerAdminTab}
        setCustomerAdminTab={setCustomerAdminTab}
        ordersSnapshot={ordersSnapshot}
        setOrdersSnapshot={setOrdersSnapshot}
        onOrderUpdated={onOrderUpdated}
        crmSnapshot={crmSnapshot}
        setCrmSnapshot={setCrmSnapshot}
        selectedCustomerPhone={selectedCustomerPhone}
        setSelectedCustomerPhone={setSelectedCustomerPhone}
        onGiftVoucher={onGiftVoucher}
        onCancelVoucher={onCancelVoucher}
        onSaveLoyaltyConfig={onSaveLoyaltyConfig}
        orderStorage={orderStorage}
        branches={branches}
        selectedBranchFilter={selectedBranchFilter}
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
