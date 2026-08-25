import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { getInventoryItemDisplayUnitConfig } from "../../../services/inventoryUnitConversion.js";
import InventoryReceiptLineFields from "./InventoryReceiptLineFields.jsx";
import { getReceiptLineItemDefaults, getSuggestedExpiryDate } from "./inventoryReceiptForm.js";

const DOMAIN_CONFIG = {
  receipts: {
    title: "Tạo phiếu nhập kho",
    icon: "download",
    warehouseLabel: "Kho nhận",
    submitLabel: "Lưu phiếu nháp"
  },
  issues: {
    title: "Tạo phiếu xuất kho",
    icon: "share",
    warehouseLabel: "Kho xuất",
    submitLabel: "Lưu phiếu nháp"
  },
  transfers: {
    title: "Tạo phiếu chuyển kho nội bộ",
    icon: "refresh",
    submitLabel: "Lưu phiếu nháp"
  },
  disposals: {
    title: "Tạo phiếu hủy nguyên vật liệu",
    icon: "trash",
    warehouseLabel: "Kho hủy hàng",
    submitLabel: "Lưu phiếu hủy nháp"
  },
  requisitions: {
    title: "Tạo yêu cầu cho chi nhánh",
    icon: "bell",
    warehouseLabel: "Kho chi nhánh/bộ phận cần hàng",
    submitLabel: "Lưu yêu cầu nháp"
  },
  adjustments: {
    title: "Tạo phiếu điều chỉnh tồn",
    icon: "edit",
    warehouseLabel: "Kho điều chỉnh",
    submitLabel: "Lưu phiếu nháp"
  }
};

function createLine() {
  return {
    key: `${Date.now()}-${Math.random()}`,
    itemId: "",
    unitId: "",
    conversionToBase: 1,
    quantity: 1,
    unitPrice: 0,
    lotNumber: "",
    manufacturedOn: "",
    expiresOn: "",
    trackExpiry: false,
    expiryManuallyEdited: false,
    disposalReason: "",
    adjustmentDirection: "",
    notes: ""
  };
}

const DISPOSAL_REASONS = ["Hư hỏng", "Hết hạn", "Lãng phí", "Mất mát", "Hao hụt"];

function toLocalDateTimeValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function InventoryDocumentModal({
  domain,
  warehouses = [],
  items = [],
  units = [],
  suppliers = [],
  requestCreationMode = "warehouse_self",
  onClose,
  onSave
}) {
  const config = DOMAIN_CONFIG[domain] || DOMAIN_CONFIG.receipts;
  const [form, setForm] = useState({
    sourceWarehouseId: "",
    destinationWarehouseId: "",
    supplierId: "",
    occurredAt: toLocalDateTimeValue(),
    issueReason: "",
    disposalReason: "",
    adjustmentReason: "",
    notes: ""
  });
  const [lines, setLines] = useState([createLine()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const activeWarehouses = warehouses.filter((row) => row.isActive !== false && !row.isDraft);
  const requestWarehouses = domain === "requisitions"
    ? activeWarehouses.filter((row) => ["branch", "department"].includes(row.warehouseType))
    : activeWarehouses;
  const activeItems = items.filter((row) => row.isActive !== false);
  const activeSuppliers = suppliers.filter((row) => row.isActive !== false);
  const unitsById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const totalAmount = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0),
    [lines]
  );

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (domain !== "receipts" || key !== "occurredAt") return;
    setLines((current) => current.map((line) => {
      if (!line.itemId || line.manufacturedOn || line.expiryManuallyEdited) return line;
      const item = activeItems.find((row) => row.id === line.itemId);
      return { ...line, expiresOn: getSuggestedExpiryDate(item, value) };
    }));
  };
  const updateLine = (key, field, value) => {
    setLines((current) => current.map((line) => {
      if (line.key !== key) return line;
      if (field === "expiresOn") return { ...line, expiresOn: value, expiryManuallyEdited: true };
      if (field === "manufacturedOn") {
        const item = activeItems.find((row) => row.id === line.itemId);
        return {
          ...line,
          manufacturedOn: value,
          expiresOn: line.expiryManuallyEdited
            ? line.expiresOn
            : getSuggestedExpiryDate(item, value ? `${value}T00:00` : form.occurredAt)
        };
      }
      if (field !== "itemId") return { ...line, [field]: value };
      const item = activeItems.find((row) => row.id === value);
      const displayUnit = getInventoryItemDisplayUnitConfig(item, unitsById);
      return {
        ...line,
        itemId: value,
        unitId: displayUnit.unitId,
        conversionToBase: displayUnit.conversionToBase,
        ...(domain === "receipts" ? getReceiptLineItemDefaults(item, form.occurredAt) : {})
      };
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave({
        ...form,
        requestOrigin: domain === "requisitions" ? requestCreationMode : "",
        occurredAt: new Date(form.occurredAt).toISOString(),
        lines
      });
      onClose();
    } catch (nextError) {
      setError(nextError.message || "Không thể lưu phiếu.");
    } finally {
      setSaving(false);
    }
  };

  const renderWarehouseField = (field, label, excludedId = "") => (
    <label className="inventory-form-field">
      <span className="inventory-field-label"><Icon name="store" size={15} />{label} <b>*</b></span>
      <span className="inventory-control-shell inventory-control-shell--select">
        <select value={form[field]} onChange={(event) => updateForm(field, event.target.value)} required>
          <option value="">Chọn kho</option>
          {(field === "destinationWarehouseId" ? requestWarehouses : activeWarehouses).filter((row) => row.id !== excludedId).map((row) => (
            <option key={row.id} value={row.id}>{row.name}</option>
          ))}
        </select>
      </span>
    </label>
  );

  return (
    <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="inventory-warehouse-modal inventory-document-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-document-title">
        <header>
          <div className="inventory-modal-heading">
            <span><Icon name={config.icon} size={20} /></span>
            <div>
              <h2 id="inventory-document-title">{config.title}</h2>
              <p>Form gọn để nhân viên nhập nhanh; bản nháp chưa làm thay đổi tồn kho.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng"><Icon name="close" size={18} /></button>
        </header>

        {domain === "requisitions" && requestCreationMode === "admin_on_behalf" ? (
          <div className="inventory-requisition-on-behalf">
            <Icon name="user" size={17} />
            <div><strong>Admin đang tạo thay chi nhánh</strong><span>Phiếu sẽ thuộc kho nhận được chọn bên dưới. Người tạo và người duyệt vẫn được lưu riêng trong lịch sử.</span></div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <section className="inventory-document-section">
            <div className="inventory-document-section__head">
              <span><Icon name="store" size={18} /></span>
              <div><strong>Thông tin phiếu</strong><small>Chọn kho và thời điểm phát sinh.</small></div>
            </div>
            <div className="inventory-form-row inventory-form-row--paired">
              {domain === "transfers"
                ? <>
                    {renderWarehouseField("sourceWarehouseId", "Kho xuất", form.destinationWarehouseId)}
                    {renderWarehouseField("destinationWarehouseId", "Kho nhận", form.sourceWarehouseId)}
                  </>
                : ["issues", "disposals", "adjustments"].includes(domain)
                  ? renderWarehouseField("sourceWarehouseId", config.warehouseLabel)
                  : renderWarehouseField("destinationWarehouseId", config.warehouseLabel)}
              <label className="inventory-form-field">
                <span className="inventory-field-label"><Icon name="clock" size={15} />{domain === "disposals" ? "Ngày hủy" : "Ngày lập phiếu"} <b>*</b></span>
                <span className="inventory-control-shell"><input type="datetime-local" value={form.occurredAt} onChange={(event) => updateForm("occurredAt", event.target.value)} required /></span>
              </label>
              {domain === "receipts" ? (
                <label className="inventory-form-field">
                  <span className="inventory-field-label"><Icon name="user" size={15} />Nhà cung cấp <b>*</b></span>
                  <span className="inventory-control-shell inventory-control-shell--select">
                    <select value={form.supplierId} onChange={(event) => updateForm("supplierId", event.target.value)} required>
                      <option value="">Chọn nhà cung cấp</option>
                      {activeSuppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                    </select>
                  </span>
                </label>
              ) : null}
              {domain === "issues" ? (
                <label className="inventory-form-field full-field">
                  <span className="inventory-field-label"><Icon name="warning" size={15} />Lý do xuất kho <b>*</b></span>
                  <span className="inventory-control-shell"><input value={form.issueReason} onChange={(event) => updateForm("issueReason", event.target.value)} placeholder="Ví dụ: dùng nội bộ, hủy hàng, hao hụt…" required /></span>
                </label>
              ) : null}
              {domain === "disposals" ? (
                <label className="inventory-form-field full-field">
                  <span className="inventory-field-label"><Icon name="warning" size={15} />Lý do hủy chung <b>*</b></span>
                  <span className="inventory-control-shell inventory-control-shell--select">
                    <select value={form.disposalReason} onChange={(event) => updateForm("disposalReason", event.target.value)} required>
                      <option value="">Chọn lý do</option>
                      {DISPOSAL_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                    </select>
                  </span>
                  <small className="inventory-form-hint">Áp dụng mặc định cho mọi món; chỉ đổi ở từng dòng khi món đó có lý do khác.</small>
                </label>
              ) : null}
              {domain === "adjustments" ? (
                <label className="inventory-form-field full-field">
                  <span className="inventory-field-label"><Icon name="warning" size={15} />Lý do điều chỉnh <b>*</b></span>
                  <span className="inventory-control-shell"><input value={form.adjustmentReason} onChange={(event) => updateForm("adjustmentReason", event.target.value)} placeholder="Ví dụ: sửa sai số liệu đầu kỳ, bù lệch đã xác minh…" required /></span>
                  <small className="inventory-form-hint">Lý do được lưu trong sổ kho để tra cứu về sau.</small>
                </label>
              ) : null}
            </div>
          </section>

          <section className="inventory-document-section">
            <div className="inventory-document-section__head inventory-document-section__head--actions">
              <span><Icon name="bag" size={18} /></span>
              <div><strong>{domain === "disposals" ? "Nguyên vật liệu hủy" : "Nguyên vật liệu"}</strong><small>Mỗi nguyên vật liệu chỉ thêm một dòng.</small></div>
              <button type="button" onClick={() => setLines((current) => [...current, createLine()])}><Icon name="plus" size={15} />Thêm dòng</button>
            </div>
            <div className="inventory-document-lines">
              <div className={`inventory-document-lines__header ${domain === "receipts" ? "is-receipt" : domain === "disposals" ? "has-disposal-reason" : domain === "adjustments" ? "has-adjustment-direction" : ""}`}>
                {domain === "receipts" ? (
                  <><span>Nguyên vật liệu</span><span>Đơn vị</span><span>Số lượng</span><span>Đơn giá</span><span>Hạn sử dụng</span><span /><span /></>
                ) : (
                  <><span>Nguyên vật liệu</span><span>Đơn vị</span>{domain === "adjustments" ? <span>Điều chỉnh</span> : null}<span>Số lượng</span>{domain === "disposals" ? <span>Lý do hủy</span> : null}<span /></>
                )}
              </div>
              {lines.map((line) => {
                const item = activeItems.find((row) => row.id === line.itemId);
                const selectedUnit = units.find((row) => row.id === line.unitId);
                const unitName = selectedUnit?.name || item?.purchaseUnit?.name || item?.baseUnit?.name || "—";
                if (domain === "receipts") {
                  return (
                    <InventoryReceiptLineFields
                      key={line.key}
                      line={line}
                      item={item}
                      unit={unitsById.get(line.unitId)}
                      items={activeItems}
                      canDelete={lines.length > 1}
                      occurredDate={form.occurredAt.slice(0, 10)}
                      onUpdate={(field, value) => updateLine(line.key, field, value)}
                      onDelete={() => setLines((current) => current.filter((row) => row.key !== line.key))}
                    />
                  );
                }
                return (
                  <div key={line.key} className={`inventory-document-line ${domain === "disposals" ? "has-disposal-reason" : domain === "adjustments" ? "has-adjustment-direction" : ""}`}>
                    <select value={line.itemId} onChange={(event) => updateLine(line.key, "itemId", event.target.value)} required>
                      <option value="">Chọn nguyên vật liệu</option>
                      {activeItems.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                    </select>
                    <div className="inventory-document-unit"><strong>{unitName}</strong>{item && line.conversionToBase !== 1 ? <small>1 {unitName} = {line.conversionToBase} {item.baseUnit?.name}</small> : <small>Đơn vị lưu kho</small>}</div>
                    {domain === "adjustments" ? (
                      <select value={line.adjustmentDirection} onChange={(event) => updateLine(line.key, "adjustmentDirection", event.target.value)} required aria-label={`Chiều điều chỉnh của ${item?.name || "nguyên vật liệu"}`}>
                        <option value="">Chọn tăng/giảm</option>
                        <option value="in">+ Tăng tồn</option>
                        <option value="out">− Giảm tồn</option>
                      </select>
                    ) : null}
                    <input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateLine(line.key, "quantity", event.target.value)} required />
                    {domain === "disposals" ? (
                      <select value={line.disposalReason} onChange={(event) => updateLine(line.key, "disposalReason", event.target.value)} aria-label={`Lý do hủy của ${item?.name || "nguyên vật liệu"}`}>
                        <option value="">Theo lý do chung{form.disposalReason ? `: ${form.disposalReason}` : ""}</option>
                        {DISPOSAL_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                      </select>
                    ) : null}
                    <button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))} aria-label="Xóa dòng"><Icon name="trash" size={16} /></button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="inventory-document-bottom">
            <label className="inventory-form-field">
              <span className="inventory-field-label"><Icon name="edit" size={15} />Ghi chú</span>
              <span className="inventory-control-shell"><input value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Ghi chú ngắn cho người xử lý phiếu" /></span>
            </label>
            {domain === "receipts" ? <div className="inventory-document-total"><span>Tổng tiền tham khảo</span><strong>{totalAmount.toLocaleString("vi-VN")} đ</strong></div> : null}
          </section>

          {error ? <p className="inventory-form-error" role="alert">{error}</p> : null}
          <footer>
            <span><Icon name="info" size={16} />{domain === "adjustments" ? "Lưu nháp và gửi duyệt chưa đổi tồn; chỉ Duyệt & ghi sổ mới cập nhật kho." : domain === "disposals" ? "Lưu nháp chưa trừ tồn; chỉ hoàn tất phiếu mới trừ kho." : "Lưu nháp chưa cộng hoặc trừ tồn."}</span>
            <button type="button" onClick={onClose}>Hủy</button>
            <button type="submit" disabled={saving}><Icon name="check" size={16} />{saving ? "Đang lưu…" : config.submitLabel}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
