import { NavLink } from "react-router-dom";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import { getInventoryDocumentDateRange } from "../../../services/inventoryDocumentFilters.js";
import { getInventoryDocumentPath } from "../../../services/inventoryLedgerCalculations.js";
import { getInventoryItemDisplayUnitConfig } from "../../../services/inventoryUnitConversion.js";

const STAGE_LABELS = {
  completion: "Hoàn tất phiếu",
  dispatch: "Giao hàng",
  receipt: "Nhận hàng",
  adjustment: "Điều chỉnh",
  reversal: "Hoàn tác",
  order_consumption: "Bán hàng"
};

function formatQuantity(value, maximumFractionDigits = 3) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits }).format(Number(value || 0));
}

function formatMoney(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDateTime(value = "") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  }).format(date);
}

function getReferenceUnitCost(item = {}, unitsById = new Map(), unitCost = 0) {
  const { unit, conversionToBase } = getInventoryItemDisplayUnitConfig(item, unitsById);
  const baseUnitName = item?.baseUnit?.name || "đơn vị tồn";
  if (!unit?.name || unit.name === baseUnitName || conversionToBase <= 1) return null;

  return {
    unitName: unit.name,
    unitCost: Number(unitCost || 0) * conversionToBase
  };
}

export default function InventoryLedger({
  rows = [],
  warehouses = [],
  items = [],
  units = [],
  filters = {},
  totalCount = 0,
  pageCount = 1,
  summary = null,
  summaryLimited = false,
  warehouseSelectionLocked = false,
  onFiltersChange
}) {
  const warehouseById = new Map(warehouses.map((row) => [row.id, row]));
  const itemById = new Map(items.map((row) => [row.id, row]));
  const unitsById = new Map(units.map((row) => [row.id, row]));
  const selectedItem = itemById.get(filters.itemId);
  const selectedUnit = selectedItem?.baseUnit?.name || "đơn vị tồn";
  const applyDatePreset = (datePreset) => {
    onFiltersChange?.({ datePreset, ...getInventoryDocumentDateRange(datePreset) });
  };

  return (
    <section className="inventory-list-card inventory-ledger">
      <header className="inventory-ledger__head">
        <span><Icon name="check" size={20} /></span>
        <div>
          <strong>Sổ nhập – xuất – tồn</strong>
          <small>Mỗi dòng là một biến động đã ghi sổ. Dữ liệu ở màn hình này chỉ đọc.</small>
        </div>
      </header>

      <div className="inventory-ledger-toolbar">
        <div className="inventory-document-date-presets" aria-label="Khoảng ngày nhanh">
          <button className={filters.datePreset === "today" ? "is-active" : ""} type="button" onClick={() => applyDatePreset("today")}>Hôm nay</button>
          <button className={filters.datePreset === "7d" ? "is-active" : ""} type="button" onClick={() => applyDatePreset("7d")}>7 ngày</button>
          <button className={filters.datePreset === "30d" ? "is-active" : ""} type="button" onClick={() => applyDatePreset("30d")}>30 ngày</button>
        </div>
        <label className="inventory-document-date-field">
          <span>Từ ngày</span>
          <input type="date" max={filters.toDate || undefined} value={filters.fromDate || ""} onChange={(event) => onFiltersChange?.({ datePreset: "custom", fromDate: event.target.value })} />
        </label>
        <label className="inventory-document-date-field">
          <span>Đến ngày</span>
          <input type="date" min={filters.fromDate || undefined} value={filters.toDate || ""} onChange={(event) => onFiltersChange?.({ datePreset: "custom", toDate: event.target.value })} />
        </label>
        {warehouseSelectionLocked && warehouses.length === 1 ? (
          <div className="inventory-ledger-select inventory-warehouse-fixed"><span>Kho</span><strong>{warehouses[0].name}</strong><small>Theo tài khoản chi nhánh</small></div>
        ) : (
          <label className="inventory-ledger-select">
            <span>Kho</span>
            <InventorySearchableSelect value={filters.warehouseId || ""} onChange={(event) => onFiltersChange?.({ warehouseId: event.target.value })}>
              <option value="">Tất cả kho</option>
              {warehouses.filter((row) => row.isActive !== false).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </InventorySearchableSelect>
          </label>
        )}
        <label className="inventory-ledger-select">
          <span>Nguyên vật liệu</span>
          <InventorySearchableSelect value={filters.itemId || ""} onChange={(event) => onFiltersChange?.({ itemId: event.target.value })}>
            <option value="">Tất cả nguyên vật liệu</option>
            {items.filter((row) => row.isActive !== false).map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}
          </InventorySearchableSelect>
        </label>
      </div>

      {selectedItem && summary && !summaryLimited ? (
        <>
          <div className="inventory-ledger-selection">
            <span>Đang đối chiếu</span>
            <strong>{selectedItem.name}</strong>
            <small>Đơn vị tồn: {selectedUnit}</small>
          </div>
          <div className="inventory-summary-grid inventory-ledger-summary">
            <div><span>Tồn đầu kỳ</span><strong>{formatQuantity(summary.opening)}</strong><small>{selectedUnit}</small></div>
            <div className="is-in"><span>Nhập trong kỳ</span><strong>+{formatQuantity(summary.inbound)}</strong><small>{selectedUnit}</small></div>
            <div className="is-out"><span>Xuất trong kỳ</span><strong>-{formatQuantity(summary.outbound)}</strong><small>{selectedUnit}</small></div>
            <div><span>Tồn cuối kỳ</span><strong>{formatQuantity(summary.closing)}</strong><small>{selectedUnit}</small></div>
          </div>
        </>
      ) : !selectedItem ? (
        <div className="inventory-ledger-guide">
          <Icon name="eye" size={17} />
          <span>Chọn một nguyên vật liệu để xem chính xác <strong>tồn đầu, nhập, xuất và tồn cuối</strong>.</span>
        </div>
      ) : null}

      {summaryLimited ? (
        <div className="inventory-ledger-warning" role="alert">
          <Icon name="warning" size={17} />
          Kỳ đang chọn có quá nhiều biến động để cộng trực tiếp. Danh sách vẫn đúng, nhưng chưa hiển thị tổng để tránh báo sai.
        </div>
      ) : null}

      <div className="inventory-table-scroll">
        <table className="inventory-data-table inventory-ledger-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Kho</th>
              <th>Nguyên vật liệu</th>
              <th>Chứng từ</th>
              <th>Nghiệp vụ</th>
              <th className="is-number">Nhập</th>
              <th className="is-number">Xuất</th>
              <th className="is-number">Giá vốn/đơn vị tồn</th>
              <th className="is-number">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const warehouse = warehouseById.get(row.warehouseId);
              const item = itemById.get(row.itemId);
              const unitName = item?.baseUnit?.name || "đơn vị tồn";
              const referenceUnitCost = getReferenceUnitCost(item, unitsById, row.unitCost);
              return (
                <tr key={row.id}>
                  <td><strong>{formatDateTime(row.occurredAt)}</strong><small>#{row.sequence}</small></td>
                  <td><strong>{warehouse?.name || "Kho không còn hoạt động"}</strong><small>{warehouse?.code || row.warehouseId}</small></td>
                  <td><strong>{item?.name || "NVL không còn hoạt động"}</strong><small>{item?.code || row.itemId} · {unitName}</small></td>
                  <td>
                    {row.documentNo ? <NavLink className="inventory-ledger-document" to={getInventoryDocumentPath(row.documentType)}>{row.documentNo}</NavLink> : <span>—</span>}
                  </td>
                  <td><span className={`inventory-ledger-direction is-${row.direction}`}>{STAGE_LABELS[row.stage] || row.stage || "Biến động kho"}</span></td>
                  <td className="is-number is-in">{row.direction === "in" ? formatQuantity(row.quantity) : "—"}</td>
                  <td className="is-number is-out">{row.direction === "out" ? formatQuantity(row.quantity) : "—"}</td>
                  <td className="is-number">
                    <strong>{formatMoney(row.unitCost)} đ/{unitName}</strong>
                    {referenceUnitCost ? <small>≈ {formatMoney(referenceUnitCost.unitCost)} đ/{referenceUnitCost.unitName}</small> : null}
                  </td>
                  <td className="is-number"><strong>{formatMoney(row.quantity * row.unitCost)} đ</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!rows.length ? (
        <div className="inventory-list-empty">
          <Icon name="eye" size={24} />
          <strong>Chưa có biến động trong khoảng đang chọn</strong>
          <span>Đổi khoảng ngày, kho hoặc nguyên vật liệu để kiểm tra lại.</span>
        </div>
      ) : null}

      <footer className="inventory-document-pagination">
        <span>{totalCount} biến động · Trang {filters.page || 1}/{pageCount}</span>
        <div>
          <button type="button" disabled={(filters.page || 1) <= 1} onClick={() => onFiltersChange?.({ page: (filters.page || 1) - 1 })}>Trang trước</button>
          <button type="button" disabled={(filters.page || 1) >= pageCount} onClick={() => onFiltersChange?.({ page: (filters.page || 1) + 1 })}>Trang sau</button>
        </div>
      </footer>
    </section>
  );
}
