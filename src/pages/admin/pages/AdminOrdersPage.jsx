import AdminOrdersCrmSection from "../AdminOrdersCrmSection.jsx";
import AdminRequestAuditBadge from "../AdminRequestAuditBadge.jsx";
import { AdminInput, AdminSelect } from "../ui/index.js";

export default function AdminOrdersPage({
  ordersSnapshot,
  setOrdersSnapshot,
  onOrderUpdated,
  crmSnapshot,
  setCrmSnapshot,
  adminRequestAudit,
  resetAdminRequestAudit,
  adminOrdersRealtimePending,
  adminOrdersRealtimeCount,
  refreshAdminOrdersFromRealtime,
  selectedCustomerPhone,
  setSelectedCustomerPhone,
  onGiftVoucher,
  orderStorage,
  branches = [],
  ordersDateFrom,
  setOrdersDateFrom,
  ordersDateTo,
  setOrdersDateTo,
  ordersDatePreset,
  setOrdersDatePreset
}) {
  const todayText = new Date().toISOString().slice(0, "10");
  const applyPreset = (preset) => {
    const now = new Date();
    const toDateText = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    if (preset === "today") {
      const value = toDateText(now);
      setOrdersDateFrom(value);
      setOrdersDateTo(value);
    }
    if (preset === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const value = toDateText(yesterday);
      setOrdersDateFrom(value);
      setOrdersDateTo(value);
    }
    if (preset === "week") {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      setOrdersDateFrom(toDateText(monday));
      setOrdersDateTo(toDateText(now));
    }
    if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setOrdersDateFrom(toDateText(firstDay));
      setOrdersDateTo(toDateText(now));
    }
    setOrdersDatePreset(preset);
  };

  return (
    <>
      <div className="admin-dashboard-toolbar" style={{ marginBottom: 12 }}>
        <label className="admin-dashboard-search admin-dashboard-preset">
          <span>🗂</span>
          <AdminSelect
            value={ordersDatePreset || "today"}
            onChange={(event) => {
              const nextPreset = event.target.value;
              if (nextPreset === "custom") {
                setOrdersDatePreset("custom");
                return;
              }
              applyPreset(nextPreset);
            }}
            options={[
              { value: "today", label: "Hôm nay" },
              { value: "yesterday", label: "Hôm qua" },
              { value: "week", label: "Tuần này" },
              { value: "month", label: "Tháng này" },
              { value: "custom", label: "Tùy chỉnh..." }
            ]}
          />
        </label>
        {ordersDatePreset === "custom" ? (
          <>
            <label className="admin-dashboard-search">
              <span>📅</span>
              <AdminInput
                type="date"
                value={ordersDateFrom || ""}
                max={ordersDateTo || todayText}
                onChange={(event) => {
                  setOrdersDateFrom(event.target.value);
                  setOrdersDatePreset("custom");
                }}
              />
            </label>
            <label className="admin-dashboard-search">
              <span>📅</span>
              <AdminInput
                type="date"
                value={ordersDateTo || ""}
                min={ordersDateFrom || ""}
                max={todayText}
                onChange={(event) => {
                  setOrdersDateTo(event.target.value);
                  setOrdersDatePreset("custom");
                }}
              />
            </label>
          </>
        ) : null}
      </div>

      <div style={{ marginBottom: 12 }}>
        <AdminRequestAuditBadge audit={adminRequestAudit} onReset={resetAdminRequestAudit} />
      </div>

      {adminOrdersRealtimePending ? (
        <div
          style={{
            marginBottom: 12,
            border: "1px solid #fed7aa",
            background: "#fff7ed",
            color: "#c2410c",
            borderRadius: 10,
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 13,
            fontWeight: 900
          }}
        >
          <span>Có cập nhật đơn mới ({adminOrdersRealtimeCount}). Bấm để tải danh sách mới.</span>
          <button
            type="button"
            onClick={refreshAdminOrdersFromRealtime}
            style={{
              border: "1px solid #f97316",
              background: "#ffffff",
              color: "#c2410c",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 900,
              cursor: "pointer"
            }}
          >
            Cập nhật đơn
          </button>
        </div>
      ) : null}

      <AdminOrdersCrmSection
        section="orders"
        customerAdminTab="crm"
        setCustomerAdminTab={() => {}}
        ordersSnapshot={ordersSnapshot}
        setOrdersSnapshot={setOrdersSnapshot}
        onOrderUpdated={onOrderUpdated}
        crmSnapshot={crmSnapshot}
        setCrmSnapshot={setCrmSnapshot}
        selectedCustomerPhone={selectedCustomerPhone}
        setSelectedCustomerPhone={setSelectedCustomerPhone}
        onGiftVoucher={onGiftVoucher}
        orderStorage={orderStorage}
        branches={branches}
        ordersDateFrom={ordersDateFrom}
        setOrdersDateFrom={setOrdersDateFrom}
        ordersDateTo={ordersDateTo}
        setOrdersDateTo={setOrdersDateTo}
        ordersDatePreset={ordersDatePreset}
        setOrdersDatePreset={setOrdersDatePreset}
      />
    </>
  );
}
