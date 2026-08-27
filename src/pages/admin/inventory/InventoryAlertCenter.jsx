import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import { buildInventoryAlerts, countInventoryAlerts } from "../../../services/inventoryAlertCalculations.js";
import { getInventoryLotDisplayValues } from "../../../services/inventoryLotReportCalculations.js";
import { getInventoryStockDisplayValues } from "../../../services/inventoryStockReportCalculations.js";
import { getInventoryRoute } from "./inventoryNavigation.js";

const CATEGORY_OPTIONS = [
  { id: "all", label: "Tất cả" },
  { id: "expiry", label: "Hạn sử dụng" },
  { id: "stock", label: "Tồn thấp" },
  { id: "negative", label: "Tồn âm" },
  { id: "documents", label: "Chứng từ chờ" }
];
const SEVERITY_LABELS = { danger: "Khẩn cấp", warning: "Cần xử lý", info: "Theo dõi" };
const DOCUMENT_STATUS_LABELS = {
  submitted: "Chờ duyệt",
  approved: "Đã duyệt",
  in_transit: "Đang giao",
  received: "Đã nhận",
  received_with_variance: "Nhận lệch"
};
const ALERT_ICONS = {
  expired: "warning",
  expiring: "clock",
  negative_stock: "warning",
  out_of_stock: "warning",
  reorder: "bell",
  pending_document: "folder"
};

