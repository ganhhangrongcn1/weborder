const formatQuantity = (value) => Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 6 });

function ThresholdPair({ title, value, onChange, unitLabel, fallbackTarget = 0 }) {
  const alertLevel = Math.max(Number(value.minimumStock || 0), Number(value.reorderPoint || 0));
  const target = value.targetStock ?? fallbackTarget;
  const legacyExclusive = Number(value.minimumStock || 0) > Number(value.reorderPoint || 0);
  return <><div className="inventory-form-row inventory-form-row--paired">
    {[["reorderPoint", "Báo sắp hết khi còn ≤"], ["targetStock", "Mức tồn mong muốn"]].map(([key, label]) => (
      <label className="inventory-form-field" key={key}>
        <span className="inventory-field-label">{label}</span>
        <span className="inventory-control-shell inventory-control-shell--suffix">
          <input type="number" min="0" step="any" required value={key === "reorderPoint" ? alertLevel : target} aria-label={`${title} · ${label}`} onChange={(event) => onChange({ ...value, ...(key === "reorderPoint" ? { minimumStock: 0 } : {}), [key]: event.target.value })} />
          <b>{unitLabel}</b>
        </span>
      </label>
    ))}
  </div>
    {legacyExclusive ? <small>Cấu hình cũ: báo khi tồn dưới {formatQuantity(alertLevel)} {unitLabel}. Giữ nguyên nếu chưa sửa ô cảnh báo; khi sửa sẽ áp dụng “bằng hoặc thấp hơn”.</small> : null}
    <small>{Number(target) > 0
      ? `Còn ${formatQuantity(alertLevel)} ${unitLabel} → cần thêm ${formatQuantity(Math.max(0, Number(target) - alertLevel))} ${unitLabel} để đủ ${formatQuantity(target)} ${unitLabel} (chưa tính hàng đang chờ nhận).`
      : "Chưa đặt mức tồn mong muốn: nhân viên nhập số lượng khi tạo yêu cầu."}</small>
    {Number(target) > 0 && Number(target) <= alertLevel ? <small>Nên đặt mức tồn mong muốn lớn hơn mức cảnh báo.</small> : null}
  </>;
}

export default function InventoryStockThresholdFields({ form, setForm, warehouses, unitLabel }) {
  const central = { minimumStock: form.minimumStock, reorderPoint: form.reorderPoint, targetStock: form.maximumStock };
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
      <ThresholdPair title="Kho Tổng" value={central} unitLabel={unitLabel} onChange={(value) => setForm((current) => ({ ...current, minimumStock: value.minimumStock, reorderPoint: value.reorderPoint, maximumStock: value.targetStock }))} />
    </div>
    <div className="inventory-stock-thresholds__group">
      <strong>Chi nhánh</strong>
      <label className="inventory-stock-thresholds__toggle">
        <input type="checkbox" checked={!settings.branch} onChange={(event) => updateSettings({ ...settings, branch: event.target.checked ? null : { ...central } })} />
        <span>Dùng chung mức Kho Tổng</span>
      </label>
      {settings.branch ? <ThresholdPair title="Mặc định chi nhánh" value={branch} fallbackTarget={form.maximumStock} unitLabel={unitLabel} onChange={(value) => updateSettings({ ...settings, branch: value })} />
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
          {overrides[warehouse.id] ? <ThresholdPair title={warehouse.name} value={overrides[warehouse.id]} fallbackTarget={form.maximumStock} unitLabel={unitLabel} onChange={(value) => updateOverride(warehouse.id, value)} /> : <small>Dùng mức mặc định cho chi nhánh</small>}
        </div>
      )) : <small>Chưa có kho chi nhánh thuộc phạm vi sử dụng của nguyên vật liệu này.</small>}
    </details>
    <small>Hệ thống gợi ý nhập thêm để tồn kho đạt mức tồn mong muốn, đã tính hàng đang chờ nhận. Mức tồn mong muốn bằng 0: để nhân viên nhập số lượng. Cảnh báo bằng 0: chỉ báo hết hàng hoặc tồn âm.</small>
  </div>;
}
