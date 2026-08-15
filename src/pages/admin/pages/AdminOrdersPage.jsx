import AdminOrdersCrmSection from "../AdminOrdersCrmSection.jsx";
import AdminRequestAuditBadge from "../AdminRequestAuditBadge.jsx";
import { AdminButton, AdminCard, AdminInput, AdminSelect } from "../ui/index.js";
import { buildBranchFilterOptions } from "../../../services/branchIdentityService.js";

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
      <header className="admin-orders-page-head">
        <div>
          <span>Bán hàng & vận hành</span>
          <h1>Đơn hàng</h1>
          <p>Theo dõi đơn mới, xử lý đúng thứ tự và kiểm soát trạng thái theo từng chi nhánh.</p>
        </div>
        <div className="admin-orders-page-head-status" aria-label="Trạng thái dữ liệu">
          <i aria-hidden="true" />
          <span>Dữ liệu cập nhật trực tiếp</span>
        </div>
      </header>

      <section className="admin-orders-scope-bar" aria-label="Phạm vi đơn hàng">
        <label className="admin-orders-branch-select">
          <span>Chi nhánh</span>
          <AdminSelect
            value={selectedBranchFilter || "all"}
            onChange={(event) => setSelectedBranchFilter?.(event.target.value)}
            options={[
              { value: "all", label: "Tất cả chi nhánh" },
              ...branchOptions.map((branch) => ({ value: branch.value, label: branch.label }))
            ]}
          />
        </label>

        <div className="admin-orders-period-controls">
          <label className="admin-orders-period-select">
            <span>Kỳ</span>
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
        <summary>Dữ liệu & đồng bộ</summary>
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
