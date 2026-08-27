import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import { createInventoryMasterDataCode } from "../../../services/inventoryMasterDataService.js";

const DOMAIN_LABELS = {
  units: "đơn vị tính",
  "item-categories": "danh mục nguyên vật liệu",
  suppliers: "nhà cung cấp",
  items: "nguyên vật liệu"
};

const SHELF_LIFE_PRESETS = [1, 3, 7, 14, 30, 60, 90];
const EXPIRY_WARNING_PRESETS = [1, 3, 7, 30];

const EMPTY_BY_DOMAIN = {
  units: { code: "", name: "", symbol: "", unitType: "", baseUnitId: "", conversionFactor: 1, displayOrder: 0, isActive: true },
  "item-categories": { code: "", name: "", description: "", displayOrder: 0, isActive: true },
  suppliers: { code: "", name: "", contactName: "", phone: "", email: "", address: "", paymentNotes: "", isActive: true },
  items: {
    code: "",
    name: "",
    itemType: "ingredient",
    groupId: "",
    displayUnitId: "",
    baseUnitId: "",
    purchaseUnitId: "",
    purchaseToBaseRatio: 1,
    minimumStock: 0,
    reorderPoint: 0,
    orderQuantity: 0,
    maximumStock: 0,
    defaultWastePercent: 0,
    trackExpiry: false,
    shelfLifeDays: 30,
    expiryWarningDays: 3,
    notes: "",
    metadata: {},
    isActive: true
  }
};

function buildInitialForm(domain, record) {
  const empty = EMPTY_BY_DOMAIN[domain] || EMPTY_BY_DOMAIN.units;
  if (!record) return { ...empty };
  return Object.keys(empty).reduce((next, key) => ({
    ...next,
    [key]: record[key] ?? empty[key]
  }), {});
}

function Field({ label, required = false, help = "", children, full = false }) {
  return (
    <label className={`inventory-form-field${full ? " full-field" : ""}`}>
      <span className="inventory-field-label">{label}{required ? <b> *</b> : null}</span>
      {children}
      {help ? <small className="inventory-plain-help">{help}</small> : null}
    </label>
  );
}

