import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import {
  calculateInventoryLotSummary,
  getInventoryLotDaysRemaining,
  getInventoryLotDisplayValues,
  getInventoryLotExpiryState,
  getInventoryTodayKey
} from "../../../services/inventoryLotReportCalculations.js";

const PAGE_SIZE = 50;
const EXPIRY_STATE_LABELS = {
  expired: "Đã hết hạn",
  expiring: "Sắp hết hạn",
  valid: "Còn hạn",
  untracked: "Không theo dõi"
};

function formatQuantity(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function formatDate(value = "") {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatRemainingDays(days) {
  if (days === null) return "—";
  if (days < 0) return `Quá ${Math.abs(days)} ngày`;
  if (days === 0) return "Hết hạn hôm nay";
  return `Còn ${days} ngày`;
}

export default function InventoryLotReport({ rows = [], warehouses = [], items = [], units = [], limited = false, warehouseSelectionLocked = false }) {
  const [searchParams] = useSearchParams();
  const routeFilterKey = searchParams.toString();
  const [filters, setFilters] = useState({ warehouseId: "", itemId: "", expiryState: "all", search: "" });
  const [page, setPage] = useState(1);
  const todayKey = getInventoryTodayKey();
  const warehouseById = useMemo(() => new Map(warehouses.map((row) => [row.id, row])), [warehouses]);
  const itemById = useMemo(() => new Map(items.map((row) => [row.id, row])), [items]);
  const unitById = useMemo(() => new Map(units.map((row) => [row.id, row])), [units]);

  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase("vi");
    return rows.filter((row) => {
      const item = itemById.get(row.itemId) || {};
      const warehouse = warehouseById.get(row.warehouseId) || {};
      const state = getInventoryLotExpiryState(row, item, todayKey);
      if (filters.warehouseId && row.warehouseId !== filters.warehouseId) return false;
      if (filters.itemId && row.itemId !== filters.itemId) return false;
      if (filters.expiryState === "alert" && !["expired", "expiring"].includes(state)) return false;
      if (!["all", "alert"].includes(filters.expiryState) && state !== filters.expiryState) return false;
      if (search && !`${row.lotNumber} ${row.sourceDocumentNo} ${item.code || ""} ${item.name || ""} ${warehouse.name || ""}`.toLocaleLowerCase("vi").includes(search)) return false;
      return true;
    });
  }, [filters, itemById, rows, todayKey, warehouseById]);
  const summary = useMemo(() => calculateInventoryLotSummary(filteredRows, itemById, todayKey), [filteredRows, itemById, todayKey]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    const params = new URLSearchParams(routeFilterKey);
    const requestedExpiry = params.get("expiry") || "all";
    const expiryState = ["all", "alert", "expired", "expiring", "valid", "untracked"].includes(requestedExpiry) ? requestedExpiry : "all";
    setFilters((current) => ({
      ...current,
      warehouseId: params.get("warehouse") || "",
      itemId: params.get("item") || "",
      expiryState,
      search: params.get("lot") || params.get("q") || ""
    }));
    setPage(1);
  }, [routeFilterKey]);

  const updateFilter = (patch) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  return (
    <section className="inventory-list-card inventory-stock-report inventory-lot-report">
      <header className="inventory-stock-report__head">
        <span><Icon name="clock" size={20} /></span>
        <div>
          <strong>Lô hàng đang còn tồn</strong>
          <small>Theo dõi ngày sản xuất, hạn dùng và số lượng còn lại của từng lô.</small>
        </div>
      </header>

      <div className="inventory-stock-report__scope">
        <Icon name="eye" size={16} />
        Chỉ hiển thị lô thuộc các kho tài khoản hiện tại được phân quyền xem.
      </div>

      <div className="inventory-summary-grid inventory-stock-report__summary">
        <div><span>Lô đang còn tồn</span><strong>{summary.total}</strong><small>Trong phạm vi đang lọc</small></div>
        <div className="is-danger"><span>Đã hết hạn</span><strong>{summary.expired}</strong><small>Cần xử lý ngay</small></div>
        <div className="is-warning"><span>Sắp hết hạn</span><strong>{summary.expiring}</strong><small>Theo ngưỡng từng NVL</small></div>
        <div><span>Không theo dõi HSD</span><strong>{summary.untracked}</strong><small>Lô không có ngày hết hạn</small></div>
      </div>

      <div className="inventory-stock-report__filters">
        <label className="inventory-search-field">
          <Icon name="search" size={16} />
          <input value={filters.search} onChange={(event) => updateFilter({ search: event.target.value })} placeholder="Tìm mã lô hoặc nguyên vật liệu..." />
        </label>
        {warehouseSelectionLocked && warehouses.length === 1 ? (
          <div className="inventory-warehouse-fixed"><span>Kho đang xem</span><strong>{warehouses[0].name}</strong></div>
        ) : (
          <InventorySearchableSelect aria-label="Lọc kho" value={filters.warehouseId} onChange={(event) => updateFilter({ warehouseId: event.target.value })}>
            <option value="">Tất cả kho được phép xem</option>
            {warehouses.filter((row) => row.isActive !== false).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </InventorySearchableSelect>
        )}
        <InventorySearchableSelect aria-label="Lọc nguyên vật liệu" value={filters.itemId} onChange={(event) => updateFilter({ itemId: event.target.value })}>
          <option value="">Tất cả nguyên vật liệu</option>
          {items.filter((row) => row.isActive !== false).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </InventorySearchableSelect>
        <InventorySearchableSelect aria-label="Lọc hạn sử dụng" value={filters.expiryState} onChange={(event) => updateFilter({ expiryState: event.target.value })}>
          <option value="all">Tất cả hạn sử dụng</option>
          <option value="alert">Sắp hoặc đã hết hạn</option>
          <option value="expired">Đã hết hạn</option>
          <option value="expiring">Sắp hết hạn</option>
          <option value="valid">Còn hạn</option>
          <option value="untracked">Không theo dõi HSD</option>
        </InventorySearchableSelect>
      </div>

      {limited ? <div className="inventory-ledger-warning"><Icon name="warning" size={17} />Danh sách đã chạm giới hạn 5.000 lô. Cần bổ sung phân trang phía máy chủ trước khi dùng ở quy mô lớn hơn.</div> : null}

      <div className="inventory-table-scroll">
        <table className="inventory-data-table inventory-lot-report__table">
          <thead><tr><th>Kho</th><th>Nguyên vật liệu</th><th>Mã lô</th><th className="is-number">Số lượng còn</th><th>Ngày sản xuất</th><th>Hạn sử dụng</th><th>Còn lại</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {visibleRows.map((row) => {
              const item = itemById.get(row.itemId) || {};
              const warehouse = warehouseById.get(row.warehouseId) || {};
              const state = getInventoryLotExpiryState(row, item, todayKey);
              const daysRemaining = getInventoryLotDaysRemaining(row.expiresOn, todayKey);
              const display = getInventoryLotDisplayValues(row, item, unitById);
              return (
                <tr key={row.id}>
                  <td><strong>{warehouse.name || "Kho không còn hoạt động"}</strong><small>{warehouse.code || row.warehouseId}</small></td>
                  <td><strong>{item.name || "NVL không còn hoạt động"}</strong><small>{item.code || row.itemId}</small></td>
                  <td><strong>{row.lotNumber}</strong>{row.sourceDocumentNo ? <small>Nguồn: {row.sourceDocumentNo}</small> : null}</td>
                  <td className="is-number"><strong>{formatQuantity(display.remainingQuantity)} {display.unitSymbol}</strong><small>Nhập {formatQuantity(display.receivedQuantity)} {display.unitSymbol}</small></td>
                  <td>{formatDate(row.manufacturedOn)}</td>
                  <td><strong>{formatDate(row.expiresOn)}</strong></td>
                  <td><span className={`inventory-lot-days is-${state}`}>{formatRemainingDays(daysRemaining)}</span></td>
                  <td><span className={`inventory-stock-state is-${state}`}>{EXPIRY_STATE_LABELS[state]}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!visibleRows.length ? <div className="inventory-list-empty"><Icon name="clock" size={24} /><strong>Chưa có lô phù hợp</strong><span>Đổi bộ lọc hoặc hoàn tất phiếu nhập có lô để bắt đầu theo dõi hạn sử dụng.</span></div> : null}

      <footer className="inventory-document-pagination">
        <span>{filteredRows.length} lô · Trang {safePage}/{pageCount}</span>
        <div><button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Trang trước</button><button type="button" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Trang sau</button></div>
      </footer>
    </section>
  );
}
