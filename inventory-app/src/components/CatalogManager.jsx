import { CheckCircle, Package, Plus, Storefront, Truck } from "@phosphor-icons/react";
import { useState } from "react";

const TYPES = {
  item: { title: "Thêm hàng hóa", label: "Hàng hóa" },
  supplier: { title: "Thêm nhà cung cấp", label: "Nhà cung cấp" },
  warehouse: { title: "Thêm kho hoặc chi nhánh", label: "Kho và chi nhánh" }
};

const INITIAL = {
  item: { code: "", name: "", itemType: "ingredient", groupId: "", baseUnitId: "", minimumStock: "", notes: "" },
  supplier: { code: "", name: "", contactName: "", phone: "", address: "", paymentNotes: "" },
  warehouse: { code: "", name: "", warehouseType: "branch", address: "", supplyWarehouseId: "", allowsDirectReceipt: false }
};

function CatalogForm({ type, data, onClose, onCreate }) {
  const [form, setForm] = useState({ ...INITIAL[type] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = ({ target }) => setForm((current) => ({
    ...current,
    [target.name]: target.type === "checkbox" ? target.checked : target.value
  }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return setError("Vui lòng nhập mã và tên.");
    if (type === "item" && !form.baseUnitId) return setError("Vui lòng chọn đơn vị tính cơ bản.");
    setSaving(true);
    setError("");
    try {
      await onCreate(type, form);
      onClose(`${TYPES[type].label} đã được thêm.`);
    } catch (saveError) {
      setError(saveError.message || "Chưa thể lưu dữ liệu. Anh thử lại giúp em.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <section className="catalog-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-form-title">
        <div className="modal-heading">
          <div><p className="eyebrow">Tạo mới</p><h2 id="catalog-form-title">{TYPES[type].title}</h2></div>
          <button type="button" className="modal-close" onClick={() => onClose()} aria-label="Đóng">×</button>
        </div>
        <form className="catalog-form" onSubmit={submit}>
          <label>Mã <input name="code" value={form.code} onChange={update} placeholder="VD: CN-04" autoFocus /></label>
          <label>Tên <input name="name" value={form.name} onChange={update} placeholder="Tên dễ nhận biết" /></label>
          {type === "warehouse" && <>
            <label>Loại kho<select name="warehouseType" value={form.warehouseType} onChange={update}><option value="central">Kho trung tâm</option><option value="branch">Chi nhánh</option><option value="mobile">Xe đẩy mini</option><option value="other">Kho khác</option></select></label>
            <label>Kho cấp hàng<select name="supplyWarehouseId" value={form.supplyWarehouseId} onChange={update}><option value="">Chưa thiết lập</option>{data.warehouses.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            <label className="full-field">Địa chỉ<input name="address" value={form.address} onChange={update} /></label>
            <label className="check-field full-field"><input type="checkbox" name="allowsDirectReceipt" checked={form.allowsDirectReceipt} onChange={update} /> Cho phép nhận hàng trực tiếp từ nhà cung cấp</label>
          </>}
          {type === "supplier" && <>
            <label>Người liên hệ<input name="contactName" value={form.contactName} onChange={update} /></label>
            <label>Số điện thoại<input name="phone" value={form.phone} onChange={update} inputMode="tel" /></label>
            <label className="full-field">Địa chỉ<input name="address" value={form.address} onChange={update} /></label>
            <label className="full-field">Ghi chú thanh toán<input name="paymentNotes" value={form.paymentNotes} onChange={update} /></label>
          </>}
          {type === "item" && <>
            <label>Phân loại<select name="itemType" value={form.itemType} onChange={update}><option value="ingredient">Nguyên liệu</option><option value="finished_good">Thành phẩm</option><option value="packaging">Bao bì</option><option value="other">Khác</option></select></label>
            <label>Nhóm hàng<select name="groupId" value={form.groupId} onChange={update}><option value="">Chưa phân nhóm</option>{data.groups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            <label>Đơn vị tính<select name="baseUnitId" value={form.baseUnitId} onChange={update}><option value="">Chọn đơn vị</option>{data.units.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.code})</option>)}</select></label>
            <label>Tồn tối thiểu<input type="number" min="0" step="0.01" name="minimumStock" value={form.minimumStock} onChange={update} /></label>
            <label className="full-field">Ghi chú<input name="notes" value={form.notes} onChange={update} /></label>
          </>}
          {error ? <p className="form-error full-field">{error}</p> : null}
          <div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => onClose()}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button></div>
        </form>
      </section>
    </div>
  );
}

export default function CatalogManager({ data, onCreate }) {
  const [type, setType] = useState("");
  const [notice, setNotice] = useState("");
  const open = (nextType) => { setNotice(""); setType(nextType); };
  const close = (message = "") => { setType(""); setNotice(message); };
  const rows = [
    { type: "item", icon: Package, name: "Hàng hóa", count: data.items.length, detail: "Nguyên liệu, thành phẩm, bao bì và đơn vị tính" },
    { type: "supplier", icon: Truck, name: "Nhà cung cấp", count: data.suppliers.length, detail: "Liên hệ, địa chỉ và điều khoản thanh toán" },
    { type: "warehouse", icon: Storefront, name: "Kho và chi nhánh", count: data.warehouses.length, detail: "Kho trung tâm, cửa hàng và xe đẩy mini" }
  ];
  return <>
    {notice ? <div className="success-banner"><CheckCircle weight="fill" />{notice}</div> : null}
    <section className="panel catalog-list">
      <div className="catalog-list-head"><span>Danh mục</span><span>Số lượng</span><span>Thao tác</span></div>
      {rows.map(({ type: rowType, icon: Icon, name, count, detail }) => (
        <article className="catalog-row" key={rowType}>
          <span className="catalog-icon"><Icon size={21} /></span>
          <span className="catalog-name"><strong>{name}</strong><small>{detail}</small></span>
          <strong className="catalog-count">{count}</strong>
          <button className="secondary-button" onClick={() => open(rowType)}><Plus weight="bold" /> Thêm mới</button>
        </article>
      ))}
    </section>
    {type ? <CatalogForm type={type} data={data} onClose={close} onCreate={onCreate} /> : null}
  </>;
}
