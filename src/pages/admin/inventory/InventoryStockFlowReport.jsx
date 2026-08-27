import { useEffect, useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import { getInventoryDocumentDateRange } from "../../../services/inventoryDocumentFilters.js";

function formatQuantity(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function formatMoney(value) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0))} đ`;
}

export default function InventoryStockFlowReport({
  rows = [],
  summary = null,
  warehouses = [],
  items = [],
  filters = {},
  totalCount = 0,
  pageCount = 1,
  loading = false,
  warehouseSelectionLocked = false,
  onFiltersChange
}) {
  const [searchDraft, setSearchDraft] = useState(filters.search || "");
  const groups = useMemo(() => {
    const values = new Map();
    items.forEach((item) => {
      if (item.itemGroup?.id) values.set(item.itemGroup.id, item.itemGroup.name);
    });
    return [...values.entries()].sort((left, right) => left[1].localeCompare(right[1], "vi"));
  }, [items]);

  useEffect(() => setSearchDraft(filters.search || ""), [filters.search]);

  const applyDatePreset = (datePreset) => {
    onFiltersChange?.({ datePreset, ...getInventoryDocumentDateRange(datePreset) });
  };
  const submitSearch = (event) => {
    event.preventDefault();
    onFiltersChange?.({ search: searchDraft.trim() });
  };

  return (
    <section className="inventory-list-card inventory-stock-report inventory-stock-flow-report">
      <header className="inventory-stock-report__head">
        <span><Icon name="menu" size={20} /></span>
        <div>
          <strong>Nhập – Xuất – Tồn theo thời gian</strong>
          <small>Đối chiếu tồn đầu kỳ, phát sinh trong kỳ và tồn cuối kỳ theo từng kho.</small>
        </div>
      </header>

      <div className="inventory-stock-report__scope">
        <Icon name="check" size={16} />
        Số liệu được tổng hợp tại Supabase và tự giới hạn theo quyền kho của tài khoản.
      </div>

      <div className="inventory-summary-grid inventory-stock-report__summary">
        <div><span>Giá trị đầu kỳ</span><strong>{formatMoney(summary?.openingValue)}</strong><small>Trước ngày bắt đầu</small></div>
        <div className="is-in"><span>Nhập trong kỳ</span><strong>{formatMoney(summary?.inboundValue)}</strong><small>Giá trị ghi tăng</small></div>
        <div className="is-out"><span>Xuất trong kỳ</span><strong>{formatMoney(summary?.outboundValue)}</strong><small>Giá trị ghi giảm</small></div>
        <div><span>Giá trị cuối kỳ</span><strong>{formatMoney(summary?.closingValue)}</strong><small>{summary?.movementCount || 0} biến động</small></div>
      </div>

      <div className="inventory-stock-flow-report__filters">
        <div className="inventory-document-date-presets" aria-label="Khoảng ngày nhanh">
          <button className={filters.datePreset === "today" ? "is-active" : ""} type="button" onClick={() => applyDatePreset("today")}>Hôm nay</button>
          <button className={filters.datePreset === "7d" ? "is-active" : ""} type="button" onClick={() => applyDatePreset("7d")}>7 ngày</button>
          <button className={filters.datePreset === "30d" ? "is-active" : ""} type="button" onClick={() => applyDatePreset("30d")}>30 ngày</button>
        </div>
        <label className="inventory-document-date-field"><span>Từ ngày</span><input type="date" max={filters.toDate || undefined} value={filters.fromDate || ""} onChange={(event) => onFiltersChange?.({ datePreset: "custom", fromDate: event.target.value })} /></label>
        <label className="inventory-document-date-field"><span>Đến ngày</span><input type="date" min={filters.fromDate || undefined} value={filters.toDate || ""} onChange={(event) => onFiltersChange?.({ datePreset: "custom", toDate: event.target.value })} /></label>
        {warehouseSelectionLocked && warehouses.length === 1 ? (
          <div className="inventory-warehouse-fixed"><span>Kho đang xem</span><strong>{warehouses[0].name}</strong></div>
        ) : (
          <label className="inventory-ledger-select"><span>Kho</span><InventorySearchableSelect value={filters.warehouseId || ""} onChange={(event) => onFiltersChange?.({ warehouseId: event.target.value })}><option value="">Tất cả kho được phép xem</option>{warehouses.filter((row) => row.isActive !== false).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</InventorySearchableSelect></label>
        )}
        <label className="inventory-ledger-select"><span>Danh mục</span><InventorySearchableSelect value={filters.groupId || ""} onChange={(event) => onFiltersChange?.({ groupId: event.target.value })}><option value="">Tất cả danh mục</option>{groups.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</InventorySearchableSelect></label>
        <form className="inventory-stock-flow-report__search" onSubmit={submitSearch}>
          <label className="inventory-search-field"><Icon name="search" size={16} /><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Tìm mã hoặc tên nguyên vật liệu..." /></label>
          <button type="submit">Tìm</button>
        </form>
      </div>

      <div className="inventory-table-scroll">
        <table className="inventory-data-table inventory-stock-flow-report__table">
          <thead><tr><th>Kho</th><th>Nguyên vật liệu</th><th>Danh mục</th><th className="is-number">Tồn đầu</th><th className="is-number">Nhập</th><th className="is-number">Xuất</th><th className="is-number">Tồn cuối</th><th className="is-number">Giá trị cuối</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.warehouseId}-${row.itemId}`}>
                <td><strong>{row.warehouseName}</strong><small>{row.warehouseCode}</small></td>
                <td><strong>{row.itemName}</strong><small>{row.itemCode} · {row.unitName}</small></td>
                <td><span className="inventory-data-pill is-category">{row.groupName || "Chưa phân nhóm"}</span></td>
                <td className="is-number">{formatQuantity(row.openingQuantity)}</td>
                <td className="is-number is-in">{row.inboundQuantity ? `+${formatQuantity(row.inboundQuantity)}` : "—"}</td>
                <td className="is-number is-out">{row.outboundQuantity ? `-${formatQuantity(row.outboundQuantity)}` : "—"}</td>
                <td className="is-number"><strong>{formatQuantity(row.closingQuantity)}</strong></td>
                <td className="is-number"><strong>{formatMoney(row.closingValue)}</strong><small>{row.movementCount} biến động</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!rows.length && !loading ? <div className="inventory-list-empty"><Icon name="eye" size={24} /><strong>Chưa có số liệu trong kỳ</strong><span>Đổi khoảng ngày hoặc bộ lọc để kiểm tra lại.</span></div> : null}

      <footer className="inventory-document-pagination">
        <span>{totalCount} dòng kho × nguyên vật liệu · Trang {filters.page || 1}/{pageCount}</span>
        <div><button type="button" disabled={(filters.page || 1) <= 1 || loading} onClick={() => onFiltersChange?.({ page: (filters.page || 1) - 1 })}>Trang trước</button><button type="button" disabled={(filters.page || 1) >= pageCount || loading} onClick={() => onFiltersChange?.({ page: (filters.page || 1) + 1 })}>Trang sau</button></div>
      </footer>
    </section>
  );
}
