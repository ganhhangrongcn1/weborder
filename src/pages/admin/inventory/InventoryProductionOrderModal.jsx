import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import {
  getInventoryProductionExpiryConfig,
  getInventoryProductionInputPlan,
  getInventoryProductionOutputPreview,
  getInventoryProductionScopeMeta
} from "../../../services/inventoryProductionService.js";

function formatQuantity(value) {
  return Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

function initialForm(order = {}) {
  const expiryConfig = getInventoryProductionExpiryConfig(order.outputItem);
  return {
    id: order.id || "",
    bomId: order.bomId || "",
    warehouseId: order.warehouseId || "",
    plannedOutputQuantity: order.plannedOutputQuantity || 1,
    planningMode: "output",
    sourceComponentItemId: "",
    sourceInputQuantity: 1,
    actualOutputQuantity: order.actualOutputQuantity || order.plannedOutputQuantity || 1,
    outputExpiresOn: order.outputExpiresOn || expiryConfig.suggestedExpiresOn,
    notes: order.notes || "",
    lines: (order.lines || []).map((line) => ({
      ...line,
      actualQuantity: line.actualQuantity || line.plannedQuantity
    }))
  };
}

export default function InventoryProductionOrderModal({
  mode = "create",
  order = {},
  boms = [],
  warehouses = [],
  units = [],
  warehouseSelectionLocked = false,
  isSaving = false,
  onClose,
  onSave,
  onComplete
}) {
  const [form, setForm] = useState(() => initialForm(order));
  const [error, setError] = useState("");
  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const readOnly = mode === "view";
  const completing = mode === "complete";
  const activeBoms = boms.filter((bom) => bom.status === "active" && !bom.deletedAt);
  const selectedBom = useMemo(
    () => activeBoms.find((bom) => bom.id === form.bomId) || boms.find((bom) => bom.id === order.bomId) || {},
    [activeBoms, boms, form.bomId, order.bomId]
  );
  const scopeMeta = getInventoryProductionScopeMeta(selectedBom.productionScope || order.productionScope);
  const outputItem = selectedBom.outputItem || order.outputItem || {};
  const outputUnit = unitById.get(selectedBom.yieldUnitId || order.outputUnitId)
    || selectedBom.yieldUnit
    || order.outputUnit
    || {};
  const baseUnit = unitById.get(outputItem.baseUnitId) || outputItem.baseUnit || {};
  const outputConversionToBase = Number(selectedBom.yieldConversionToBase || order.outputConversionToBase || 1);
  const sourceComponents = selectedBom.components || [];
  const inputPlan = getInventoryProductionInputPlan({
    bom: selectedBom,
    componentItemId: form.sourceComponentItemId,
    inputQuantity: form.sourceInputQuantity
  });
  const planningFromInput = !readOnly && !completing && form.planningMode === "input";
  const effectivePlannedOutputQuantity = planningFromInput
    ? inputPlan.plannedOutputQuantity
    : Number(form.plannedOutputQuantity || 0);
  const outputPreview = getInventoryProductionOutputPreview(
    completing ? form.actualOutputQuantity : effectivePlannedOutputQuantity,
    outputConversionToBase
  );
  const outputQuantity = outputPreview.quantity;
  const outputUnitLabel = outputUnit.symbol || outputUnit.name || "đơn vị";
  const baseUnitLabel = baseUnit.symbol || baseUnit.name || "đơn vị lưu kho";
  const outputBaseQuantity = outputPreview.baseQuantity;
  const expiryConfig = getInventoryProductionExpiryConfig(outputItem);
  const availableWarehouses = warehouses.filter((warehouse) => (
    warehouse.isActive !== false
    && warehouse.warehouseType === ({ central: "central", branch: "branch", department: "department" }[scopeMeta.scope] || "central")
  ));
  const fixedWarehouse = warehouseSelectionLocked && availableWarehouses.length === 1
    ? availableWarehouses[0]
    : null;
  const selectedWarehouse = availableWarehouses.find((warehouse) => warehouse.id === form.warehouseId)
    || order.warehouse
    || selectedBom.defaultWarehouse
    || {};
  const factor = selectedBom.yieldQuantity > 0 ? effectivePlannedOutputQuantity / selectedBom.yieldQuantity : 0;
  const previewLines = order.lines?.length
    ? form.lines
    : planningFromInput
      ? inputPlan.lines
      : sourceComponents.map((line) => ({
        ...line,
        item: line.componentItem,
        plannedQuantity: line.quantity * factor * (1 + Number(line.wastePercent || 0) / 100)
      }));
  const sourceComponent = sourceComponents.find((line) => line.componentItemId === inputPlan.componentItemId) || {};
  const sourceUnit = sourceComponent.unit || unitById.get(sourceComponent.unitId) || {};
  const sourceUnitLabel = sourceUnit.symbol || sourceUnit.name || "đơn vị";
  const validPlanningQuantity = Number.isFinite(effectivePlannedOutputQuantity) && effectivePlannedOutputQuantity > 0;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      if (completing) await onComplete(order, form);
      else await onSave({
        ...form,
        plannedOutputQuantity: planningFromInput
          ? inputPlan.plannedOutputQuantity
          : form.plannedOutputQuantity
      });
      onClose();
    } catch (saveError) {
      setError(saveError?.message || `Không thể lưu ${scopeMeta.title.toLocaleLowerCase("vi")}.`);
    }
  };

  const updateLine = (index, value) => setForm((current) => ({
    ...current,
    lines: current.lines.map((line, lineIndex) => lineIndex === index ? { ...line, actualQuantity: value } : line)
  }));

  const title = completing
    ? `Hoàn thành ${scopeMeta.title.toLocaleLowerCase("vi")}`
    : readOnly
      ? `Chi tiết ${scopeMeta.title.toLocaleLowerCase("vi")}`
      : form.id
        ? `Sửa ${scopeMeta.title.toLocaleLowerCase("vi")}`
        : scopeMeta.createLabel;

  return (
    <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="inventory-warehouse-modal inventory-production-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-production-modal-title">
        <header>
          <div className="inventory-modal-heading">
            <span><Icon name="gear" size={20} /></span>
            <div><h2 id="inventory-production-modal-title">{title}</h2><p>{order.orderNo || "Hệ thống tự sinh mã lệnh"}</p></div>
          </div>
          <button type="button" className="inventory-modal-close" onClick={onClose} aria-label="Đóng"><Icon name="close" size={18} /></button>
        </header>

        <form onSubmit={submit}>
          {!readOnly ? <div className="inventory-bom-safe-note"><Icon name="check" size={17} /><span>Chỉ khi bấm Hoàn thành hệ thống mới trừ nguyên liệu và nhập bán thành phẩm.</span></div> : null}

          <section className="inventory-bom-form-section">
            <div className="inventory-bom-form-section__head"><Icon name="bag" size={17} /><strong>{scopeMeta.isPreprocessing ? "Bán thành phẩm cần sơ chế" : "Thành phẩm cần làm"}</strong></div>
            <div className="inventory-form-row inventory-form-row--triple">
              <label className="inventory-form-field inventory-production-modal__recipe">
                <span>Công thức *</span>
                <InventorySearchableSelect value={form.bomId} disabled={readOnly || completing || Boolean(form.id)} onChange={(event) => {
                  const nextBom = activeBoms.find((bom) => bom.id === event.target.value) || {};
                  setForm((current) => ({
                    ...current,
                    bomId: event.target.value,
                    sourceComponentItemId: nextBom.components?.[0]?.componentItemId || "",
                    warehouseId: nextBom.defaultWarehouseId
                      || (warehouseSelectionLocked && nextBom.productionScope === "branch"
                        ? warehouses.find((warehouse) => warehouse.isActive !== false && warehouse.warehouseType === "branch")?.id || ""
                        : "")
                  }));
                }} required>
                  <option value="">Chọn công thức đang áp dụng</option>
                  {activeBoms.map((bom) => <option key={bom.id} value={bom.id}>{bom.outputItem?.name} · {bom.code}</option>)}
                </InventorySearchableSelect>
              </label>
              {readOnly || completing ? (
                <label className="inventory-form-field">
                  <span>{completing ? (scopeMeta.isPreprocessing ? `Số lượng sơ chế thực nhận (${outputUnitLabel}) *` : `Thành phẩm thực nhận (${outputUnitLabel}) *`) : `Số lượng cần làm (${outputUnitLabel}) *`}</span>
                  <input
                    type="number"
                    min="0.000001"
                    step="any"
                    value={completing ? form.actualOutputQuantity : form.plannedOutputQuantity}
                    disabled={readOnly}
                    onChange={(event) => setForm((current) => ({ ...current, [completing ? "actualOutputQuantity" : "plannedOutputQuantity"]: event.target.value }))}
                    required
                  />
                  <small className="inventory-production-output-conversion">
                    {formatQuantity(outputQuantity)} {outputUnitLabel} = {formatQuantity(outputBaseQuantity)} {baseUnitLabel} tồn kho
                  </small>
                </label>
              ) : (
                <label className="inventory-form-field">
                  <span>Cách tính số lượng *</span>
                  <InventorySearchableSelect value={form.planningMode} disabled={!form.bomId} onChange={(event) => setForm((current) => ({
                    ...current,
                    planningMode: event.target.value,
                    sourceComponentItemId: current.sourceComponentItemId || sourceComponents[0]?.componentItemId || ""
                  }))}>
                    <option value="output">Theo thành phẩm cần làm</option>
                    <option value="input">Theo nguyên liệu đang có</option>
                  </InventorySearchableSelect>
                </label>
              )}
              {!readOnly && !completing && selectedBom.productionScope === "branch" && !fixedWarehouse ? (
                <label className="inventory-form-field">
                  <span>Kho sơ chế *</span>
                  <InventorySearchableSelect value={form.warehouseId} onChange={(event) => setForm((current) => ({ ...current, warehouseId: event.target.value }))} required>
                    <option value="">Chọn kho chi nhánh</option>
                    {availableWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                  </InventorySearchableSelect>
                </label>
              ) : (
                <div className="inventory-production-modal__context">
                  <span>{scopeMeta.warehouseLabel}</span>
                  <strong>{fixedWarehouse?.name || selectedWarehouse.name || "Theo công thức"}</strong>
                  <small>{fixedWarehouse ? "Cố định theo tài khoản chi nhánh" : `${selectedBom.outputItem?.name || order.outputItem?.name || "Chưa chọn công thức"} · ${outputUnit.name || outputUnitLabel}`}</small>
                </div>
              )}
            </div>

            {!readOnly && !completing ? (
              <div className="inventory-form-row inventory-form-row--triple">
                {planningFromInput ? (
                  <>
                    <label className="inventory-form-field">
                      <span>Nguyên liệu làm mốc *</span>
                      <InventorySearchableSelect value={inputPlan.componentItemId} disabled={!form.bomId} onChange={(event) => setForm((current) => ({ ...current, sourceComponentItemId: event.target.value }))} required>
                        <option value="">Chọn nguyên liệu</option>
                        {sourceComponents.map((line) => <option key={line.componentItemId} value={line.componentItemId}>{line.componentItem?.name || "Nguyên liệu"} · {line.unit?.name || "Đơn vị"}</option>)}
                      </InventorySearchableSelect>
                    </label>
                    <label className="inventory-form-field">
                      <span>Số lượng nguyên liệu đang có ({sourceUnitLabel}) *</span>
                      <input type="number" min="0.000001" step="any" value={form.sourceInputQuantity} disabled={!form.bomId} onChange={(event) => setForm((current) => ({ ...current, sourceInputQuantity: event.target.value }))} required />
                    </label>
                    <div className="inventory-production-modal__context">
                      <span>Thành phẩm dự kiến</span>
                      <strong>{formatQuantity(effectivePlannedOutputQuantity)} {outputUnitLabel}</strong>
                      <small>Từ {formatQuantity(form.sourceInputQuantity)} {sourceUnitLabel} nguyên liệu làm mốc</small>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="inventory-form-field">
                      <span>Số lượng cần làm ({outputUnitLabel}) *</span>
                      <input type="number" min="0.000001" step="any" value={form.plannedOutputQuantity} disabled={!form.bomId} onChange={(event) => setForm((current) => ({ ...current, plannedOutputQuantity: event.target.value }))} required />
                    </label>
                    <div className="inventory-production-modal__context">
                      <span>Quy đổi tồn kho</span>
                      <strong>{formatQuantity(outputBaseQuantity)} {baseUnitLabel}</strong>
                      <small>{formatQuantity(outputQuantity)} {outputUnitLabel} thành phẩm</small>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </section>

          {completing && expiryConfig.trackExpiry ? (
            <section className="inventory-bom-form-section">
              <div className="inventory-bom-form-section__head"><Icon name="clock" size={17} /><strong>Lô và hạn sử dụng đầu ra</strong></div>
              <div className="inventory-form-row inventory-form-row--triple">
                <div className="inventory-production-modal__context">
                  <span>Mã lô</span>
                  <strong>SX-{order.orderNo}</strong>
                  <small>Hệ thống tự sinh</small>
                </div>
                <div className="inventory-production-modal__context">
                  <span>Ngày sản xuất</span>
                  <strong>{expiryConfig.manufacturedOn.split("-").reverse().join("/")}</strong>
                  <small>Ngày hoàn thành lệnh</small>
                </div>
                <label className="inventory-form-field">
                  <span>Hạn sử dụng *</span>
                  <input
                    type="date"
                    min={expiryConfig.manufacturedOn}
                    value={form.outputExpiresOn}
                    onChange={(event) => setForm((current) => ({ ...current, outputExpiresOn: event.target.value }))}
                    required
                  />
                  <small>{expiryConfig.shelfLifeDays > 0 ? `Gợi ý theo thiết lập: ${expiryConfig.shelfLifeDays} ngày.` : "Nhập HSD thực tế của mẻ."}</small>
                </label>
              </div>
            </section>
          ) : null}

          <section className="inventory-bom-form-section">
            <div className="inventory-bom-form-section__head inventory-bom-form-section__head--actions">
              <div><Icon name="menu" size={17} /><strong>{completing ? "Nguyên liệu thực dùng" : "Định lượng tự tính"}</strong></div>
              <span className="inventory-production-modal__line-count">{previewLines.length} thành phần</span>
            </div>
            <div className="inventory-production-lines">
              {previewLines.length ? previewLines.map((line, index) => (
                <div className="inventory-production-line" key={line.id || `${line.componentItemId}-${index}`}>
                  <div><strong>{line.item?.name || line.componentItem?.name || "Nguyên liệu"}</strong><small>{line.item?.code || line.componentItem?.code || ""}</small></div>
                  <span>{line.unit?.name || "Đơn vị"}</span>
                  {completing ? (
                    <label><span>Thực dùng</span><input type="number" min="0.000001" step="any" value={line.actualQuantity} onChange={(event) => updateLine(index, event.target.value)} required /></label>
                  ) : <strong>{formatQuantity(line.plannedQuantity)}</strong>}
                </div>
              )) : <div className="inventory-production-lines__empty">Chọn công thức để xem lượng nguyên liệu cần dùng.</div>}
            </div>
          </section>

          {!completing ? <label className="inventory-form-field"><span>Ghi chú</span><input value={form.notes} disabled={readOnly} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Không bắt buộc" /></label> : null}

          {readOnly && order.status === "completed" ? (
            <div className="inventory-production-cost-summary">
              <span>Tổng giá vốn thực tế <strong>{Number(order.actualTotalCost || 0).toLocaleString("vi-VN")} đ</strong></span>
              <span>Giá vốn / đơn vị lưu kho <strong>{Number(order.actualUnitCost || 0).toLocaleString("vi-VN")} đ</strong></span>
              {order.outputLotNumber ? <span>Lô đầu ra <strong>{order.outputLotNumber}</strong></span> : null}
              {order.outputExpiresOn ? <span>Hạn sử dụng <strong>{order.outputExpiresOn.split("-").reverse().join("/")}</strong></span> : null}
            </div>
          ) : null}

          {error ? <div className="inventory-count-error" role="alert"><Icon name="warning" size={16} />{error}</div> : null}

          <footer>
            <span />
            <button type="button" onClick={onClose}>Đóng</button>
            {!readOnly ? <button type="submit" className="is-primary" disabled={isSaving || !previewLines.length || !validPlanningQuantity}><Icon name="check" size={16} />{isSaving ? "Đang xử lý..." : completing ? "Xác nhận hoàn thành" : "Lưu bản nháp"}</button> : null}
          </footer>
        </form>
      </section>
    </div>
  );
}