export default function InventoryMasterDataModal({
  domain = "units",
  record = null,
  units = [],
  categories = [],
  existingRows = [],
  onClose,
  onSave
}) {
  const [form, setForm] = useState(() => buildInitialForm(domain, record));
  const [customShelfLife, setCustomShelfLife] = useState(() => Boolean(
    record?.trackExpiry && !SHELF_LIFE_PRESETS.includes(Number(record.shelfLifeDays || 0))
  ));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const label = DOMAIN_LABELS[domain] || "dữ liệu";
  const isItems = domain === "items";
  const isSuppliers = domain === "suppliers";
  const isUnits = domain === "units";
  const isCategories = domain === "item-categories";
  const baseUnits = useMemo(
    () => units.filter((unit) => !unit.baseUnitId && unit.isActive !== false && unit.id !== record?.id),
    [record?.id, units]
  );
  const isConversionUnit = isUnits && Boolean(form.baseUnitId);

  const inventoryUnits = useMemo(
    () => units.filter((unit) => unit.isActive !== false),
    [units]
  );
  const inventoryBaseUnits = useMemo(
    () => inventoryUnits.filter((unit) => !unit.baseUnitId),
    [inventoryUnits]
  );
  const inventoryConversionUnits = useMemo(
    () => inventoryUnits.filter((unit) => unit.baseUnitId),
    [inventoryUnits]
  );
  const selectedDisplayUnit = useMemo(
    () => inventoryUnits.find((unit) => unit.id === form.displayUnitId),
    [form.displayUnitId, inventoryUnits]
  );
  const selectedDisplayBaseUnit = useMemo(
    () => inventoryUnits.find((unit) => unit.id === (selectedDisplayUnit?.baseUnitId || selectedDisplayUnit?.id)),
    [inventoryUnits, selectedDisplayUnit]
  );
  const purchaseUnits = useMemo(
    () => units.filter((unit) => unit.isActive !== false),
    [units]
  );
  const selectedPurchaseUnit = useMemo(
    () => purchaseUnits.find((unit) => unit.id === form.purchaseUnitId),
    [form.purchaseUnitId, purchaseUnits]
  );
  const needsItemPurchaseRatio = Boolean(
    selectedPurchaseUnit
      && selectedPurchaseUnit.id !== form.baseUnitId
      && selectedPurchaseUnit.baseUnitId !== form.baseUnitId
  );

  const update = ({ target }) => {
    const value = target.type === "checkbox" ? target.checked : target.value;
    setForm((current) => ({ ...current, [target.name]: value }));
  };

  const updateTrackExpiry = ({ target }) => {
    setForm((current) => ({
      ...current,
      trackExpiry: target.checked,
      shelfLifeDays: target.checked && Number(current.shelfLifeDays || 0) < 1 ? 30 : current.shelfLifeDays,
      expiryWarningDays: target.checked && Number(current.shelfLifeDays || 0) < 1 ? 3 : current.expiryWarningDays
    }));
  };

  const updateShelfLifePreset = ({ target }) => {
    if (target.value === "custom") {
      setCustomShelfLife(true);
      return;
    }
    const days = Number(target.value);
    setCustomShelfLife(false);
    setForm((current) => ({
      ...current,
      shelfLifeDays: days,
      expiryWarningDays: Math.min(Number(current.expiryWarningDays || 0), days)
    }));
  };

  const setUnitMode = (mode) => {
    setForm((current) => ({
      ...current,
      baseUnitId: mode === "conversion" ? current.baseUnitId || baseUnits[0]?.id || "" : "",
      conversionFactor: mode === "conversion" ? Math.max(1, Number(current.conversionFactor || 1)) : 1,
      unitType: mode === "conversion" ? baseUnits.find((unit) => unit.id === (current.baseUnitId || baseUnits[0]?.id))?.unitType || current.unitType : current.unitType
    }));
  };

  const updateBaseUnit = ({ target }) => {
    const baseUnit = baseUnits.find((unit) => unit.id === target.value);
    setForm((current) => ({
      ...current,
      baseUnitId: target.value,
      unitType: baseUnit?.unitType || current.unitType
    }));
  };

  const updateItemDisplayUnit = ({ target }) => {
    const displayUnit = inventoryUnits.find((unit) => unit.id === target.value);
    const rootUnitId = displayUnit?.baseUnitId || displayUnit?.id || "";
    setForm((current) => ({
      ...current,
      displayUnitId: target.value,
      baseUnitId: rootUnitId,
      purchaseUnitId: displayUnit?.id || "",
      purchaseToBaseRatio: displayUnit?.baseUnitId ? displayUnit.conversionFactor : 1
    }));
  };

  const updateItemPurchaseUnit = ({ target }) => {
    setForm((current) => {
      const purchaseUnitId = target.value || current.displayUnitId;
      const purchaseUnit = units.find((unit) => unit.id === purchaseUnitId);
      return {
        ...current,
        purchaseUnitId,
        purchaseToBaseRatio: purchaseUnit?.id === current.baseUnitId
          ? 1
          : purchaseUnit?.baseUnitId === current.baseUnitId
            ? purchaseUnit.conversionFactor
            : ""
      };
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      let input = form;
      if (isUnits && !record) {
        input = { ...form, displayOrder: Math.max(0, ...units.map((unit) => Number(unit.displayOrder || 0))) + 10 };
      }
      if (isCategories && !record) {
        input = {
          ...form,
          code: createInventoryMasterDataCode(form.name, categories.map((category) => category.code)),
          displayOrder: Math.max(0, ...categories.map((category) => Number(category.displayOrder || 0))) + 10
        };
      }
      if (isSuppliers && !record) {
        input = {
          ...form,
          code: createInventoryMasterDataCode(`NCC_${form.name}`, existingRows.map((row) => row.code))
        };
      }
      if (isItems && !record && ["direct_sale", "tool"].includes(form.itemType)) {
        const prefix = form.itemType === "direct_sale" ? "BT" : "CCDC";
        input = {
          ...form,
          code: createInventoryMasterDataCode(`${prefix}_${form.name}`, existingRows.map((item) => item.code))
        };
      }
      await onSave({ id: record?.id || "", input });
      onClose(record ? `Đã cập nhật ${label}.` : `Đã tạo ${label} mới.`);
    } catch (saveError) {
      setError(saveError.message || `Không thể lưu ${label}.`);
    } finally {
      setSaving(false);
    }
  };

  const disabled = saving
    || !String(form.name || "").trim()
    || isItems && (!form.displayUnitId || !form.baseUnitId)
    || isItems && needsItemPurchaseRatio && Number(form.purchaseToBaseRatio || 0) <= 0
    || isItems && Number(form.maximumStock || 0) > 0 && Number(form.maximumStock || 0) < Number(form.minimumStock || 0)
    || isItems && (Number(form.defaultWastePercent || 0) < 0 || Number(form.defaultWastePercent || 0) > 100)
    || isItems && form.trackExpiry && (!Number.isFinite(Number(form.shelfLifeDays)) || Number(form.shelfLifeDays) < 1)
    || isItems && form.trackExpiry && (!Number.isFinite(Number(form.expiryWarningDays)) || Number(form.expiryWarningDays) < 0 || Number(form.expiryWarningDays) > Number(form.shelfLifeDays))
    || isConversionUnit && (!form.baseUnitId || Number(form.conversionFactor || 0) <= 0);

  return (
    <div className="inventory-modal-backdrop" role="presentation">
      <section className="inventory-warehouse-modal inventory-master-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-master-modal-title">
        <header>
          <div className="inventory-modal-heading">
            <span><Icon name={isItems ? "bag" : isSuppliers ? "user" : isUnits ? "tag" : "folder"} size={20} /></span>
            <div>
              <h2 id="inventory-master-modal-title">{record ? "Chỉnh sửa" : "Thêm"} {label}</h2>
              <p>Dữ liệu được kiểm tra trước khi ghi vào phân hệ Kho.</p>
            </div>
          </div>
          <button type="button" onClick={() => onClose()} aria-label="Đóng"><Icon name="close" size={18} /></button>
        </header>

        <div className="inventory-live-write-notice"><Icon name="warning" size={17} /><span>Thao tác này ghi vào Supabase Kho. Không làm thay đổi menu bán hàng hoặc tồn kho nếu chưa có chứng từ.</span></div>

        <form onSubmit={submit}>
          {isUnits ? (
            <div className="inventory-form-row inventory-form-row--paired full-field">
              <Field label="Tên đơn vị" required help="Ví dụ: Gram, Kg, Lít, Chai.">
                <span className="inventory-control-shell"><Icon name="tag" size={17} /><input name="name" value={form.name} onChange={update} placeholder="Nhập tên đơn vị..." autoFocus /></span>
              </Field>
              <Field label="Ký hiệu" help="Viết ngắn để hiển thị trong phiếu, ví dụ: g, kg, ml.">
                <span className="inventory-control-shell"><Icon name="tag" size={17} /><input name="symbol" value={form.symbol} onChange={update} placeholder="kg" /></span>
              </Field>
            </div>
          ) : isItems ? (
            <Field label="Tên nguyên vật liệu" required full help="Mã nguyên vật liệu được hệ thống tự sinh theo loại đã chọn.">
              <span className="inventory-control-shell"><Icon name="bag" size={17} /><input name="name" value={form.name} onChange={update} placeholder="Ví dụ: Bột mì, Nước suối chai..." autoFocus /></span>
            </Field>
          ) : isCategories ? (
            <Field label="Tên danh mục nguyên vật liệu" required full help="Mã quản lý và thứ tự hiển thị được hệ thống tự tạo.">
              <span className="inventory-control-shell"><Icon name="folder" size={17} /><input name="name" value={form.name} onChange={update} placeholder="Ví dụ: Gia vị và sốt nêm" autoFocus /></span>
            </Field>
          ) : (
            <Field label={`Tên ${label}`} required full help="Mã nhà cung cấp được hệ thống tự sinh; khi chỉnh sửa vẫn giữ nguyên mã cũ.">
              <span className="inventory-control-shell"><Icon name="user" size={17} /><input name="name" value={form.name} onChange={update} placeholder={`Nhập tên ${label}...`} autoFocus /></span>
            </Field>
          )}

          {isUnits ? (
            <>
              <div className="inventory-unit-mode full-field">
                <span className="inventory-field-label">Đơn vị này là</span>
                <div className="inventory-unit-mode__choices">
                  <button type="button" className={!isConversionUnit ? "is-active" : ""} onClick={() => setUnitMode("base")}><Icon name="check" size={17} /><span><strong>Đơn vị gốc</strong><small>Kho lưu tồn trực tiếp bằng đơn vị này.</small></span></button>
                  <button type="button" className={isConversionUnit ? "is-active" : ""} disabled={!baseUnits.length} onClick={() => setUnitMode("conversion")}><Icon name="refresh" size={17} /><span><strong>Đơn vị quy đổi</strong><small>Chỉ dùng để nhập liệu và hiển thị.</small></span></button>
                </div>
                {!baseUnits.length ? <small className="inventory-plain-help">Hãy tạo ít nhất một đơn vị gốc trước khi khai đơn vị quy đổi.</small> : null}
              </div>

              {isConversionUnit ? (
                <div className="inventory-conversion-box full-field">
                  <div className="inventory-form-row inventory-form-row--paired">
                    <Field label="1 đơn vị này bằng" required><span className="inventory-control-shell"><input type="number" min="0.000001" step="any" name="conversionFactor" value={form.conversionFactor} onChange={update} /></span></Field>
                    <Field label="Đơn vị gốc" required><span className="inventory-control-shell inventory-control-shell--select"><Icon name="tag" size={17} /><InventorySearchableSelect name="baseUnitId" value={form.baseUnitId} onChange={updateBaseUnit}><option value="">Chọn đơn vị gốc</option>{baseUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}{unit.symbol ? ` (${unit.symbol})` : ""}</option>)}</InventorySearchableSelect></span></Field>
                  </div>
                  <div className="inventory-conversion-quick"><span>Chọn nhanh:</span>{[1000, 100, 48, 30, 24, 12, 10, 6].map((value) => <button key={value} type="button" onClick={() => setForm((current) => ({ ...current, conversionFactor: value }))}>{value}</button>)}</div>
                </div>
              ) : null}

            </>
          ) : null}

          {isCategories ? (
            <Field label="Mô tả" help="Không bắt buộc. Viết ngắn để nhân viên phân loại đúng." full><span className="inventory-control-shell"><Icon name="note" size={17} /><input name="description" value={form.description} onChange={update} placeholder="Ví dụ: Gia vị khô và sốt nêm..." /></span></Field>
          ) : null}

          {isSuppliers ? (
            <>
              <div className="inventory-form-row inventory-form-row--paired full-field">
                <Field label="Người liên hệ"><span className="inventory-control-shell"><Icon name="user" size={17} /><input name="contactName" value={form.contactName} onChange={update} /></span></Field>
                <Field label="Điện thoại"><span className="inventory-control-shell"><Icon name="phone" size={17} /><input name="phone" value={form.phone} onChange={update} /></span></Field>
              </div>
              <div className="inventory-form-row inventory-form-row--paired full-field">
                <Field label="Email"><span className="inventory-control-shell"><Icon name="mail" size={17} /><input type="email" name="email" value={form.email} onChange={update} /></span></Field>
                <Field label="Địa chỉ"><span className="inventory-control-shell"><Icon name="home" size={17} /><input name="address" value={form.address} onChange={update} /></span></Field>
              </div>
              <Field label="Ghi chú thanh toán" full><span className="inventory-control-shell"><Icon name="note" size={17} /><input name="paymentNotes" value={form.paymentNotes} onChange={update} placeholder="Công nợ, thời hạn thanh toán..." /></span></Field>
            </>
          ) : null}

          {isItems ? (
            <>
              <div className="inventory-form-row inventory-form-row--triple full-field">
                <Field label="Loại nguyên vật liệu" required help="Quyết định cách sử dụng và mã tự sinh."><span className="inventory-control-shell inventory-control-shell--select"><Icon name="bag" size={17} /><InventorySearchableSelect name="itemType" value={form.itemType} onChange={update}><option value="ingredient">Nguyên liệu · NVL</option><option value="semi_finished">Bán thành phẩm · BTP</option><option value="finished_good">Thành phẩm · TP</option><option value="direct_sale">Bán thẳng · BT</option><option value="packaging">Bao bì · BB</option><option value="consumable">Vật tư tiêu hao · VT</option><option value="tool">Công cụ, dụng cụ · CCDC</option></InventorySearchableSelect></span></Field>
                <Field label="Danh mục NVL"><span className="inventory-control-shell inventory-control-shell--select"><Icon name="folder" size={17} /><InventorySearchableSelect name="groupId" value={form.groupId} onChange={update}><option value="">Chưa phân nhóm</option>{categories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</InventorySearchableSelect></span></Field>
                <Field label="Hao hụt mặc định (%)" help="Dùng gợi ý cho bán thẳng và BOM; hao hụt thực tế ghi riêng."><span className="inventory-control-shell"><input type="number" min="0" max="100" step="0.01" name="defaultWastePercent" value={form.defaultWastePercent} onChange={update} /></span></Field>
              </div>
              {Number(form.defaultWastePercent || 0) < 0 || Number(form.defaultWastePercent || 0) > 100 ? <p className="inventory-form-error full-field">Hao hụt mặc định phải nằm trong khoảng từ 0% đến 100%.</p> : null}
              <div className="inventory-form-row inventory-form-row--paired full-field">
                <Field label="Đơn vị hiển thị" required help="Có thể chọn Kg hoặc Gram. Kho tự quy đổi và lưu bằng đơn vị gốc."><span className="inventory-control-shell inventory-control-shell--select"><Icon name="tag" size={17} /><InventorySearchableSelect name="displayUnitId" value={form.displayUnitId} onChange={updateItemDisplayUnit}><option value="">Chọn đơn vị hiển thị</option>{inventoryConversionUnits.length ? <optgroup label="Đơn vị quy đổi">{inventoryConversionUnits.map((row) => { const root = inventoryBaseUnits.find((unit) => unit.id === row.baseUnitId); return <option key={row.id} value={row.id}>{row.name}{row.symbol ? ` (${row.symbol})` : ""} — 1 = {row.conversionFactor} {root?.name || "đơn vị gốc"}</option>; })}</optgroup> : null}<optgroup label="Đơn vị gốc">{inventoryBaseUnits.map((row) => <option key={row.id} value={row.id}>{row.name}{row.symbol ? ` (${row.symbol})` : ""} — kho lưu trực tiếp</option>)}</optgroup></InventorySearchableSelect></span></Field>
                <Field label="Đơn vị mua / nhập" help="Có thể chọn Chai, Hộp, Thùng hoặc đơn vị quy đổi đã tạo."><span className="inventory-control-shell inventory-control-shell--select"><Icon name="tag" size={17} /><InventorySearchableSelect name="purchaseUnitId" value={form.purchaseUnitId} onChange={updateItemPurchaseUnit} disabled={!form.displayUnitId}><option value="">Giống đơn vị hiển thị</option>{purchaseUnits.map((row) => <option key={row.id} value={row.id}>{row.name}{row.symbol ? ` (${row.symbol})` : ""}</option>)}</InventorySearchableSelect></span></Field>
              </div>
              {needsItemPurchaseRatio ? (
                <Field
                  label="Quy đổi đơn vị nhập"
                  required
                  full
                  help={`Tỷ lệ này chỉ áp dụng cho ${form.name || "nguyên vật liệu này"}; không làm thay đổi đơn vị ${selectedPurchaseUnit?.name || "đã chọn"} ở mặt hàng khác.`}
                >
                  <div className="inventory-item-purchase-ratio">
                    <span>1 <strong>{selectedPurchaseUnit?.symbol || selectedPurchaseUnit?.name}</strong> =</span>
                    <span className="inventory-control-shell inventory-control-shell--suffix">
                      <input
                        type="number"
                        min="0.000001"
                        step="any"
                        name="purchaseToBaseRatio"
                        value={form.purchaseToBaseRatio}
                        onChange={update}
                        placeholder="Ví dụ: 500"
                        aria-label={`Một ${selectedPurchaseUnit?.name || "đơn vị nhập"} bằng bao nhiêu ${selectedDisplayBaseUnit?.name || "đơn vị tồn kho"}`}
                      />
                      <b>{selectedDisplayBaseUnit?.symbol || selectedDisplayBaseUnit?.name || "đơn vị gốc"}</b>
                    </span>
                  </div>
                  {Number(form.purchaseToBaseRatio || 0) <= 0 ? <p className="inventory-form-error">Nhập số lượng quy đổi lớn hơn 0.</p> : null}
                </Field>
              ) : null}
              {selectedDisplayUnit ? <div className="inventory-item-storage-summary full-field"><Icon name="refresh" size={18} /><span>Kho lưu: <strong>{selectedDisplayUnit.baseUnitId ? `1 ${selectedDisplayUnit.symbol || selectedDisplayUnit.name} = ${selectedDisplayUnit.conversionFactor} ${selectedDisplayBaseUnit?.name || "đơn vị gốc"}` : selectedDisplayUnit.name}</strong></span><small>{selectedDisplayUnit.baseUnitId ? "Đơn vị hiển thị được tự động quy về đơn vị gốc." : "Đây là đơn vị gốc, kho lưu trực tiếp không cần quy đổi."}</small></div> : null}
              <section className="inventory-item-stock-config full-field" aria-labelledby="inventory-item-stock-config-title">
                <div className="inventory-item-stock-config__head">
                  <Icon name="warning" size={16} />
                  <h4 id="inventory-item-stock-config-title">Cấu hình tồn kho</h4>
                </div>
                <div className="inventory-item-stock-config__body">
                  <p>Chỉ <strong>Điểm đặt hàng lại</strong> sinh cảnh báo. Hai mức tồn dùng để kiểm kê và gợi ý nhập hàng.</p>
                  <div className="inventory-form-row inventory-form-row--quad">
                    <Field label="Điểm đặt hàng lại" help="Chạm mức này sẽ nhắc nhập; 0 = không cảnh báo."><span className="inventory-control-shell"><input type="number" min="0" step="any" name="reorderPoint" value={form.reorderPoint} onChange={update} /></span></Field>
                    <Field label="Số lượng đặt hàng" help="Số lượng nên mua mỗi lần."><span className="inventory-control-shell"><input type="number" min="0" step="any" name="orderQuantity" value={form.orderQuantity} onChange={update} /></span></Field>
                    <Field label="Tồn tối thiểu" help="Mức tồn an toàn khi kiểm kê."><span className="inventory-control-shell"><input type="number" min="0" step="any" name="minimumStock" value={form.minimumStock} onChange={update} /></span></Field>
                    <Field label="Tồn tối đa" help="Mức trữ tối đa; 0 = chưa giới hạn."><span className="inventory-control-shell"><input type="number" min="0" step="any" name="maximumStock" value={form.maximumStock} onChange={update} /></span></Field>
                  </div>
                  {Number(form.maximumStock || 0) > 0 && Number(form.maximumStock || 0) < Number(form.minimumStock || 0) ? <p className="inventory-form-error">Tồn tối đa phải bằng 0 hoặc lớn hơn tồn tối thiểu.</p> : null}
                </div>
              </section>
              <section className={`inventory-item-expiry-config full-field${form.trackExpiry ? " is-enabled" : ""}`} aria-labelledby="inventory-item-expiry-config-title">
                <div className="inventory-item-expiry-config__head">
                  <span className="inventory-item-expiry-config__icon"><Icon name="clock" size={18} /></span>
                  <span className="inventory-setting-copy">
                    <strong id="inventory-item-expiry-config-title">Theo dõi hạn sử dụng</strong>
                    <small>Nhắc kiểm tra các lô sắp hết hạn khi nhập và xuất kho.</small>
                  </span>
                  <label className="inventory-switch" aria-label="Theo dõi hạn sử dụng">
                    <input type="checkbox" name="trackExpiry" checked={form.trackExpiry} onChange={updateTrackExpiry} />
                    <span aria-hidden="true" />
                  </label>
                </div>
                {form.trackExpiry ? (
                  <div className="inventory-item-expiry-config__fields">
                    <Field label="Thời hạn mặc định" required help="Dùng để gợi ý khi lập phiếu nhập; có thể sửa theo từng lô.">
                      <div className="inventory-expiry-duration-control">
                        <span className="inventory-control-shell inventory-control-shell--select">
                          <InventorySearchableSelect value={customShelfLife ? "custom" : String(form.shelfLifeDays)} onChange={updateShelfLifePreset} aria-label="Chọn thời hạn mặc định">
                            <option value="1">1 ngày</option>
                            <option value="3">3 ngày</option>
                            <option value="7">7 ngày</option>
                            <option value="14">14 ngày</option>
                            <option value="30">30 ngày (1 tháng)</option>
                            <option value="60">60 ngày (2 tháng)</option>
                            <option value="90">90 ngày (3 tháng)</option>
                            <option value="custom">Tùy chỉnh...</option>
                          </InventorySearchableSelect>
                        </span>
                        {customShelfLife ? <span className="inventory-control-shell inventory-control-shell--suffix"><input type="number" min="1" step="1" name="shelfLifeDays" value={form.shelfLifeDays} onChange={update} aria-label="Số ngày sử dụng tùy chỉnh" /><b>ngày</b></span> : null}
                      </div>
                    </Field>
                    <Field label="Cảnh báo trước khi hết hạn" help="Để 0 nếu chỉ muốn báo khi lô đã quá hạn.">
                      <div className="inventory-expiry-warning-control">
                        <span className="inventory-control-shell inventory-control-shell--suffix"><input type="number" min="0" max={form.shelfLifeDays} step="1" name="expiryWarningDays" value={form.expiryWarningDays} onChange={update} /><b>ngày</b></span>
                        <span className="inventory-expiry-warning-presets" aria-label="Chọn nhanh số ngày cảnh báo">
                          {EXPIRY_WARNING_PRESETS.map((days) => <button type="button" key={days} disabled={days > Number(form.shelfLifeDays || 0)} className={Number(form.expiryWarningDays) === days ? "is-active" : ""} onClick={() => setForm((current) => ({ ...current, expiryWarningDays: days }))}>{days}</button>)}
                        </span>
                      </div>
                    </Field>
                  </div>
                ) : null}
                {form.trackExpiry && Number(form.shelfLifeDays) < 1 ? <p className="inventory-form-error">Thời hạn sử dụng phải từ 1 ngày trở lên.</p> : null}
                {form.trackExpiry && (Number(form.expiryWarningDays) < 0 || Number(form.expiryWarningDays) > Number(form.shelfLifeDays)) ? <p className="inventory-form-error">Số ngày cảnh báo phải từ 0 đến thời hạn sử dụng.</p> : null}
              </section>
              <Field label="Ghi chú" full><span className="inventory-control-shell"><Icon name="note" size={17} /><input name="notes" value={form.notes} onChange={update} /></span></Field>
            </>
          ) : null}

          {record || isSuppliers || isItems ? <label className="inventory-stock-setting full-field">
            <span className="inventory-setting-icon"><Icon name="check" size={19} /></span>
            <span className="inventory-setting-copy"><strong>Đang sử dụng</strong><small>Tắt khi muốn ngừng chọn dữ liệu này cho nghiệp vụ mới, nhưng vẫn giữ lịch sử cũ.</small></span>
            <span className="inventory-switch"><input type="checkbox" name="isActive" checked={form.isActive} onChange={update} /><span aria-hidden="true" /></span>
          </label> : null}

          {error ? <p className="inventory-form-error full-field">{error}</p> : null}
          <footer className="full-field"><button type="button" onClick={() => onClose()}>Huỷ</button><button type="submit" disabled={disabled}><Icon name="check" size={17} />{saving ? "Đang lưu..." : record ? "Lưu thay đổi" : "Tạo mới"}</button></footer>
        </form>
      </section>
    </div>
  );
}
