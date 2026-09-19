import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import {
  getInventoryStockDisplayValues,
  getInventoryStockPurchaseValues,
  getInventoryStockState
} from "../../../services/inventoryStockReportCalculations.js";

const STATUS_LABELS = { all: "Tất cả", available: "Còn hàng", low: "Sắp hết", out: "Hết hàng" };

export default function InventoryBranchStockMobile({
  rows, filters, groups, warehouses, itemById, unitById, totalCount,
  onFilterChange, onWarehouseChange, formatQuantity
}) {
  const groupName = groups.find(([id]) => id === filters.groupId)?.[1] || "Tất cả danh mục";
  const hasFilters = Boolean(filters.search || filters.groupId || filters.itemId || filters.stockState !== "all");
  return (
    <div className="inventory-branch-stock">
      <header className="inventory-branch-stock__head">
        <strong>Tồn kho hiện tại</strong>
        {warehouses.length === 1 ? <span>{warehouses[0].name}</span> : (
          <InventorySearchableSelect aria-label="Kho đang xem" value={filters.warehouseId} onChange={(event) => {
            onFilterChange({ warehouseId: event.target.value });
            onWarehouseChange?.(event.target.value);
          }}>
            <option value="">Tất cả kho được phép xem</option>
            {warehouses.filter((warehouse) => warehouse.isActive !== false).map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </InventorySearchableSelect>
        )}
      </header>
      <div className="inventory-branch-stock__controls">
        <input type="search" aria-label="Tìm tên hoặc mã nguyên vật liệu" placeholder="Tìm tên hoặc mã nguyên vật liệu…"
          value={filters.search} onChange={(event) => onFilterChange({ search: event.target.value })} />
        <div className="inventory-branch-stock__statuses" role="group" aria-label="Lọc trạng thái tồn kho">
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filters.stockState === value}
              onClick={() => onFilterChange({ stockState: value })}>{label}</button>
          ))}
        </div>
        <details className="inventory-branch-stock__filters">
          <summary>Bộ lọc{filters.groupId ? " · 1 danh mục" : ""}</summary>
          <InventorySearchableSelect aria-label="Lọc danh mục nguyên vật liệu" value={filters.groupId}
            onChange={(event) => onFilterChange({ groupId: event.target.value })}>
            <option value="">Tất cả danh mục</option>
            {groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </InventorySearchableSelect>
        </details>
        <div className="inventory-branch-stock__context" aria-live="polite">
          <span>Đang xem: <strong>{STATUS_LABELS[filters.stockState]}</strong> · {groupName} · {totalCount} dòng tồn
            {filters.itemId ? ` · ${itemById.get(filters.itemId)?.name || "Nguyên liệu đã chọn"}` : ""}
            {filters.search ? ` · Tìm “${filters.search}”` : ""}
          </span>
          {hasFilters ? <button type="button" onClick={() => onFilterChange({ search: "", groupId: "", itemId: "", stockState: "all" })}>Xóa bộ lọc</button> : null}
        </div>
      </div>
      <div className="inventory-branch-stock__columns"><span>Nguyên vật liệu</span><span>Tồn mua / nhập</span></div>
      {rows.map((row) => {
        const item = itemById.get(row.itemId) || {};
        const state = getInventoryStockState(row.quantity, item, row);
        const purchase = getInventoryStockPurchaseValues(row, item, unitById);
        const display = getInventoryStockDisplayValues(row, item, unitById);
        return (
          <details className={`inventory-branch-stock__row is-${state}`} key={`${row.warehouseId}-${row.itemId}`}>
            <summary>
              <span className="inventory-branch-stock__name"><strong>{item.name || "NVL không còn hoạt động"}</strong>
                {filters.stockState === "all" && state !== "available" ? <small>{STATUS_LABELS[state]}</small> : null}
              </span>
              <strong className="inventory-branch-stock__quantity">{formatQuantity(purchase.quantity)} <span>{purchase.unitName}</span></strong>
              <span className="inventory-branch-stock__chevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="inventory-branch-stock__detail">
              <span>Mã: {item.code || "Chưa có mã"}</span>
              {warehouses.length > 1 ? <span>Kho: {warehouses.find((warehouse) => warehouse.id === row.warehouseId)?.name || "Kho không còn hoạt động"}</span> : null}
              <span>Đơn vị mua / nhập: {purchase.unitName}</span>
              {purchase.conversionToBase !== 1 ? <span>1 {purchase.unitSymbol} = {formatQuantity(purchase.conversionToBase)} {purchase.baseUnitName}</span> : null}
              {display.conversionToBase !== purchase.conversionToBase || display.unitSymbol !== purchase.unitSymbol
                ? <span>Tương đương {formatQuantity(display.quantity)} {display.unitName}</span> : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}
