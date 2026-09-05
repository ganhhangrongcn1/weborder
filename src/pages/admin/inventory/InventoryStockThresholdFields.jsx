function ThresholdPair({ title, value, onChange, unitLabel }) {
  return <div className="inventory-form-row inventory-form-row--paired">
    {[["reorderPoint", "Điểm nhắc nhập hàng"], ["minimumStock", "Tồn tối thiểu"]].map(([key, label]) => (
      <label className="inventory-form-field" key={key}>
        <span className="inventory-field-label">{label}</span>
        <span className="inventory-control-shell inventory-control-shell--suffix">
          <input type="number" min="0" step="any" required value={value[key]} aria-label={`${title} · ${label}`} onChange={(event) => onChange({ ...value, [key]: event.target.value })} />
          <b>{unitLabel}</b>
        </span>
      </label>
    ))}
  </div>;
}

export default function InventoryStockThresholdFields({ form, setForm, warehouses, unitLabel }) {
  const central = { minimumStock: form.minimumStock, reorderPoint: form.reorderPoint };
  const settings = form.stockThresholds || { branch: null, warehouses: {} };
  const branch = settings.branch || central;
  const overrides = settings.warehouses || {};
  const branchWarehouses = warehouses.filter((warehouse) => warehouse.warehouseType === "branch"
    && (!form.warehouseIds.length || form.warehouseIds.includes(warehouse.id)));
  const updateSettings = (next) => setForm((current) => ({ ...current, stockThresholds: next }));
  const updateOverride = (id, value) => {
    const next = { ...overrides };
    if (value) next[id] = value;
    else delete next[id];
    updateSettings({ ...settings, warehouses: next });
  };

  return <div className="inventory-stock-thresholds">
    <div className="inventory-stock-thresholds__group">
      <strong>Kho Tổng</strong>
      <ThresholdPair title="Kho Tổng" value={central} unitLabel={unitLabel} onChange={(value) => setForm((current) => ({ ...current, ...value }))} />
    </div>
    <div className="inventory-stock-thresholds__group">
      <strong>Mặc định cho các chi nhánh</strong>
      <label className="inventory-stock-thresholds__toggle">
        <input type="checkbox" checked={!settings.branch} onChange={(event) => updateSettings({ ...settings, branch: event.target.checked ? null : { ...central } })} />
        <span>Dùng cùng mức với Kho Tổng</span>
      </label>
      {settings.branch ? <ThresholdPair title="Mặc định chi nhánh" value={branch} unitLabel={unitLabel} onChange={(value) => updateSettings({ ...settings, branch: value })} />
        : <small>Chưa đặt mức riêng: chi nhánh dùng ngưỡng của Kho Tổng. Bỏ chọn để nhập mức thấp hơn cho chi nhánh.</small>}
    </div>
    <details className="inventory-stock-thresholds__group">
      <summary>Thiết lập riêng từng chi nhánh</summary>
      <p>Chỉ bật ở chi nhánh cần mức khác. Tắt để dùng lại mức mặc định cho chi nhánh.</p>
      {branchWarehouses.length ? branchWarehouses.map((warehouse) => (
        <div key={warehouse.id} className="inventory-stock-thresholds__warehouse">
          <label className="inventory-stock-thresholds__toggle">
            <input type="checkbox" checked={Boolean(overrides[warehouse.id])} onChange={(event) => updateOverride(warehouse.id, event.target.checked ? { ...branch } : null)} />
            <strong>{warehouse.name}</strong>
          </label>
          {overrides[warehouse.id] ? <ThresholdPair title={warehouse.name} value={overrides[warehouse.id]} unitLabel={unitLabel} onChange={(value) => updateOverride(warehouse.id, value)} /> : <small>Dùng mức mặc định cho chi nhánh</small>}
        </div>
      )) : <small>Chưa có kho chi nhánh thuộc phạm vi sử dụng của nguyên vật liệu này.</small>}
    </details>
    <small>Điểm nhắc nhập: cảnh báo khi tồn bằng hoặc thấp hơn mức đặt. Tồn tối thiểu: cảnh báo khi tồn thấp hơn mức đặt. Để cả hai bằng 0 nếu chỉ cần cảnh báo hết hàng hoặc tồn âm.</small>
  </div>;
}
