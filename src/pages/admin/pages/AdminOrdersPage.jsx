import AdminOrdersCrmSection from "../AdminOrdersCrmSection.jsx";
import AdminRequestAuditBadge from "../AdminRequestAuditBadge.jsx";
import { AdminButton, AdminCard, AdminInput, AdminSelect } from "../ui/index.js";
import { buildBranchFilterOptions } from "../../../services/branchIdentityService.js";

function getBranchShortLabel(label = "") {
  const text = String(label || "").trim();
  const match = text.match(/(?:Ganh Hang Rong\s*-\s*)?(.+)/i);
  return (match?.[1] || text || "Chi nhánh").replace(/\s+/g, " ");
}

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
  adminOrdersLoadError,
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
  setOrdersDatePreset,
  selectedBranchFilter = "all",
  setSelectedBranchFilter
}) {
  const todayText = new Date().toISOString().slice(0, "10");
  const branchOptions = buildBranchFilterOptions(branches);

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
    <div className="admin-orders-page">
      <header className="admin-orders-compact-head">
        <div className="admin-orders-compact-title">
          <span>Vận hành đơn hàng</span>
          <h1>Quản lý đơn hàng</h1>
          <p>Danh sách đọc trực tiếp từ Supabase, tách rõ Website, POS và FoodApp.</p>
        </div>
        <div className="admin-orders-compact-meta">
          <strong>{ordersSnapshot?.length || 0}</strong>
          <span>đơn trong kỳ</span>
        </div>
      </header>

      <section className="admin-orders-scope-bar" aria-label="Phạm vi đơn hàng">
        <div className="admin-orders-branch-switcher">
          <span>Chi nhánh</span>
          <div>
            <button
              type="button"
              className={selectedBranchFilter === "all" ? "is-active" : ""}
              onClick={() => setSelectedBranchFilter?.("all")}
            >
              Tất cả
            </button>
            {branchOptions.map((branch) => (
              <button
                key={branch.value}
                type="button"
                className={branch.value === selectedBranchFilter ? "is-active" : ""}
                onClick={() => setSelectedBranchFilter?.(branch.value)}
                title={branch.label}
              >
                {getBranchShortLabel(branch.label)}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-orders-period-controls">
          <label className="admin-orders-period-select">
            <span>Ky</span>
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
              <label className="admin-orders-period-date">
                <span>Từ ngày</span>
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
              <label className="admin-orders-period-date">
                <span>Đến ngày</span>
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
      </section>

      <details className="admin-orders-audit-details">
        <summary>Kiểm tra request</summary>
        <AdminRequestAuditBadge audit={adminRequestAudit} onReset={resetAdminRequestAudit} />
      </details>

      {adminOrdersLoadError ? (
        <AdminCard className="admin-orders-load-error">
          <strong>{adminOrdersLoadError}</strong>
          <span>Trang đơn hàng đang đọc trực tiếp từ Supabase để tránh hiển thị dữ liệu cũ.</span>
          <AdminButton type="button" onClick={refreshAdminOrdersFromRealtime}>
            Tải lại
          </AdminButton>
        </AdminCard>
      ) : null}

      {adminOrdersRealtimePending ? (
        <AdminCard className="admin-orders-realtime-notice">
          <div className="admin-orders-realtime-content">
            <span>Có cập nhật đơn mới ({adminOrdersRealtimeCount}). Bấm để tải danh sách mới.</span>
            <AdminButton type="button" onClick={refreshAdminOrdersFromRealtime}>
              Cập nhật đơn
            </AdminButton>
          </div>
        </AdminCard>
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
        selectedBranchFilter={selectedBranchFilter}
        ordersDateFrom={ordersDateFrom}
        setOrdersDateFrom={setOrdersDateFrom}
        ordersDateTo={ordersDateTo}
        setOrdersDateTo={setOrdersDateTo}
        ordersDatePreset={ordersDatePreset}
        setOrdersDatePreset={setOrdersDatePreset}
      />
    </div>
  );
}
