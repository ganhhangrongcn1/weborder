import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";

function createTarget() {
  return { menuEntityType: "product", menuEntityId: "", quantity: 1 };
}

function initialForm(source = {}) {
  return {
    id: source.id || "",
    partnerSource: source.partnerSource || "grabfood",
    branchUuid: source.branchUuid || "",
    mappingKind: source.mappingKind || source.candidateKind || "item",
    externalItemId: source.externalItemId || "",
    externalItemName: source.externalItemName || "",
    externalOptionGroup: source.externalOptionGroup || "",
    externalOptionName: source.externalOptionName || "",
    ignoreInventory: source.ignoreInventory === true,
    notes: source.notes || "",
    targets: source.targets?.length ? source.targets.map((target) => ({ ...target })) : [createTarget()]
  };
}

const SOURCE_LABELS = { grabfood: "GrabFood", shopeefood: "ShopeeFood", xanhngon: "Xanh Ngon", other: "Kênh khác" };

export default function InventoryChannelMappingModal({
  source = {},
  menuEntities = [],
  branches = [],
  isSaving = false,
  onClose,
  onSave
}) {
  const [form, setForm] = useState(() => initialForm(source));
  const [error, setError] = useState("");
  const menuEntityGroups = useMemo(() => {
    const groups = new Map();
    menuEntities.forEach((entity) => {
      const category = entity.type === "topping" ? "Topping" : String(entity.category || "Món khác").trim() || "Món khác";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(entity);
    });
    return Array.from(groups, ([category, entities]) => ({ category, entities }));
  }, [menuEntities]);
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateTarget = (index, field, value) => setForm((current) => ({
    ...current,
    targets: current.targets.map((target, targetIndex) => targetIndex === index ? { ...target, [field]: value } : target)
  }));
  const selectTarget = (index, value) => {
    const [menuEntityType, ...id] = value.split(":");
    updateTarget(index, "menuEntityType", menuEntityType || "product");
    updateTarget(index, "menuEntityId", id.join(":"));
  };
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (saveError) {
      setError(saveError?.message || "Không thể lưu ánh xạ kênh bán.");
    }
  };

  return (
    <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="inventory-warehouse-modal inventory-channel-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-channel-title">
        <header>
          <div className="inventory-modal-heading"><span><Icon name="share" size={20} /></span><div><h2 id="inventory-channel-title">Gán món từ kênh bán</h2><p>Một món hoặc combo app có thể gán nhiều món Menu với số lượng riêng.</p></div></div>
          <button type="button" onClick={onClose} aria-label="Đóng"><Icon name="close" size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <section className="inventory-sales-form-section">
            <div className="inventory-channel-source">
              <span className={`inventory-channel-badge is-${form.partnerSource}`}>{SOURCE_LABELS[form.partnerSource] || form.partnerSource}</span>
              <div><strong>{form.mappingKind === "option" ? form.externalOptionName : form.externalItemName}</strong><small>{form.mappingKind === "option" ? `${form.externalItemName === "*" ? "Áp dụng cho mọi món" : form.externalItemName} · ${form.externalOptionGroup}` : form.externalItemId || "Đối chiếu theo tên đã xác nhận"}</small></div>
              <div><span>Phạm vi</span><strong>{form.partnerSource === "shopeefood" ? "Dùng chung ShopeeFood" : branches.find((branch) => branch.id === form.branchUuid)?.name || "Chưa xác định"}</strong></div>
            </div>
          </section>

          <label className="inventory-channel-ignore">
            <input type="checkbox" checked={form.ignoreInventory} onChange={(event) => update("ignoreInventory", event.target.checked)} />
            <span><strong>Không trừ kho</strong><small>Dùng cho mức cay, ghi chú chế biến hoặc lựa chọn không tạo ra món.</small></span>
          </label>

          {!form.ignoreInventory ? (
            <section className="inventory-sales-form-section">
              <div className="inventory-sales-form-section__title is-actions"><div><Icon name="tag" size={16} /><strong>Món Menu được ghi nhận</strong></div><button type="button" onClick={() => setForm((current) => ({ ...current, targets: [...current.targets, createTarget()] }))}><Icon name="plus" size={15} /> Thêm món</button></div>
              <div className="inventory-channel-targets">
                {form.targets.map((target, index) => (
                  <div className="inventory-channel-target" key={`${target.menuEntityType}:${target.menuEntityId}:${index}`}>
                    <label className="inventory-form-field"><span>Món / topping *</span><select value={`${target.menuEntityType}:${target.menuEntityId}`} onChange={(event) => selectTarget(index, event.target.value)} required><option value="product:">Chọn món Menu</option>{menuEntityGroups.map((group) => <optgroup key={group.category} label={group.category}>{group.entities.map((row) => <option key={`${row.type}:${row.id}`} value={`${row.type}:${row.id}`}>{row.name}</option>)}</optgroup>)}</select></label>
                    <label className="inventory-form-field"><span>Số lượng *</span><input type="number" min="0.000001" step="any" value={target.quantity} onChange={(event) => updateTarget(index, "quantity", event.target.value)} required /></label>
                    <button type="button" className="inventory-channel-target__remove" disabled={form.targets.length <= 1} onClick={() => setForm((current) => ({ ...current, targets: current.targets.filter((_, targetIndex) => targetIndex !== index) }))} aria-label="Xóa món"><Icon name="trash" size={15} /></button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <label className="inventory-form-field"><span>Ghi chú</span><input value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Không bắt buộc" /></label>
          {error ? <div className="inventory-count-error" role="alert"><Icon name="warning" size={16} />{error}</div> : null}
          <footer><span /><button type="button" onClick={onClose}>Đóng</button><button type="submit" className="is-primary" disabled={isSaving}><Icon name="check" size={16} />{isSaving ? "Đang lưu..." : "Lưu ánh xạ"}</button></footer>
        </form>
      </section>
    </div>
  );
}
