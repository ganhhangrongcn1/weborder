import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { calculateBomComponentRequirement } from "../../../services/inventoryBomCalculations.js";
import {
  getInventoryCompatibleUnits,
  getInventoryItemDisplayUnitConfig
} from "../../../services/inventoryUnitConversion.js";

const SCOPE_OPTIONS = [
  { value: "central", label: "Sản xuất / đóng gói tại Kho Tổng", warehouseType: "central" },
  { value: "branch", label: "Sơ chế tại Kho chi nhánh", warehouseType: "branch" },
  { value: "department", label: "Sơ chế tại Kho bộ phận", warehouseType: "department" }
];

function createLine() {
  return { componentItemId: "", quantity: 1, unitId: "", wastePercent: 0, notes: "" };
}

function createInitialForm(bom = {}, unitsById = new Map()) {
  const outputItem = bom.outputItem || {};
  const outputUnit = getInventoryItemDisplayUnitConfig(outputItem, unitsById);
  return {
    id: bom.id || "",
    outputItemId: bom.outputItemId || "",
    yieldQuantity: bom.yieldQuantity || 1,
    yieldUnitId: bom.yieldUnitId || outputUnit.unitId || "",
    productionScope: bom.productionScope || "central",
    defaultWarehouseId: bom.defaultWarehouseId || "",
    effectiveFrom: bom.effectiveFrom || new Date().toISOString().slice(0, 10),
    notes: bom.notes || "",
    components: bom.components?.length
      ? bom.components.map((component) => ({
          componentItemId: component.componentItemId,
          quantity: component.quantity,
          unitId: component.unitId,
          wastePercent: component.wastePercent,
          notes: component.notes || ""
        }))
      : [createLine()]
  };
}

