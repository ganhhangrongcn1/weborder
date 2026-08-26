import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";

function money(value) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0))} đ`;
}

function quantity(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function dateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN", { hour12: false });
}

function getItemUnit(item = {}, unitById = new Map()) {
  const unit = unitById.get(item.baseUnitId || item.base_unit_id) || item.baseUnit || {};
  return unit.symbol || unit.name || "đơn vị gốc";
}

function CostTraceModal({ row, warehouseById, itemById, unitById, onClose }) {
  if (!row) return null;
  const groupedDishes = new Map();
  row.components.forEach((line) => {
    const key = line.sourceLineKey || line.dishName || line.id;
    if (!groupedDishes.has(key)) groupedDishes.set(key, { name: line.dishName || "Món chưa xác định", lines: [] });
    groupedDishes.get(key).lines.push(line);
  });

  return (
    <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="inventory-warehouse-modal inventory-cost-trace-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-cost-trace-title">
        <header>
          <div className="inventory-modal-heading"><span><Icon name="menu" size={20} /></span><div><h2 id="inventory-cost-trace-title">Truy vết giá vốn đơn bán</h2><p>{row.sourceOrderKey}</p></div></div>
          <button type="button" onClick={onClose} aria-label="Đóng"><Icon name="close" size={18} /></button>
        </header>
        <div className="inventory-cost-trace-modal__body">
          <div className="inventory-cost-trace-summary">
            <div><span>Kho trừ</span><strong>{warehouseById.get(row.warehouseId)?.name || "Kho được phân quyền"}</strong></div>
            <div><span>Thời gian</span><strong>{dateTime(row.occurredAt)}</strong></div>
            <div><span>Giá vốn đã ghi</span><strong>{money(row.actualCost)}</strong></div>
            <div><span>Chứng từ</span><strong>{row.documentId ? "Đã ghi kho" : "Chưa có"}</strong></div>
          </div>

          <div className="inventory-cost-trace-flow" aria-label="Đường truy vết">
            <span>Đơn bán</span><b>→</b><span>Món & phiên bản định lượng</span><b>→</b><span>Movement xuất kho</span><b>→</b><span>Lệnh / lô nguồn gần nhất</span>
          </div>

          {[...groupedDishes.entries()].map(([key, dish]) => (
            <section className="inventory-cost-dish" key={key}>
              <header><div><strong>{dish.name}</strong><small>{dish.lines[0]?.recipeCode ? `${dish.lines[0].recipeCode} · Phiên bản ${dish.lines[0].recipeVersion}` : "Định lượng đã lưu phiên bản"}</small></div><span>{money(dish.lines.reduce((sum, line) => sum + line.lineCost, 0))}</span></header>
              <div className="inventory-table-scroll">
                <table className="inventory-data-table">
                  <thead><tr><th>Nguyên liệu / BTP</th><th className="is-number">Số lượng</th><th className="is-number">Đơn giá lúc trừ</th><th className="is-number">Thành tiền</th><th>Nguồn gần nhất</th></tr></thead>
                  <tbody>{dish.lines.map((line) => {
                    const item = itemById.get(line.itemId) || {};
                    const origin = line.origin;
                    return <tr key={line.id}>
                      <td><strong>{item.name || line.itemId}</strong><small>{item.code || ""}</small></td>
                      <td className="is-number"><strong>{quantity(line.requiredQuantity)} {getItemUnit(item, unitById)}</strong></td>
                      <td className="is-number">{money(line.unitCost)}<small>/ {getItemUnit(item, unitById)}</small></td>
                      <td className="is-number"><strong>{money(line.lineCost)}</strong></td>
                      <td>{origin ? <><strong>{origin.orderNo}</strong><small>{origin.bom?.code ? `${origin.bom.code} · v${origin.bom.version || 1}` : "Lệnh sản xuất"}{origin.outputLotNumber ? ` · Lô ${origin.outputLotNumber}` : ""}</small></> : <><strong>Chưa có lệnh nguồn nhìn thấy</strong><small>Có thể là hàng nhập/chuyển kho hoặc dữ liệu ngoài phạm vi tài khoản.</small></>}</td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            </section>
          ))}

          <div className="inventory-cost-method-note"><Icon name="warning" size={16} /><span><strong>Giá vốn dùng bình quân di động.</strong> Lệnh/lô nguồn hiện là đường truy ngược gần nhất, không phải khẳng định phân bổ đích danh theo FIFO.</span></div>
        </div>
        <footer className="inventory-bom-confirm-modal__footer"><span /><button type="button" onClick={onClose}>Đóng</button></footer>
      </section>
    </div>
  );
}

export default function InventoryCostAnalysis({
  salesRows = [],
  productionRows = [],
  warehouses = [],
  items = [],
  units = [],
  filters = {},
  loading = false,
  message = "",
  hasMore = false,
  warehouseSelectionLocked = false,
  onFiltersChange
}) {
  const [tab, setTab] = useState("sales");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState(null);
  const warehouseById = useMemo(() => new Map(warehouses.map((row) => [row.id, row])), [warehouses]);
  const itemById = useMemo(() => new Map(items.map((row) => [row.id, row])), [items]);
  const unitById = useMemo(() => new Map(units.map((row) => [row.id, row])), [units]);
  const query = search.trim().toLocaleLowerCase("vi");
  const visibleSalesRows = salesRows.filter((row) => {
    if (warehouseFilter && row.warehouseId !== warehouseFilter) return false;
    return !query || [row.sourceOrderKey, ...row.dishNames, ...row.recipeVersions].some((value) => String(value || "").toLocaleLowerCase("vi").includes(query));
  });
  const visibleProductionRows = productionRows.filter((row) => {
    if (warehouseFilter && row.warehouseId !== warehouseFilter) return false;
    const item = itemById.get(row.outputItemId) || {};
    return !query || `${row.orderNo} ${item.code || ""} ${item.name || ""} ${row.bom?.code || ""}`.toLocaleLowerCase("vi").includes(query);
  });
  const displaySummary = {
    salesCost: visibleSalesRows.reduce((sum, row) => sum + Number(row.actualCost || 0), 0),
    salesOrderCount: visibleSalesRows.length,
    traceCompleteCount: visibleSalesRows.filter((row) => row.traceComplete).length,
    productionOrderCount: visibleProductionRows.length,
    productionVariance: visibleProductionRows.reduce((sum, row) => sum + Number(row.variance || 0), 0)
  };
  const updateDate = (key, value) => {
    const next = { ...filters, [key]: value };
    if (key === "dateFrom" && value && next.dateTo && value > next.dateTo) next.dateTo = value;
    if (key === "dateTo" && value && next.dateFrom && value < next.dateFrom) next.dateFrom = value;
    onFiltersChange?.(next);
  };

  return (
    <section className="inventory-list-card inventory-cost-analysis">
      <header className="inventory-cost-analysis__head">
        <span><Icon name="wallet" size={20} /></span>
        <div><strong>Giá vốn và đối chiếu</strong><small>Đối chiếu giá vốn món bán với sai lệch thực tế của lệnh sản xuất.</small></div>
        <div className="inventory-cost-method"><span>Phương pháp giá vốn</span><strong>Bình quân di động</strong></div>
      </header>

      <div className="inventory-cost-policy"><Icon name="check" size={16} /><span>Mỗi mã hàng dùng một phương pháp duy nhất. Lô/HSD phục vụ truy vết vật lý; giá trị xuất kho lấy theo giá vốn bình quân tại thời điểm ghi movement.</span></div>
      {message ? <div className="inventory-count-notice is-error"><Icon name="warning" size={16} />{message}</div> : null}

      <div className="inventory-summary-grid inventory-cost-summary">
        <div><span>Giá vốn đơn bán</span><strong>{money(displaySummary.salesCost)}</strong><small>{displaySummary.salesOrderCount} đơn trong bộ lọc</small></div>
        <div><span>Truy vết đủ movement</span><strong>{displaySummary.traceCompleteCount}/{displaySummary.salesOrderCount}</strong><small>Đơn → định lượng → movement</small></div>
        <div><span>Lệnh hoàn thành</span><strong>{displaySummary.productionOrderCount}</strong><small>Trong bộ lọc đang xem</small></div>
        <div className={displaySummary.productionVariance > 0 ? "is-warning" : ""}><span>Lệch cost sản xuất</span><strong>{money(displaySummary.productionVariance)}</strong><small>Thực tế trừ định mức</small></div>
      </div>

      <div className="inventory-cost-tabs" role="tablist">
        <button type="button" className={tab === "sales" ? "is-active" : ""} onClick={() => setTab("sales")}><Icon name="bag" size={15} /> Giá vốn món bán <span>{salesRows.length}</span></button>
        <button type="button" className={tab === "production" ? "is-active" : ""} onClick={() => setTab("production")}><Icon name="gear" size={15} /> Sai lệch sản xuất <span>{productionRows.length}</span></button>
      </div>

      <div className="inventory-cost-filters">
        <label className="inventory-search-field"><Icon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "sales" ? "Tìm mã đơn, món hoặc phiên bản..." : "Tìm mã lệnh, BTP hoặc BOM..."} /></label>
        <label><span>Từ ngày</span><input type="date" value={filters.dateFrom || ""} max={filters.dateTo || undefined} onChange={(event) => updateDate("dateFrom", event.target.value)} /></label>
        <label><span>Đến ngày</span><input type="date" value={filters.dateTo || ""} min={filters.dateFrom || undefined} onChange={(event) => updateDate("dateTo", event.target.value)} /></label>
        {warehouseSelectionLocked && warehouses.length === 1 ? <div className="inventory-warehouse-fixed"><span>Kho đang xem</span><strong>{warehouses[0].name}</strong></div> : <select aria-label="Lọc kho" value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)}><option value="">Tất cả kho được phép xem</option>{warehouses.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>}
      </div>

      {hasMore ? <div className="inventory-reconciliation-limit"><Icon name="warning" size={15} />Dữ liệu đã chạm giới hạn an toàn. Thu hẹp khoảng ngày để xem đầy đủ.</div> : null}

      <div className="inventory-table-scroll">
        {tab === "sales" ? <table className="inventory-data-table inventory-cost-table">
          <thead><tr><th>Đơn bán</th><th>Món / định lượng</th><th>Kho trừ</th><th className="is-number">Giá vốn đã ghi</th><th>Truy vết</th><th>Thao tác</th></tr></thead>
          <tbody>{visibleSalesRows.map((row) => <tr key={row.id}>
            <td><strong>{row.sourceOrderKey}</strong><small>{dateTime(row.occurredAt)}</small></td>
            <td><strong>{row.dishNames.join(", ") || "Món đã ghi kho"}</strong><small>{row.recipeVersions.join(", ") || "Phiên bản định lượng đã lưu"}</small></td>
            <td><strong>{warehouseById.get(row.warehouseId)?.name || "Kho được phân quyền"}</strong></td>
            <td className="is-number"><strong>{money(row.actualCost)}</strong></td>
            <td><span className={`inventory-bom-status is-${row.traceComplete ? "active" : "warning"}`}>{row.traceComplete ? "Đủ movement" : "Cần kiểm tra"}</span></td>
            <td><button type="button" className="inventory-cost-view" onClick={() => setSelectedRow(row)}><Icon name="eye" size={14} /> Xem đường đi</button></td>
          </tr>)}</tbody>
        </table> : <table className="inventory-data-table inventory-cost-table">
          <thead><tr><th>Lệnh sản xuất</th><th>Đầu ra</th><th>Kho làm</th><th className="is-number">Định mức</th><th className="is-number">Thực tế</th><th className="is-number">Chênh lệch</th></tr></thead>
          <tbody>{visibleProductionRows.map((row) => {
            const item = itemById.get(row.outputItemId) || {};
            const isOver = row.variance > 0;
            return <tr key={row.id}>
              <td><strong>{row.orderNo}</strong><small>{row.bom?.code || "BOM"} · v{row.bom?.version || 1}</small></td>
              <td><strong>{item.name || row.outputItemId}</strong><small>{quantity(row.actualOutputQuantity)} đầu ra{row.outputLotNumber ? ` · Lô ${row.outputLotNumber}` : ""}</small></td>
              <td><strong>{warehouseById.get(row.warehouseId)?.name || "Kho được phân quyền"}</strong><small>{dateTime(row.completedAt)}</small></td>
              <td className="is-number">{money(row.estimatedCost)}</td>
              <td className="is-number"><strong>{money(row.actualCost)}</strong></td>
              <td className="is-number"><strong className={isOver ? "inventory-cost-over" : "inventory-cost-ok"}>{row.variance > 0 ? "+" : ""}{money(row.variance)}</strong><small>{row.varianceRate ? `${row.varianceRate.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%` : "Khớp định mức"}</small></td>
            </tr>;
          })}</tbody>
        </table>}
        {loading ? <div className="inventory-list-empty"><Icon name="refresh" size={24} /><strong>Đang tải giá vốn…</strong></div> : null}
        {!loading && !(tab === "sales" ? visibleSalesRows : visibleProductionRows).length ? <div className="inventory-list-empty"><Icon name="eye" size={24} /><strong>Chưa có dữ liệu phù hợp</strong><span>Đổi khoảng ngày, kho hoặc từ khóa để xem lại.</span></div> : null}
      </div>

      <CostTraceModal row={selectedRow} warehouseById={warehouseById} itemById={itemById} unitById={unitById} onClose={() => setSelectedRow(null)} />
    </section>
  );
}