function formatQuantity(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function formatDate(value = "") {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function getAlertHref(alert = {}) {
  const params = new URLSearchParams();
  if (alert.warehouseId) params.set("warehouse", alert.warehouseId);
  if (alert.itemId) params.set("item", alert.itemId);
  if (alert.kind === "expired" || alert.kind === "expiring") {
    params.set("expiry", alert.kind);
    if (alert.lotNumber) params.set("lot", alert.lotNumber);
    return `${getInventoryRoute("lots").path}?${params.toString()}`;
  }
  if (["negative_stock", "out_of_stock", "reorder"].includes(alert.kind)) {
    params.set("stock", alert.stockState || "all");
    return `${getInventoryRoute("reports").path}?${params.toString()}`;
  }
  if (alert.documentNo) params.set("q", alert.documentNo);
  const query = params.toString();
  return `${getInventoryRoute(alert.routePage || "ledger").path}${query ? `?${query}` : ""}`;
}

function getAlertMetric(alert, item, unitById) {
  if (alert.category === "stock") {
    const display = getInventoryStockDisplayValues({ quantity: alert.quantity }, item, unitById);
    return `${formatQuantity(display.quantity)} ${display.unitSymbol}`;
  }
  if (alert.category === "negative") {
    const display = getInventoryStockDisplayValues({ quantity: alert.quantity }, item, unitById);
    return `${formatQuantity(display.quantity)} ${display.unitSymbol}`;
  }
  if (alert.category === "expiry") {
    const display = getInventoryLotDisplayValues({ remainingQuantity: alert.quantity }, item, unitById);
    return `${formatQuantity(display.remainingQuantity)} ${display.unitSymbol} · HSD ${formatDate(alert.expiresOn)}`;
  }
  return alert.documentStatus ? DOCUMENT_STATUS_LABELS[alert.documentStatus] || "Đang xử lý" : "Đang chờ xử lý";
}

export default function InventoryAlertCenter({ sources = {}, warehouses = [], items = [], units = [], limited = false, warehouseSelectionLocked = false }) {
  const [searchParams] = useSearchParams();
  const routeFilterKey = searchParams.toString();
  const [filters, setFilters] = useState({ category: "all", warehouseId: "", severity: "all", search: "" });
  const warehouseById = useMemo(() => new Map(warehouses.map((row) => [row.id, row])), [warehouses]);
  const itemById = useMemo(() => new Map(items.map((row) => [row.id, row])), [items]);
  const unitById = useMemo(() => new Map(units.map((row) => [row.id, row])), [units]);
  const alerts = useMemo(() => buildInventoryAlerts({ sources, itemById, warehouseById }), [itemById, sources, warehouseById]);
  const counts = useMemo(() => countInventoryAlerts(alerts), [alerts]);
  const filteredAlerts = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase("vi");
    return alerts.filter((alert) => {
      if (filters.category !== "all" && alert.category !== filters.category) return false;
      if (filters.warehouseId && !alert.warehouseIds.includes(filters.warehouseId)) return false;
      if (filters.severity !== "all" && alert.severity !== filters.severity) return false;
      if (search && !`${alert.title} ${alert.description} ${alert.itemName || ""} ${alert.documentNo || ""} ${alert.lotNumber || ""}`.toLocaleLowerCase("vi").includes(search)) return false;
      return true;
    });
  }, [alerts, filters]);

  useEffect(() => {
    const params = new URLSearchParams(routeFilterKey);
    const requestedCategory = params.get("type") || "all";
    setFilters((current) => ({
      ...current,
      category: CATEGORY_OPTIONS.some((option) => option.id === requestedCategory) ? requestedCategory : "all",
      warehouseId: params.get("warehouse") || "",
      search: params.get("q") || ""
    }));
  }, [routeFilterKey]);

  const updateFilter = (patch) => setFilters((current) => ({ ...current, ...patch }));

  return (
    <section className="inventory-list-card inventory-alert-center">
      <header className="inventory-alert-center__head">
        <span><Icon name="warning" size={20} /></span>
        <div><strong>Việc cần xử lý trong kho</strong><small>Chỉ hiện cảnh báo còn hiệu lực; bấm vào để mở đúng dữ liệu liên quan.</small></div>
        <span className="inventory-alert-center__total">{counts.all} cảnh báo</span>
      </header>

      <nav className="inventory-alert-tabs" aria-label="Loại cảnh báo">
        {CATEGORY_OPTIONS.map((option) => (
          <button key={option.id} type="button" className={filters.category === option.id ? "is-active" : ""} onClick={() => updateFilter({ category: option.id })}>
            <span>{option.label}</span><strong>{counts[option.id]}</strong>
          </button>
        ))}
      </nav>

      <div className="inventory-alert-filters">
        <label className="inventory-search-field"><Icon name="search" size={16} /><input value={filters.search} onChange={(event) => updateFilter({ search: event.target.value })} placeholder="Tìm nguyên vật liệu, mã lô hoặc mã phiếu..." /></label>
        {warehouseSelectionLocked && warehouses.length === 1 ? (
          <div className="inventory-warehouse-fixed"><span>Kho đang xem</span><strong>{warehouses[0].name}</strong></div>
        ) : (
          <InventorySearchableSelect aria-label="Lọc kho" value={filters.warehouseId} onChange={(event) => updateFilter({ warehouseId: event.target.value })}>
            <option value="">Tất cả kho được phép xem</option>
            {warehouses.filter((row) => row.isActive !== false).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </InventorySearchableSelect>
        )}
        <InventorySearchableSelect aria-label="Lọc mức độ" value={filters.severity} onChange={(event) => updateFilter({ severity: event.target.value })}>
          <option value="all">Tất cả mức độ</option>
          <option value="danger">Khẩn cấp</option>
          <option value="warning">Cần xử lý</option>
          <option value="info">Theo dõi</option>
        </InventorySearchableSelect>
      </div>

      {limited ? <div className="inventory-ledger-warning"><Icon name="warning" size={17} />Dữ liệu đã chạm giới hạn đọc an toàn. Hãy thu hẹp phạm vi kho trước khi xử lý.</div> : null}

      <div className="inventory-alert-list">
        {filteredAlerts.map((alert) => {
          const item = itemById.get(alert.itemId) || {};
          return (
            <article key={alert.id} className={`inventory-alert-row is-${alert.severity}`}>
              <span className="inventory-alert-row__icon"><Icon name={ALERT_ICONS[alert.kind] || "warning"} size={18} /></span>
              <div className="inventory-alert-row__content">
                <div><span className={`inventory-alert-severity is-${alert.severity}`}>{SEVERITY_LABELS[alert.severity]}</span><strong>{alert.title}</strong></div>
                <p>{alert.description}</p>
              </div>
              <strong className="inventory-alert-row__metric">{getAlertMetric(alert, item, unitById)}</strong>
              <Link to={getAlertHref(alert)}>Mở xử lý <span>→</span></Link>
            </article>
          );
        })}
      </div>

      {!filteredAlerts.length ? <div className="inventory-list-empty"><Icon name="check" size={24} /><strong>Không có cảnh báo phù hợp</strong><span>Kho đang ổn hoặc không có dữ liệu khớp với bộ lọc hiện tại.</span></div> : null}
    </section>
  );
}
