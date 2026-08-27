import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import {
  calculateInventoryStockReportSummary,
  buildInventoryStockReportRows,
  getInventoryStockDisplayValues,
  getInventoryStockPurchaseValues,
  getInventoryStockState
} from "../../../services/inventoryStockReportCalculations.js";

const PAGE_SIZE = 50;
const STOCK_STATE_LABELS = {
  available: "Còn hàng",
  low: "Sắp hết",
  out: "Hết hàng"
};

function formatQuantity(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function formatMoney(value) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0))} đ`;
}

export default function InventoryStockReport({ rows = [], warehouses = [], items = [], units = [], limited = false, warehouseSelectionLocked = false, selectedWarehouseId = "", onWarehouseChange }) {
  const [searchParams] = useSearchParams();
  const routeFilterKey = searchParams.toString();
  const [filters, setFilters] = useState({ warehouseId: "", itemId: "", groupId: "", stockState: "all", search: "" });
  const [page, setPage] = useState(1);
  const warehouseById = useMemo(() => new Map(warehouses.map((row) => [row.id, row])), [warehouses]);
  const itemById = useMemo(() => new Map(items.map((row) => [row.id, row])), [items]);
  const unitById = useMemo(() => new Map(units.map((row) => [row.id, row])), [units]);
  const groups = useMemo(() => {
    const values = new Map();
    items.forEach((item) => {
      if (item.itemGroup?.id) values.set(item.itemGroup.id, item.itemGroup.name);
    });
    return [...values.entries()].sort((left, right) => left[1].localeCompare(right[1], "vi"));
  }, [items]);
  const reportWarehouses = useMemo(() => (
    selectedWarehouseId
      ? warehouses.filter((warehouse) => warehouse.id === selectedWarehouseId)
      : warehouses
  ), [selectedWarehouseId, warehouses]);
  const reportRows = useMemo(() => (
    buildInventoryStockReportRows(rows, reportWarehouses, items)
  ), [items, reportWarehouses, rows]);
  const filteredRows = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase("vi");
    return reportRows.filter((row) => {
      const item = itemById.get(row.itemId) || {};
      const warehouse = warehouseById.get(row.warehouseId) || {};
      const state = getInventoryStockState(row.quantity, item);
      if (filters.warehouseId && row.warehouseId !== filters.warehouseId) return false;
      if (filters.itemId && row.itemId !== filters.itemId) return false;
      if (filters.groupId && item.groupId !== filters.groupId) return false;
      if (filters.stockState !== "all" && state !== filters.stockState) return false;
      if (search && !`${item.code || ""} ${item.name || ""} ${warehouse.name || ""}`.toLocaleLowerCase("vi").includes(search)) return false;
      return true;
    });
  }, [filters, itemById, reportRows, warehouseById]);
  const summary = useMemo(() => calculateInventoryStockReportSummary(filteredRows, itemById), [filteredRows, itemById]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    const params = new URLSearchParams(routeFilterKey);
    const requestedWarehouseId = params.get("warehouse") || "";
    const stockState = ["available", "low", "out"].includes(params.get("stock")) ? params.get("stock") : "all";
    setFilters((current) => ({
      ...current,
      warehouseId: requestedWarehouseId,
      itemId: params.get("item") || "",
      stockState,
      search: params.get("q") || ""
    }));
    if (requestedWarehouseId) onWarehouseChange?.(requestedWarehouseId);
    setPage(1);
  }, [onWarehouseChange, routeFilterKey]);

  useEffect(() => {
    if (new URLSearchParams(routeFilterKey).has("warehouse")) return;
    setFilters((current) => current.warehouseId === selectedWarehouseId ? current : { ...current, warehouseId: selectedWarehouseId });
    setPage(1);
  }, [routeFilterKey, selectedWarehouseId]);

  const updateFilter = (patch) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  return (
    <section className="inventory-list-card inventory-stock-report">
      <header className="inventory-stock-report__head">
        <span><Icon name="wallet" size={20} /></span>
        <div>
          <strong>Báo cáo tồn kho hiện tại</strong>
          <small>Số lượng và giá trị tồn được tính theo giá vốn bình quân đang lưu tại từng kho.</small>
        </div>
      </header>

      <div className="inventory-stock-report__scope">
        <Icon name="eye" size={16} />
        Chỉ hiển thị các kho tài khoản hiện tại được phân quyền xem.
      </div>

      <div className="inventory-summary-grid inventory-stock-report__summary">
        <div><span>Giá trị tồn</span><strong>{formatMoney(summary.totalValue)}</strong><small>Trong phạm vi đang lọc</small></div>
        <div><span>Mặt hàng có tồn</span><strong>{summary.availableCount}</strong><small>Dòng kho × nguyên vật liệu</small></div>
        <div className="is-warning"><span>Sắp hết</span><strong>{summary.lowCount}</strong><small>Đã chạm ngưỡng cảnh báo</small></div>
        <div className="is-danger"><span>Hết hàng</span><strong>{summary.outCount}</strong><small>Số lượng bằng hoặc dưới 0</small></div>
      </div>

      <div className="inventory-stock-report__filters">
        <label className="inventory-search-field">
          <Icon name="search" size={16} />
          <input value={filters.search} onChange={(event) => updateFilter({ search: event.target.value })} placeholder="Tìm mã hoặc tên nguyên vật liệu..." />
        </label>
        {warehouseSelectionLocked && warehouses.length === 1 ? (
          <div className="inventory-warehouse-fixed"><span>Kho đang xem</span><strong>{warehouses[0].name}</strong></div>
        ) : (
          <InventorySearchableSelect aria-label="Lọc kho" value={filters.warehouseId} onChange={(event) => { updateFilter({ warehouseId: event.target.value }); onWarehouseChange?.(event.target.value); }}>
            <option value="">Tất cả kho được phép xem</option>
            {warehouses.filter((row) => row.isActive !== false).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </InventorySearchableSelect>
        )}
        <InventorySearchableSelect aria-label="Lọc danh mục" value={filters.groupId} onChange={(event) => updateFilter({ groupId: event.target.value })}>
          <option value="">Tất cả danh mục</option>
          {groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </InventorySearchableSelect>
        <InventorySearchableSelect aria-label="Lọc trạng thái tồn" value={filters.stockState} onChange={(event) => updateFilter({ stockState: event.target.value })}>
          <option value="all">Tất cả trạng thái</option>
          <option value="available">Còn hàng</option>
          <option value="low">Sắp hết</option>
          <option value="out">Hết hàng</option>
        </InventorySearchableSelect>
      </div>

      {limited ? <div className="inventory-ledger-warning"><Icon name="warning" size={17} />Báo cáo đã chạm giới hạn 5.000 dòng. Cần bổ sung báo cáo tổng hợp phía máy chủ trước khi dùng ở quy mô lớn hơn.</div> : null}

      <div className="inventory-table-scroll">
        <table className="inventory-data-table inventory-stock-report__table">
          <thead><tr><th>Kho</th><th>Nguyên vật liệu</th><th>Danh mục</th><th className="is-number">Tồn theo đơn vị mua / nhập</th><th>Đơn vị mua / nhập</th><th className="is-number">Giá vốn bình quân</th><th className="is-number">Giá trị tồn</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {visibleRows.map((row) => {
              const item = itemById.get(row.itemId) || {};
              const warehouse = warehouseById.get(row.warehouseId) || {};
              const state = getInventoryStockState(row.quantity, item);
              const display = getInventoryStockDisplayValues(row, item, unitById);
              const purchase = getInventoryStockPurchaseValues(row, item, unitById);
              const hasDifferentDisplayUnit = display.unitSymbol !== purchase.unitSymbol
                || display.conversionToBase !== purchase.conversionToBase;
              return (
                <tr className={`inventory-stock-row is-${state}`} key={`${row.warehouseId}-${row.itemId}`}>
                  <td><strong>{warehouse.name || "Kho không còn hoạt động"}</strong><small>{warehouse.code || row.warehouseId}</small></td>
                  <td><strong>{item.name || "NVL không còn hoạt động"}</strong><small>{item.code || row.itemId}</small>{state !== "available" ? <em className={`inventory-stock-attention is-${state}`}>{state === "out" ? "Cần nhập ngay" : "Cần bổ sung"}</em> : null}</td>
                  <td><span className="inventory-data-pill is-category">{item.itemGroup?.name || "Chưa phân nhóm"}</span></td>
                  <td className="is-number"><strong>{formatQuantity(purchase.quantity)}</strong>{hasDifferentDisplayUnit ? <small>Tương đương {formatQuantity(display.quantity)} {display.unitSymbol}</small> : null}</td>
                  <td><strong>{purchase.unitName}</strong>{purchase.conversionToBase > 1 ? <small>1 {purchase.unitSymbol} = {formatQuantity(purchase.conversionToBase)} {purchase.baseUnitName}</small> : <small>Kho lưu trực tiếp theo đơn vị này</small>}{hasDifferentDisplayUnit ? <small>Đơn vị hiển thị: {display.unitName}</small> : null}</td>
                  <td className="is-number">{formatMoney(purchase.averageCost)}<small>/ {purchase.unitSymbol}</small></td>
                  <td className="is-number"><strong>{formatMoney(purchase.totalValue)}</strong></td>
                  <td><span className={`inventory-stock-state is-${state}`}>{STOCK_STATE_LABELS[state]}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!visibleRows.length ? <div className="inventory-list-empty"><Icon name="eye" size={24} /><strong>Chưa có số dư phù hợp</strong><span>Đổi bộ lọc hoặc hoàn tất phiếu nhập để tạo số tồn.</span></div> : null}

      <footer className="inventory-document-pagination">
        <span>{filteredRows.length} dòng tồn · Trang {safePage}/{pageCount}</span>
        <div><button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Trang trước</button><button type="button" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Trang sau</button></div>
      </footer>
    </section>
  );
}
