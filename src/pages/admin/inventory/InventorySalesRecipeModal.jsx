import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { calculateSalesRecipeComponent } from "../../../services/inventorySalesRecipeCalculations.js";
import {
  getInventoryCompatibleUnits,
  getInventoryItemDisplayUnitConfig,
  getInventoryUnitToBaseFactor
} from "../../../services/inventoryUnitConversion.js";

function createLine() {
  return { itemId: "", quantity: 1, unitId: "", wastePercent: 0, notes: "" };
}

function initialForm(recipe = {}) {
  return {
    id: recipe.id || "",
    menuEntityType: recipe.menuEntityType || "product",
    menuEntityId: recipe.menuEntityId || "",
    branchUuid: recipe.branchUuid || "",
    yieldQuantity: recipe.yieldQuantity || 1,
    effectiveFrom: recipe.effectiveFrom || new Date().toISOString().slice(0, 10),
    notes: recipe.notes || "",
    components: recipe.components?.length
      ? recipe.components.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity,
          unitId: line.unitId,
          wastePercent: line.wastePercent || 0,
          notes: line.notes || ""
        }))
      : [createLine()]
  };
}

function money(value) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value || 0))} đ`;
}

export default function InventorySalesRecipeModal({
  recipe = {},
  menuEntities = [],
  items = [],
  units = [],
  branches = [],
  averageCosts = {},
  readOnly = false,
  isSaving = false,
  onClose,
  onSave
}) {
  const [form, setForm] = useState(() => initialForm(recipe));
  const [error, setError] = useState("");
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const unitsById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const selectedEntity = menuEntities.find((entity) => entity.id === form.menuEntityId && entity.type === form.menuEntityType);
  const activeItems = items.filter((item) => item.isActive !== false);
  const directMaterials = activeItems.filter((item) => item.itemType !== "semi_finished");
  const semiFinished = activeItems.filter((item) => item.itemType === "semi_finished");

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateLine = (index, field, value) => setForm((current) => ({
    ...current,
    components: current.components.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line)
  }));
  const selectItem = (index, itemId) => {
    const item = itemsById.get(itemId) || {};
    const config = getInventoryItemDisplayUnitConfig(item, unitsById);
    setForm((current) => ({
      ...current,
      components: current.components.map((line, lineIndex) => lineIndex === index
        ? { ...line, itemId, unitId: config.unitId || "", wastePercent: item.defaultWastePercent || 0 }
        : line)
    }));
  };

  const costLines = form.components.map((line) => {
    const item = itemsById.get(line.itemId) || {};
    const unit = unitsById.get(line.unitId) || {};
    const result = calculateSalesRecipeComponent({
      quantity: line.quantity,
      conversionToBase: getInventoryUnitToBaseFactor(item, unit),
      wastePercent: line.wastePercent,
      averageCost: averageCosts[line.itemId] || 0
    });
    return { ...result, item, unit };
  });
  const totalCost = costLines.reduce((sum, line) => sum + line.estimatedCost, 0);
  const unitCost = totalCost / Math.max(Number(form.yieldQuantity || 1), 1);
  const costRate = Number(selectedEntity?.price || 0) > 0 ? unitCost / Number(selectedEntity.price) * 100 : 0;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (saveError) {
      setError(saveError?.message || "Không thể lưu định lượng món bán.");
    }
  };

  return (
    <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="inventory-warehouse-modal inventory-sales-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-sales-recipe-title">
        <header>
          <div className="inventory-modal-heading"><span><Icon name="menu" size={20} /></span><div><h2 id="inventory-sales-recipe-title">{readOnly ? "Chi tiết định lượng" : form.id ? "Sửa định lượng" : "Tạo định lượng món bán"}</h2><p>Chọn món Menu trước, sau đó khai báo phần dùng trực tiếp.</p></div></div>
          <button type="button" onClick={onClose} aria-label="Đóng"><Icon name="close" size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="inventory-sales-safe-note"><Icon name="check" size={17} /> Chỉ lưu cấu hình, chưa tự động trừ tồn theo đơn.</div>

          <section className="inventory-sales-form-section">
            <div className="inventory-sales-form-section__title"><Icon name="bag" size={16} /><strong>Món bán</strong></div>
            <div className="inventory-form-row inventory-form-row--triple">
              <label className="inventory-form-field"><span>Món / topping trong Menu *</span><select value={`${form.menuEntityType}:${form.menuEntityId}`} disabled={readOnly || Boolean(form.id)} onChange={(event) => { const [type, ...id] = event.target.value.split(":"); setForm((current) => ({ ...current, menuEntityType: type || "product", menuEntityId: id.join(":") })); }} required><option value="product:">Chọn món Menu</option>{menuEntities.filter((row) => row.type === "product").map((row) => <option key={`product:${row.id}`} value={`product:${row.id}`}>{row.name}</option>)}{menuEntities.some((row) => row.type === "topping") ? <optgroup label="Topping">{menuEntities.filter((row) => row.type === "topping").map((row) => <option key={`topping:${row.id}`} value={`topping:${row.id}`}>{row.name}</option>)}</optgroup> : null}</select></label>
              <label className="inventory-form-field"><span>Áp dụng tại</span><select value={form.branchUuid} disabled={readOnly} onChange={(event) => update("branchUuid", event.target.value)}><option value="">Tất cả chi nhánh</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
              <label className="inventory-form-field"><span>Số phần chuẩn *</span><input type="number" min="0.000001" step="any" value={form.yieldQuantity} disabled={readOnly} onChange={(event) => update("yieldQuantity", event.target.value)} required /></label>
            </div>
          </section>

          <section className="inventory-sales-form-section">
            <div className="inventory-sales-form-section__title is-actions"><div><Icon name="gear" size={16} /><strong>Thành phần trực tiếp</strong></div>{!readOnly ? <button type="button" onClick={() => setForm((current) => ({ ...current, components: [...current.components, createLine()] }))}><Icon name="plus" size={15} /> Thêm dòng</button> : null}</div>
            <div className="inventory-sales-lines">
              {form.components.map((line, index) => {
                const item = itemsById.get(line.itemId) || {};
                const compatibleUnits = getInventoryCompatibleUnits(item, units);
                const cost = costLines[index]?.estimatedCost || 0;
                return (
                  <div className="inventory-sales-line" key={`${line.itemId || "new"}-${index}`}>
                    <label><span>Nguyên liệu / BTP *</span><select value={line.itemId} disabled={readOnly} onChange={(event) => selectItem(index, event.target.value)} required><option value="">Chọn thành phần</option>{semiFinished.length ? <optgroup label="Bán thành phẩm">{semiFinished.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.code})</option>)}</optgroup> : null}<optgroup label="Nguyên vật liệu trực tiếp">{directMaterials.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.code})</option>)}</optgroup></select></label>
                    <label><span>Định lượng *</span><input type="number" min="0.000001" step="any" value={line.quantity} disabled={readOnly} onChange={(event) => updateLine(index, "quantity", event.target.value)} required /></label>
                    <label><span>Đơn vị *</span><select value={line.unitId} disabled={readOnly || !line.itemId} onChange={(event) => updateLine(index, "unitId", event.target.value)} required><option value="">Chọn đơn vị</option>{compatibleUnits.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
                    <label><span>Hao hụt (%)</span><input type="number" min="0" max="100" step="0.01" value={line.wastePercent} disabled={readOnly} onChange={(event) => updateLine(index, "wastePercent", event.target.value)} /></label>
                    <div className="inventory-sales-line__cost"><span>Cost</span><strong>{money(cost)}</strong></div>
                    {!readOnly ? <button type="button" className="is-danger" disabled={form.components.length <= 1} onClick={() => setForm((current) => ({ ...current, components: current.components.filter((_, lineIndex) => lineIndex !== index) }))} aria-label="Xóa dòng"><Icon name="trash" size={15} /></button> : null}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="inventory-sales-cost-summary"><span>Giá bán <strong>{money(selectedEntity?.price)}</strong></span><span>Cost ước tính <strong>{money(unitCost)}</strong></span><span>Tỷ lệ cost <strong>{costRate ? `${costRate.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%` : "—"}</strong></span></div>
          <div className="inventory-form-row inventory-form-row--double"><label className="inventory-form-field"><span>Hiệu lực từ *</span><input type="date" value={form.effectiveFrom} disabled={readOnly} onChange={(event) => update("effectiveFrom", event.target.value)} required /></label><label className="inventory-form-field"><span>Ghi chú</span><input value={form.notes} disabled={readOnly} onChange={(event) => update("notes", event.target.value)} placeholder="Không bắt buộc" /></label></div>
          {error ? <div className="inventory-count-error" role="alert"><Icon name="warning" size={16} />{error}</div> : null}
          <footer><span /><button type="button" onClick={onClose}>Đóng</button>{!readOnly ? <button type="submit" className="is-primary" disabled={isSaving}><Icon name="check" size={16} />{isSaving ? "Đang lưu..." : "Lưu bản nháp"}</button> : null}</footer>
        </form>
      </section>
    </div>
  );
}
