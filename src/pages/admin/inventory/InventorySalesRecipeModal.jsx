import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import {
  calculateSalesRecipeComponent,
  getInventorySalesRecipeCoverage,
  getInventorySalesRecipeScopeConflict
} from "../../../services/inventorySalesRecipeCalculations.js";
import {
  getInventoryCompatibleUnits,
  getInventoryItemDisplayUnitConfig,
  getInventoryUnitToBaseFactor
} from "../../../services/inventoryUnitConversion.js";
import { getInventoryMenuEntityKindLabel } from "../../../services/inventoryMenuEntityService.js";

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
    recipeMode: recipe.sharedMenuEntityId ? "shared" : "direct",
    sharedMenuEntityType: recipe.sharedMenuEntityType || "product",
    sharedMenuEntityId: recipe.sharedMenuEntityId || "",
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
  recipes = [],
  allowNewVersion = false,
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
  const selectedSharedEntity = menuEntities.find((entity) => entity.id === form.sharedMenuEntityId && entity.type === form.sharedMenuEntityType);
  const menuEntityGroups = useMemo(() => {
    const groups = new Map();
    menuEntities.forEach((entity) => {
      const category = entity.type === "product"
        ? `Món · ${entity.category || "Món khác"}`
        : entity.category || "Topping bán thêm";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(entity);
    });
    return Array.from(groups, ([category, entities]) => ({ category, entities }));
  }, [menuEntities]);
  const sharedRecipeOptions = useMemo(() => menuEntities.filter((entity) => {
    if (entity.id === form.menuEntityId && entity.type === form.menuEntityType) return false;
    return recipes.some((candidate) => (
      candidate.status === "active"
      && !candidate.sharedMenuEntityId
      && candidate.menuEntityId === entity.id
      && candidate.menuEntityType === entity.type
      && (!candidate.branchUuid || candidate.branchUuid === form.branchUuid)
      && (!form.branchUuid ? !candidate.branchUuid : true)
      && (!candidate.effectiveFrom || candidate.effectiveFrom <= form.effectiveFrom)
      && (!candidate.effectiveTo || candidate.effectiveTo >= form.effectiveFrom)
    ));
  }), [form.branchUuid, form.effectiveFrom, form.menuEntityId, form.menuEntityType, menuEntities, recipes]);
  const scopeConflict = getInventorySalesRecipeScopeConflict({
    recipes,
    menuEntityType: form.menuEntityType,
    menuEntityId: form.menuEntityId,
    branchUuid: form.branchUuid,
    recipeId: form.id,
    allowActiveVersion: allowNewVersion
  });
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

  const costLines = (form.recipeMode === "shared" ? [] : form.components).map((line) => {
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
      if (scopeConflict) {
        throw new Error(scopeConflict.type === "draft"
          ? "Món này đã có một bản nháp trong cùng phạm vi. Hãy mở bản nháp đó để sửa."
          : "Món này đã có định lượng đang áp dụng. Hãy dùng nút Tạo bản mới.");
      }
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
          <div className="inventory-sales-safe-note"><Icon name="check" size={17} /> Món trùng tên vẫn giữ mã riêng, nhưng có thể dùng chung một định lượng gốc. Mức cay hoặc cách chế biến không cần tạo định lượng.</div>

          <section className="inventory-sales-form-section">
            <div className="inventory-sales-form-section__title"><Icon name="bag" size={16} /><strong>Món bán</strong></div>
            <div className="inventory-form-row inventory-form-row--triple">
              <label className="inventory-form-field"><span>Món / lựa chọn / topping *</span><InventorySearchableSelect value={`${form.menuEntityType}:${form.menuEntityId}`} disabled={readOnly || Boolean(form.id)} onChange={(event) => { const [type, ...id] = event.target.value.split(":"); setForm((current) => ({ ...current, menuEntityType: type || "product", menuEntityId: id.join(":"), sharedMenuEntityId: "" })); }} required><option value="product:">Chọn đối tượng định lượng</option>{menuEntityGroups.map((group) => <optgroup key={group.category} label={group.category}>{group.entities.map((row) => { const coverage = getInventorySalesRecipeCoverage(row, recipes); return <option key={`${row.type}:${row.id}`} value={`${row.type}:${row.id}`}>{row.name} · {coverage === "active" ? "Đang áp dụng" : coverage === "draft" ? "Có bản nháp" : "Chưa định lượng"}</option>; })}</optgroup>)}</InventorySearchableSelect>{selectedEntity ? <small>{getInventoryMenuEntityKindLabel(selectedEntity)}</small> : null}</label>
              <label className="inventory-form-field"><span>Áp dụng tại</span><InventorySearchableSelect value={form.branchUuid} disabled={readOnly} onChange={(event) => update("branchUuid", event.target.value)}><option value="">Tất cả chi nhánh</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</InventorySearchableSelect></label>
              <label className="inventory-form-field"><span>Số phần chuẩn *</span><input type="number" min="0.000001" step="any" value={form.yieldQuantity} disabled={readOnly} onChange={(event) => update("yieldQuantity", event.target.value)} required /></label>
            </div>
          </section>

          <section className="inventory-sales-form-section">
            <div className="inventory-sales-form-section__title"><Icon name="share" size={16} /><strong>Cách khai báo định lượng</strong></div>
            <div className="inventory-sales-recipe-mode" role="radiogroup">
              <button type="button" className={form.recipeMode === "direct" ? "is-active" : ""} disabled={readOnly} onClick={() => update("recipeMode", "direct")}><Icon name="gear" size={17} /><span><strong>Khai báo thành phần riêng</strong><small>Tự nhập nguyên liệu cho đúng mã Menu này.</small></span></button>
              <button type="button" className={form.recipeMode === "shared" ? "is-active" : ""} disabled={readOnly} onClick={() => update("recipeMode", "shared")}><Icon name="share" size={17} /><span><strong>Dùng chung định lượng gốc</strong><small>Phù hợp khi nhiều mục thực chất là cùng một món.</small></span></button>
            </div>
            {form.recipeMode === "shared" ? <label className="inventory-form-field inventory-sales-shared-select"><span>Dùng định lượng của *</span><InventorySearchableSelect value={`${form.sharedMenuEntityType}:${form.sharedMenuEntityId}`} disabled={readOnly} onChange={(event) => { const [type, ...id] = event.target.value.split(":"); setForm((current) => ({ ...current, sharedMenuEntityType: type || "product", sharedMenuEntityId: id.join(":") })); }} required><option value="product:">Chọn món đã có định lượng đang áp dụng</option>{sharedRecipeOptions.map((row) => <option key={`${row.type}:${row.id}`} value={`${row.type}:${row.id}`}>{row.name} · {getInventoryMenuEntityKindLabel(row)}</option>)}</InventorySearchableSelect><small>{selectedSharedEntity ? `Đơn bán sẽ trừ kho theo định lượng của ${selectedSharedEntity.name}.` : "Cần áp dụng định lượng gốc trước khi liên kết."}</small></label> : null}
          </section>

          {form.recipeMode === "direct" ? <section className="inventory-sales-form-section">
            <div className="inventory-sales-form-section__title is-actions"><div><Icon name="gear" size={16} /><strong>Thành phần trực tiếp</strong></div>{!readOnly ? <button type="button" onClick={() => setForm((current) => ({ ...current, components: [...current.components, createLine()] }))}><Icon name="plus" size={15} /> Thêm dòng</button> : null}</div>
            <div className="inventory-sales-lines">
              {form.components.map((line, index) => {
                const item = itemsById.get(line.itemId) || {};
                const compatibleUnits = getInventoryCompatibleUnits(item, units);
                const cost = costLines[index]?.estimatedCost || 0;
                return (
                  <div className="inventory-sales-line" key={`${line.itemId || "new"}-${index}`}>
                    <label><span>Nguyên liệu / BTP *</span><InventorySearchableSelect value={line.itemId} disabled={readOnly} onChange={(event) => selectItem(index, event.target.value)} required><option value="">Chọn thành phần</option>{semiFinished.length ? <optgroup label="Bán thành phẩm">{semiFinished.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.code})</option>)}</optgroup> : null}<optgroup label="Nguyên vật liệu trực tiếp">{directMaterials.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.code})</option>)}</optgroup></InventorySearchableSelect></label>
                    <label><span>Định lượng *</span><input type="number" min="0.000001" step="any" value={line.quantity} disabled={readOnly} onChange={(event) => updateLine(index, "quantity", event.target.value)} required /></label>
                    <label><span>Đơn vị *</span><InventorySearchableSelect value={line.unitId} disabled={readOnly || !line.itemId} onChange={(event) => updateLine(index, "unitId", event.target.value)} required><option value="">Chọn đơn vị</option>{compatibleUnits.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</InventorySearchableSelect></label>
                    <label><span>Hao hụt (%)</span><input type="number" min="0" max="100" step="0.01" value={line.wastePercent} disabled={readOnly} onChange={(event) => updateLine(index, "wastePercent", event.target.value)} /></label>
                    <div className="inventory-sales-line__cost"><span>Cost</span><strong>{money(cost)}</strong></div>
                    {!readOnly ? <button type="button" className="is-danger" disabled={form.components.length <= 1} onClick={() => setForm((current) => ({ ...current, components: current.components.filter((_, lineIndex) => lineIndex !== index) }))} aria-label="Xóa dòng"><Icon name="trash" size={15} /></button> : null}
                  </div>
                );
              })}
            </div>
          </section> : <div className="inventory-sales-shared-note"><Icon name="share" size={18} /><div><strong>Không cần nhập lại nguyên liệu</strong><span>Hệ thống giữ riêng mã Menu nhưng dùng đúng thành phần và cost của định lượng gốc.</span></div></div>}

          {form.recipeMode === "direct" ? <div className="inventory-sales-cost-summary"><span>Giá bán <strong>{money(selectedEntity?.price)}</strong></span><span>Cost ước tính <strong>{money(unitCost)}</strong></span><span>Tỷ lệ cost <strong>{costRate ? `${costRate.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%` : "—"}</strong></span></div> : null}
          <div className="inventory-form-row inventory-form-row--double"><label className="inventory-form-field"><span>Hiệu lực từ *</span><input type="date" value={form.effectiveFrom} disabled={readOnly} onChange={(event) => update("effectiveFrom", event.target.value)} required /></label><label className="inventory-form-field"><span>Ghi chú</span><input value={form.notes} disabled={readOnly} onChange={(event) => update("notes", event.target.value)} placeholder="Không bắt buộc" /></label></div>
          {error ? <div className="inventory-count-error" role="alert"><Icon name="warning" size={16} />{error}</div> : null}
          {scopeConflict && !readOnly ? <div className="inventory-count-error" role="alert"><Icon name="warning" size={16} />{scopeConflict.type === "draft" ? "Món này đã có bản nháp trong phạm vi đã chọn. Hãy mở bản nháp đó để sửa." : "Món này đã có định lượng đang áp dụng. Hãy đóng cửa sổ và chọn Tạo bản mới."}</div> : null}
          <footer><span /><button type="button" onClick={onClose}>Đóng</button>{!readOnly ? <button type="submit" className="is-primary" disabled={isSaving || Boolean(scopeConflict)}><Icon name="check" size={16} />{isSaving ? "Đang lưu..." : "Lưu bản nháp"}</button> : null}</footer>
        </form>
      </section>
    </div>
  );
}