export default function InventoryBomModal({
  bom = {},
  items = [],
  units = [],
  warehouses = [],
  readOnly = false,
  isSaving = false,
  onClose,
  onSave
}) {
  const unitsById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const [form, setForm] = useState(() => createInitialForm(bom, unitsById));
  const [error, setError] = useState("");
  const outputItems = items.filter((item) => item.itemType === "semi_finished" && item.isActive !== false);
  const outputItem = itemsById.get(form.outputItemId) || {};
  const outputUnits = getInventoryCompatibleUnits(outputItem, units);
  const scopeOptions = warehouses.some((warehouse) => warehouse.warehouseType !== "central")
    ? SCOPE_OPTIONS
    : SCOPE_OPTIONS.filter((option) => option.value === "central");
  const selectedScope = SCOPE_OPTIONS.find((option) => option.value === form.productionScope) || SCOPE_OPTIONS[0];
  const availableWarehouses = warehouses.filter((warehouse) => warehouse.isActive !== false && warehouse.warehouseType === selectedScope.warehouseType);
  const isSharedBranchRecipe = form.productionScope === "branch";
  const availableComponentItems = items.filter((item) => item.isActive !== false && item.id !== form.outputItemId);
  const semiFinishedComponents = availableComponentItems.filter((item) => item.itemType === "semi_finished");
  const materialComponents = availableComponentItems.filter((item) => item.itemType !== "semi_finished");
  const hasOutputItem = Boolean(form.outputItemId && outputItem.id);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateLine = (index, field, value) => {
    setForm((current) => ({
      ...current,
      components: current.components.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line)
    }));
  };

  const selectOutputItem = (itemId) => {
    const item = itemsById.get(itemId) || {};
    const config = getInventoryItemDisplayUnitConfig(item, unitsById);
    setForm((current) => ({
      ...current,
      outputItemId: itemId,
      yieldUnitId: config.unitId || "",
      components: current.components.map((line) => line.componentItemId === itemId ? createLine() : line)
    }));
  };

  const selectProductionScope = (productionScope) => {
    const nextScope = SCOPE_OPTIONS.find((option) => option.value === productionScope) || SCOPE_OPTIONS[0];
    setForm((current) => {
      const currentWarehouse = warehouses.find((warehouse) => warehouse.id === current.defaultWarehouseId);
      return {
        ...current,
        productionScope: nextScope.value,
        defaultWarehouseId: nextScope.value === "branch"
          ? ""
          : currentWarehouse?.warehouseType === nextScope.warehouseType ? current.defaultWarehouseId : ""
      };
    });
  };

  const selectComponentItem = (index, itemId) => {
    const item = itemsById.get(itemId) || {};
    const config = getInventoryItemDisplayUnitConfig(item, unitsById);
    setForm((current) => ({
      ...current,
      components: current.components.map((line, lineIndex) => lineIndex === index
        ? { ...line, componentItemId: itemId, unitId: config.unitId || "", wastePercent: item.defaultWastePercent || 0 }
        : line)
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (saveError) {
      setError(saveError?.message || "Không thể lưu công thức chế biến.");
    }
  };

  return (
    <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="inventory-warehouse-modal inventory-bom-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-bom-title">
        <header>
          <div className="inventory-bom-modal__title">
            <span><Icon name="menu" size={20} /></span>
            <div>
              <h2 id="inventory-bom-title">{readOnly ? "Chi tiết công thức chế biến" : form.id ? "Sửa công thức bản nháp" : "Tạo công thức chế biến"}</h2>
              <p>Định lượng để tạo bán thành phẩm.</p>
            </div>
          </div>
          <button type="button" className="inventory-modal-close" onClick={onClose} aria-label="Đóng"><Icon name="close" size={18} /></button>
        </header>

        <form onSubmit={submit}>
          <div className="inventory-bom-safe-note">
            <Icon name="check" size={17} />
            <span>Chỉ lưu định lượng, chưa làm thay đổi tồn kho.</span>
          </div>

          <section className="inventory-bom-form-section">
            <div className="inventory-bom-form-section__head"><Icon name="bag" size={17} /><strong>Đầu ra</strong></div>
            <div className="inventory-form-row inventory-form-row--triple">
              <label className="inventory-form-field">
                <span>Bán thành phẩm đầu ra *</span>
                <select value={form.outputItemId} disabled={readOnly} onChange={(event) => selectOutputItem(event.target.value)} required>
                  <option value="">Chọn bán thành phẩm</option>
                  {outputItems.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
                </select>
              </label>
              <label className="inventory-form-field">
                <span>Số lượng đầu ra *</span>
                <input type="number" min="0.000001" step="any" value={form.yieldQuantity} disabled={readOnly} onChange={(event) => updateField("yieldQuantity", event.target.value)} required />
              </label>
              <label className="inventory-form-field">
                <span>Đơn vị đầu ra *</span>
                <select value={form.yieldUnitId} disabled={readOnly || !form.outputItemId} onChange={(event) => updateField("yieldUnitId", event.target.value)} required>
                  <option value="">Chọn đơn vị</option>
                  {outputUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}{unit.symbol ? ` (${unit.symbol})` : ""}</option>)}
                </select>
              </label>
            </div>
          </section>

          <div className={`inventory-bom-output-context${hasOutputItem ? " is-ready" : ""}`}>
            <span className="inventory-bom-output-context__icon"><Icon name={hasOutputItem ? "check" : "warning"} size={18} /></span>
            <div>
              <small>{readOnly ? "CÔNG THỨC CỦA" : "ĐANG TẠO CÔNG THỨC CHO"}</small>
              <strong>{hasOutputItem ? outputItem.name : "Chưa chọn bán thành phẩm đầu ra"}</strong>
              <span>{hasOutputItem ? `${outputItem.code} · Đầu ra ${form.yieldQuantity || 0} ${outputUnits.find((unit) => unit.id === form.yieldUnitId)?.name || "đơn vị"}` : "Chọn bán thành phẩm trước khi thêm nguyên liệu."}</span>
            </div>
          </div>

          <section className="inventory-bom-form-section">
            <div className="inventory-bom-form-section__head"><Icon name="store" size={17} /><strong>Thực hiện</strong></div>
            <div className="inventory-form-row inventory-form-row--triple">
              <label className="inventory-form-field">
                <span>Loại công thức *</span>
                <select value={form.productionScope} disabled={readOnly} onChange={(event) => selectProductionScope(event.target.value)}>
                  {scopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              {isSharedBranchRecipe ? (
                <div className="inventory-production-modal__context">
                  <span>Phạm vi áp dụng</span>
                  <strong>Tất cả kho chi nhánh</strong>
                  <small>Kho thực hiện được chọn khi lập Lệnh sơ chế.</small>
                </div>
              ) : (
                <label className="inventory-form-field">
                  <span>Kho thực hiện *</span>
                  <select value={form.defaultWarehouseId} disabled={readOnly} onChange={(event) => updateField("defaultWarehouseId", event.target.value)} required>
                    <option value="">Chọn kho thực hiện</option>
                    {availableWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                  </select>
                </label>
              )}
              <label className="inventory-form-field">
                <span>Hiệu lực từ *</span>
                <input type="date" value={form.effectiveFrom} disabled={readOnly} onChange={(event) => updateField("effectiveFrom", event.target.value)} required />
              </label>
            </div>
          </section>

          <section className="inventory-bom-form-section">
            <div className="inventory-bom-form-section__head inventory-bom-form-section__head--actions">
              <div>
                <Icon name="gear" size={17} />
                <span className="inventory-bom-form-section__identity">
                  <strong>{hasOutputItem ? `Thành phần tạo ${outputItem.name}` : "Thành phần"}</strong>
                </span>
              </div>
              {!readOnly ? <button type="button" disabled={!hasOutputItem} onClick={() => setForm((current) => ({ ...current, components: [...current.components, createLine()] }))}><Icon name="plus" size={15} /> Thêm dòng</button> : null}
            </div>
            <div className="inventory-bom-lines">
              {!hasOutputItem ? (
                <div className="inventory-bom-components-locked">
                  <Icon name="bag" size={22} />
                  <div><strong>Chưa thể thêm thành phần</strong><span>Hãy chọn bán thành phẩm đầu ra.</span></div>
                </div>
              ) : form.components.map((line, index) => {
                const item = itemsById.get(line.componentItemId) || {};
                const compatibleUnits = getInventoryCompatibleUnits(item, units);
                const gross = calculateBomComponentRequirement({ quantity: line.quantity, wastePercent: line.wastePercent }).grossBaseQuantity;
                return (
                  <div className="inventory-bom-line" key={`${line.componentItemId || "new"}-${index}`}>
                    <label>
                      <span>Nguyên liệu/BTP *</span>
                      <select value={line.componentItemId} disabled={readOnly} onChange={(event) => selectComponentItem(index, event.target.value)} required>
                        <option value="">Chọn thành phần</option>
                        {semiFinishedComponents.length ? <optgroup label="Bán thành phẩm cấp dưới">{semiFinishedComponents.map((option) => <option key={option.id} value={option.id}>{option.name} ({option.code})</option>)}</optgroup> : null}
                        {materialComponents.length ? <optgroup label="Nguyên vật liệu và vật tư">{materialComponents.map((option) => <option key={option.id} value={option.id}>{option.name} ({option.code})</option>)}</optgroup> : null}
                      </select>
                    </label>
                    <label><span>Số lượng *</span><input type="number" min="0.000001" step="any" value={line.quantity} disabled={readOnly} onChange={(event) => updateLine(index, "quantity", event.target.value)} required /></label>
                    <label><span>Đơn vị *</span><select value={line.unitId} disabled={readOnly || !line.componentItemId} onChange={(event) => updateLine(index, "unitId", event.target.value)} required><option value="">Chọn đơn vị</option>{compatibleUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>
                    <label><span>Hao hụt (%)</span><input type="number" min="0" max="100" step="0.01" value={line.wastePercent} disabled={readOnly} onChange={(event) => updateLine(index, "wastePercent", event.target.value)} /></label>
                    <div className="inventory-bom-line__gross"><span>Cần dùng</span><strong>{Number.isFinite(gross) ? gross.toLocaleString("vi-VN", { maximumFractionDigits: 3 }) : "0"}</strong><small>{compatibleUnits.find((unit) => unit.id === line.unitId)?.name || "Đơn vị"}</small></div>
                    {!readOnly ? <button type="button" className="inventory-bom-line__remove" onClick={() => setForm((current) => ({ ...current, components: current.components.length > 1 ? current.components.filter((_, lineIndex) => lineIndex !== index) : current.components }))} disabled={form.components.length <= 1} aria-label="Xóa dòng"><Icon name="trash" size={15} /></button> : null}
                  </div>
                );
              })}
            </div>
          </section>

          <label className="inventory-form-field">
            <span>Ghi chú</span>
            <input value={form.notes} disabled={readOnly} onChange={(event) => updateField("notes", event.target.value)} placeholder="Không bắt buộc" />
          </label>

          {error ? <div className="inventory-count-error" role="alert"><Icon name="warning" size={16} />{error}</div> : null}

          <footer>
            <span />
            <button type="button" onClick={onClose}>Đóng</button>
            {!readOnly ? <button type="submit" className="is-primary" disabled={isSaving}><Icon name="check" size={16} />{isSaving ? "Đang lưu..." : "Lưu bản nháp"}</button> : null}
          </footer>
        </form>
      </section>
    </div>
  );
}
