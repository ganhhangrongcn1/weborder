import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import InventoryLineUnitSelect from "./InventoryLineUnitSelect.jsx";
import { getInventoryUnitToBaseFactor } from "../../../services/inventoryUnitConversion.js";
import {
  buildInventoryCountCreationLines,
  getInventoryCountExpectedDisplay,
  getInventoryCountVariance
} from "../../../services/inventoryCountCalculations.js";
import { filterInventoryItemsByWarehouse } from "../../../services/inventoryMasterDataService.js";

function formatQuantity(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Number(value || 0));
}

export default function InventoryCountModal({ mode = "create", count = null, warehouses = [], items = [], units = [], warehouseSelectionLocked = false, defaultWarehouseId = "", saving = false, onClose, onCreate, onSubmitCount, onApprove }) {
  const initialWarehouseId = warehouses.some((row) => row.id === defaultWarehouseId && row.isActive !== false)
    ? defaultWarehouseId
    : warehouses.find((row) => row.isActive !== false)?.id || "";
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState(() => (count?.lines || []).map((line) => ({
    ...line,
    recordedUnitId: line.unitId,
    recordedConversionToBase: line.conversionToBase
  })));
  const [error, setError] = useState("");
  const itemById = useMemo(() => new Map(items.map((row) => [row.id, row])), [items]);
  const unitById = useMemo(() => new Map(units.map((row) => [row.id, row])), [units]);
  const countableItems = useMemo(
    () => filterInventoryItemsByWarehouse(items, warehouseId).filter((item) => item.isActive !== false),
    [items, warehouseId]
  );
  const isCreate = mode === "create";
  const isCount = mode === "count";
  const isReview = mode === "review";
  const title = isCreate ? "Tạo đợt kiểm kê" : isCount ? "Nhập số đếm thực tế" : isReview ? "Duyệt chênh lệch kiểm kê" : "Chi tiết kiểm kê";

  const updateLine = (id, patch) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  const updateLineUnit = (line, item, unitId) => {
    const unit = unitById.get(unitId);
    updateLine(line.id, {
      unitId,
      conversionToBase: getInventoryUnitToBaseFactor(item, unit),
      countedQuantity: ""
    });
  };
  const submit = async () => {
    setError("");
    try {
      if (isCreate) {
        if (!warehouseId) throw new Error("Vui lòng chọn kho cần kiểm kê.");
        const creationLines = buildInventoryCountCreationLines(countableItems, units);
        if (!creationLines.length) throw new Error("Chưa có nguyên vật liệu đang sử dụng để kiểm kê.");
        await onCreate({ warehouseId, notes, lines: creationLines });
      } else if (isCount) {
        if (lines.some((line) => line.countedQuantity === "" || line.countedQuantity == null || Number(line.countedQuantity) < 0)) throw new Error("Vui lòng nhập số đếm hợp lệ cho tất cả nguyên vật liệu.");
        await onSubmitCount(count.id, lines);
      } else if (isReview) {
        const missingReason = lines.some((line) => Math.abs(getInventoryCountVariance(line) || 0) > 0.000001 && !String(line.varianceReason || "").trim());
        if (missingReason) throw new Error("Dòng có chênh lệch cần ghi rõ lý do trước khi duyệt.");
        await onApprove(count.id, lines);
      }
      onClose();
    } catch (submitError) {
      setError(submitError.message || "Không thể lưu kiểm kê.");
    }
  };

  return (
    <div className="inventory-modal-backdrop" role="presentation">
      <section className="inventory-warehouse-modal inventory-count-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header><span><Icon name="check" size={21} /></span><div><h2>{title}</h2><p>{isCreate ? "Chọn kho, hệ thống sẽ chụp tồn hiện tại để đối chiếu." : `Phiếu ${count?.documentNo || ""}`}</p></div><button type="button" onClick={onClose} aria-label="Đóng">×</button></header>
        <div className="inventory-count-modal__body">
          {isCreate ? <>
            {warehouseSelectionLocked && warehouses.length === 1
              ? <div className="inventory-count-field inventory-warehouse-fixed"><span>Kho kiểm kê</span><strong>{warehouses[0].name}</strong><small>Cố định theo tài khoản chi nhánh</small></div>
              : <label className="inventory-count-field"><span>Kho kiểm kê *</span><InventorySearchableSelect value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}><option value="">Chọn kho</option>{warehouses.filter((row) => row.isActive !== false).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</InventorySearchableSelect></label>}
            <div className="inventory-count-scope"><Icon name="check" size={18} /><div><strong>Kiểm toàn bộ nguyên vật liệu đang sử dụng</strong><span>{countableItems.length} mã hàng thuộc kho đã chọn sẽ được đưa vào phiếu. Tồn được chụp tại lúc bắt đầu.</span></div></div>
            <label className="inventory-count-field"><span>Ghi chú</span><textarea rows="2" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ví dụ: Kiểm kê cuối tháng..." /></label>
          </> : <div className="inventory-table-scroll inventory-count-table-scroll"><table className={`inventory-data-table inventory-count-lines is-${mode}`}><thead><tr><th>Nguyên vật liệu</th><th>Đơn vị</th><th className="is-number">Tồn hệ thống</th><th className="is-number">Thực tế</th>{!isCount ? <th className="is-number">Chênh lệch</th> : null}{isReview ? <th>Lý do chênh lệch</th> : null}</tr></thead><tbody>{lines.map((line) => {
            const item = itemById.get(line.itemId) || {};
            const unit = unitById.get(line.unitId) || {};
            const expected = getInventoryCountExpectedDisplay(line);
            const variance = getInventoryCountVariance(line);
            const hasVariance = variance != null && Math.abs(variance) > 0.000001;
            return <tr key={line.id}><td><strong>{item.name || "NVL không còn hoạt động"}</strong><small>{item.code || line.itemId}</small></td><td>{isCount ? <InventoryLineUnitSelect item={item} units={units} value={line.unitId} onChange={(unitId) => updateLineUnit(line, item, unitId)} ariaLabel={`Đơn vị kiểm kê của ${item.name || "nguyên vật liệu"}`} /> : unit.symbol || unit.name || "ĐVT"}</td><td className="is-number">{formatQuantity(expected)}</td><td className="is-number">{isCount ? <input type="number" min="0" step="any" value={line.countedQuantity ?? ""} onChange={(event) => updateLine(line.id, { countedQuantity: event.target.value })} aria-label={`Số đếm ${item.name || "nguyên vật liệu"}`} /> : line.countedQuantity == null ? <span className="inventory-count-empty-value">Chưa nhập</span> : <strong>{formatQuantity(line.countedQuantity)}</strong>}</td>{!isCount ? <td className={`is-number inventory-count-variance ${hasVariance ? variance > 0 ? "is-positive" : "is-negative" : "is-zero"}`}>{variance == null ? "—" : `${variance > 0 ? "+" : ""}${formatQuantity(variance)}`}</td> : null}{isReview ? <td>{hasVariance ? <input value={line.varianceReason || ""} onChange={(event) => updateLine(line.id, { varianceReason: event.target.value })} placeholder="Nhập lý do..." /> : <span className="inventory-count-match">Khớp tồn</span>}</td> : null}</tr>;
          })}</tbody></table></div>}
          {error ? <div className="inventory-count-error" role="alert"><Icon name="warning" size={16} />{error}</div> : null}
        </div>
        <footer><span><Icon name="info" size={16} />{isReview ? "Duyệt sẽ tạo điều chỉnh tồn theo số thực tế." : isCount ? "Gửi duyệt chưa làm thay đổi tồn kho." : "Dữ liệu được ghi theo quyền tài khoản hiện tại."}</span><button type="button" onClick={onClose} disabled={saving}>{mode === "view" ? "Đóng" : "Hủy"}</button>{mode !== "view" ? <button type="button" className="is-primary" onClick={submit} disabled={saving}>{saving ? "Đang lưu..." : isCreate ? "Bắt đầu kiểm" : isCount ? "Lưu & gửi duyệt" : "Duyệt & hoàn tất"}</button> : null}</footer>
      </section>
    </div>
  );
}
