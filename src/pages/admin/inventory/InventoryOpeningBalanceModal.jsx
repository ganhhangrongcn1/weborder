import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import {
  getInventoryItemInputUnitConfig,
  getInventoryUnitToBaseFactor
} from "../../../services/inventoryUnitConversion.js";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import InventoryLineUnitSelect from "./InventoryLineUnitSelect.jsx";

function createLine() {
  return {
    key: `${Date.now()}-${Math.random()}`,
    itemId: "",
    unitId: "",
    conversionToBase: 1,
    quantity: "",
    unitPrice: ""
  };
}

function toLocalDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatMoney(value) {
  return `${Math.round(Number(value || 0)).toLocaleString("vi-VN")} đ`;
}

export default function InventoryOpeningBalanceModal({
  mode = "create",
  warehouse,
  document = null,
  items = [],
  units = [],
  saving = false,
  onClose,
  onSave
}) {
  const isView = mode === "view";
  const [occurredAt, setOccurredAt] = useState(toLocalDateTimeValue());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([createLine()]);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const activeItems = items.filter((item) => item.isActive !== false);
  const unitsById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const viewLines = document?.lines || [];
  const totalAmount = isView
    ? Number(document?.totalAmount || 0)
    : lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);

  const updateLine = (key, field, value) => {
    setLines((current) => current.map((line) => {
      if (line.key !== key) return line;
      if (field === "unitId") {
        const item = activeItems.find((row) => row.id === line.itemId);
        const unit = unitsById.get(value);
        return { ...line, unitId: value, conversionToBase: getInventoryUnitToBaseFactor(item, unit) };
      }
      if (field !== "itemId") return { ...line, [field]: value };
      const item = activeItems.find((row) => row.id === value);
      const displayUnit = getInventoryItemInputUnitConfig(item, unitsById, "purchase");
      return {
        ...line,
        itemId: value,
        unitId: displayUnit.unitId,
        conversionToBase: displayUnit.conversionToBase,
        quantity: "",
        unitPrice: ""
      };
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isView) return;
    setError("");
    if (!confirmed) {
      setError("Vui lòng xác nhận đã kiểm tra số lượng và giá vốn trước khi ghi nhận.");
      return;
    }
    try {
      await onSave({
        warehouseId: warehouse.id,
        occurredAt: new Date(occurredAt).toISOString(),
        notes,
        lines
      });
      onClose();
    } catch (nextError) {
      setError(nextError.message || "Không thể ghi nhận tồn đầu kỳ.");
    }
  };

  return (
    <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="inventory-warehouse-modal inventory-opening-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-opening-title">
        <header>
          <div className="inventory-modal-heading">
            <span><Icon name={isView ? "eye" : "download"} size={20} /></span>
            <div>
              <h2 id="inventory-opening-title">{isView ? "Chi tiết tồn đầu kỳ" : "Nhập tồn đầu kỳ"}</h2>
              <p>{warehouse?.name || "Kho"}{isView && document?.documentNo ? ` · ${document.documentNo}` : ""}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng"><Icon name="close" size={18} /></button>
        </header>

        {isView ? (
          <div className="inventory-opening-modal__body">
            <div className="inventory-opening-meta">
              <div><span>Trạng thái</span><strong className="is-success">Đã ghi nhận</strong></div>
              <div><span>Thời gian</span><strong>{formatDateTime(document?.completedAt || document?.occurredAt)}</strong></div>
              <div><span>Số mã hàng</span><strong>{viewLines.length}</strong></div>
              <div><span>Tổng giá trị</span><strong>{formatMoney(totalAmount)}</strong></div>
            </div>
            <div className="inventory-count-table-scroll">
              <table className="inventory-data-table inventory-opening-lines is-view">
                <thead><tr><th>Nguyên vật liệu</th><th>Đơn vị</th><th>Số lượng đầu kỳ</th><th>Giá vốn / đơn vị</th><th>Thành tiền</th></tr></thead>
                <tbody>{viewLines.map((line) => {
                  const item = itemsById.get(line.itemId);
                  const unit = unitsById.get(line.unitId);
                  return <tr key={line.id}><td><strong>{item?.name || "Nguyên vật liệu không còn hoạt động"}</strong><small>{item?.code || "—"}</small></td><td>{unit?.name || item?.baseUnit?.name || "—"}</td><td>{line.quantity.toLocaleString("vi-VN")}</td><td>{formatMoney(line.unitPrice)}</td><td><strong>{formatMoney(line.quantity * line.unitPrice)}</strong></td></tr>;
                })}</tbody>
              </table>
            </div>
            {document?.notes ? <div className="inventory-opening-note"><Icon name="edit" size={16} /><span>{document.notes}</span></div> : null}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="inventory-opening-warning"><Icon name="warning" size={18} /><div><strong>Mỗi kho chỉ nhập tồn đầu kỳ một lần</strong><span>Sau khi ghi nhận, hãy dùng Phiếu nhập kho hoặc Điều chỉnh tồn cho các thay đổi tiếp theo.</span></div></div>
            <div className="inventory-form-row inventory-form-row--paired">
              <div className="inventory-form-field"><span className="inventory-field-label"><Icon name="store" size={15} />Kho áp dụng</span><div className="inventory-warehouse-fixed"><strong>{warehouse?.name}</strong><small>{warehouse?.code || "Kho đang hoạt động"}</small></div></div>
              <label className="inventory-form-field"><span className="inventory-field-label"><Icon name="clock" size={15} />Ngày ghi nhận <b>*</b></span><span className="inventory-control-shell"><input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required /></span></label>
            </div>
            <section className="inventory-opening-lines-wrap">
              <div className="inventory-opening-lines-head"><div><strong>Nguyên vật liệu tồn đầu</strong><small>Đơn giá là giá vốn của đúng đơn vị đang hiển thị.</small></div><button type="button" onClick={() => setLines((current) => [...current, createLine()])}><Icon name="plus" size={15} />Thêm dòng</button></div>
              <div className="inventory-opening-lines-labels"><span>Nguyên vật liệu</span><span>Đơn vị</span><span>Số lượng</span><span>Giá vốn / đơn vị</span><span>Thành tiền</span><span /></div>
              <div className="inventory-opening-lines-scroll">
                {lines.map((line) => {
                  const item = itemsById.get(line.itemId);
                  const selectedIds = new Set(lines.filter((row) => row.key !== line.key).map((row) => row.itemId).filter(Boolean));
                  return (
                    <div className="inventory-opening-line" key={line.key}>
                      <InventorySearchableSelect value={line.itemId} onChange={(event) => updateLine(line.key, "itemId", event.target.value)} required searchPlaceholder="Tìm mã hoặc tên nguyên vật liệu...">
                        <option value="">Chọn nguyên vật liệu</option>
                        {activeItems.map((row) => <option key={row.id} value={row.id} disabled={selectedIds.has(row.id)}>{row.code ? `${row.code} · ` : ""}{row.name}</option>)}
                      </InventorySearchableSelect>
                      <InventoryLineUnitSelect item={item} units={units} value={line.unitId} onChange={(unitId) => updateLine(line.key, "unitId", unitId)} ariaLabel={`Đơn vị tồn đầu của ${item?.name || "nguyên vật liệu"}`} />
                      <input aria-label="Số lượng đầu kỳ" type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateLine(line.key, "quantity", event.target.value)} required />
                      <input aria-label="Giá vốn trên đơn vị" type="number" min="0" step="1" value={line.unitPrice} onChange={(event) => updateLine(line.key, "unitPrice", event.target.value)} required />
                      <strong>{formatMoney(Number(line.quantity || 0) * Number(line.unitPrice || 0))}</strong>
                      <button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))} aria-label="Xóa dòng"><Icon name="trash" size={16} /></button>
                    </div>
                  );
                })}
              </div>
            </section>
            <label className="inventory-form-field"><span className="inventory-field-label"><Icon name="edit" size={15} />Ghi chú</span><span className="inventory-control-shell"><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ví dụ: Tồn thực tế khi bắt đầu sử dụng phần mềm" /></span></label>
            <div className="inventory-opening-total"><span>Tổng giá trị tồn đầu kỳ</span><strong>{formatMoney(totalAmount)}</strong></div>
            <label className="inventory-opening-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>Tôi đã kiểm tra đúng kho, số lượng và giá vốn. Tôi hiểu phiếu này không thể nhập lại.</span></label>
            {error ? <p className="inventory-form-error" role="alert">{error}</p> : null}
            <footer><span><Icon name="info" size={16} />Hệ thống chỉ cập nhật tồn khi toàn bộ phiếu ghi nhận thành công.</span><button type="button" onClick={onClose}>Hủy</button><button type="submit" disabled={saving || !confirmed}><Icon name="check" size={16} />{saving ? "Đang ghi nhận…" : "Ghi nhận tồn đầu kỳ"}</button></footer>
          </form>
        )}
        {isView ? <footer><span><Icon name="check" size={16} />Phiếu đã khóa để bảo toàn lịch sử kho.</span><button type="button" onClick={onClose}>Đóng</button></footer> : null}
      </section>
    </div>
  );
}
