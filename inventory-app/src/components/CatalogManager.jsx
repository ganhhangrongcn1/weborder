import {
  ArrowsLeftRight,
  Buildings,
  CheckCircle,
  DownloadSimple,
  Flask,
  Package,
  Plus,
  Ruler,
  Storefront,
  Tag,
  Truck,
  UploadSimple,
  Users,
  WarningCircle
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { getInventoryStatus } from "../utils/inventoryNorms.js";
import "./catalog-manager.css";

const SECTIONS = [
  { id: "item", label: "Hàng hóa", icon: Package, ready: true },
  { id: "group", label: "Nhóm hàng hóa", icon: Tag, ready: true },
  { id: "unit", label: "Đơn vị tính", icon: Ruler, ready: true },
  { id: "conversion", label: "Quy đổi đơn vị tính", icon: ArrowsLeftRight },
  { id: "preRecipe", label: "Công thức sơ chế", icon: Flask },
  { id: "recipe", label: "Công thức chế biến", icon: Flask },
  { id: "warehouse", label: "Kho hàng", icon: Buildings, ready: true },
  { id: "customer", label: "Khách hàng", icon: Users },
  { id: "supplier", label: "Nhà cung cấp", icon: Truck, ready: true },
  { id: "supplierGroup", label: "Nhóm nhà cung cấp", icon: Storefront },
  { id: "price", label: "Bảng giá", icon: Tag },
  { id: "reason", label: "Lý do", icon: WarningCircle },
  { id: "norm", label: "Định mức tồn kho", icon: CheckCircle, ready: true, canCreate: false }
];

const INITIAL = {
  item: { name: "", itemType: "", groupId: "", baseUnitId: "", purchaseUnitId: "", purchaseToBaseRatio: "1", description: "", tracksInventory: false },
  supplier: { code: "", name: "", contactName: "", phone: "", address: "", paymentNotes: "" },
  warehouse: { code: "", name: "", warehouseType: "branch", address: "", supplyWarehouseId: "", allowsDirectReceipt: false },
  unit: { code: "", name: "", description: "" },
  group: { name: "", description: "" }
};

const ITEM_TYPE_DESCRIPTIONS = {
  ingredient: "Nguyên liệu dùng để chế biến ra sản phẩm bán cho khách hàng, ví dụ bánh tráng, thịt, sốt hoặc gia vị.",
  finished_good: "Sản phẩm hoàn chỉnh bán trực tiếp cho khách hàng, ví dụ một phần bánh tráng trộn đã hoàn thiện.",
  semi_finished: "Hàng hóa tạo ra sau một công đoạn chế biến và tiếp tục được dùng để làm món bán, ví dụ sốt nền hoặc trân châu đã nấu.",
  direct_sale: "Hàng mua về và bán trực tiếp, không qua chế biến, ví dụ nước đóng chai hoặc bia.",
  other: "Công cụ, dụng cụ và vật tư phục vụ vận hành như bàn ghế, xoong nồi hoặc thiết bị nhỏ.",
  note: "Lựa chọn hoặc ghi chú phục vụ pha chế nhưng không có tính chất quản lý tồn kho."
};

const TITLES = {
  item: "Thêm hàng hóa",
  supplier: "Thêm nhà cung cấp",
  warehouse: "Thêm kho hàng",
  unit: "Thêm đơn vị tính",
  group: "Thêm nhóm hàng hóa"
};

function SearchableUnitSelect({ units, value, onChange, placeholder = "Chọn đơn vị tính", required = false }) {
  const selected = units.find((unit) => unit.id === value);
  const [query, setQuery] = useState(selected ? `${selected.name} (${selected.code})` : "");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi");
    if (!keyword || selected && query === `${selected.name} (${selected.code})`) return units.slice(0, 50);
    return units.filter((unit) => `${unit.code} ${unit.name}`.toLocaleLowerCase("vi").includes(keyword)).slice(0, 50);
  }, [query, selected, units]);

  const choose = (unit) => {
    setQuery(`${unit.name} (${unit.code})`);
    setOpen(false);
    onChange(unit.id);
  };

  return <div className="searchable-unit-select">
    <div className="searchable-unit-input">
      <input
        role="combobox"
        aria-expanded={open}
        aria-required={required}
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); onChange(""); }}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
      />
      <span aria-hidden="true">⌄</span>
    </div>
    {open ? <div className="searchable-unit-options" role="listbox">
      {filtered.map((unit) => <button type="button" role="option" aria-selected={unit.id === value} key={unit.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(unit)}><strong>{unit.name}</strong><small>{unit.code}</small></button>)}
      {!filtered.length ? <p>Không tìm thấy đơn vị tính.</p> : null}
    </div> : null}
  </div>;
}

function CreateForm({ type, data, onClose, onCreate }) {
  const [form, setForm] = useState({ ...INITIAL[type] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = ({ target }) => setForm((current) => ({ ...current, [target.name]: target.type === "checkbox" ? target.checked : target.value }));
  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return setError("Vui lòng nhập tên.");
    if (!["group", "item"].includes(type) && !form.code.trim()) return setError("Vui lòng nhập mã.");
    if (type === "item" && !form.itemType) return setError("Vui lòng chọn loại hàng.");
    if (type === "item" && !form.baseUnitId) return setError("Vui lòng chọn đơn vị tính cơ bản.");
    setSaving(true);
    setError("");
    try {
      await onCreate(type, form);
      onClose("Dữ liệu đã được thêm vào danh mục.");
    } catch (saveError) {
      setError(saveError.message || "Chưa thể lưu dữ liệu. Anh thử lại giúp em.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop drawer-backdrop">
      <section className={`catalog-modal catalog-drawer ${type === "group" ? "group-catalog-modal" : type === "item" ? "item-catalog-modal" : type === "unit" ? "unit-catalog-modal" : ""}`} role="dialog" aria-modal="true" aria-labelledby="catalog-form-title">
        <div className="modal-heading"><div><p className="eyebrow">Tạo mới</p><h2 id="catalog-form-title">{TITLES[type]}</h2></div><button type="button" className="modal-close" onClick={() => onClose()} aria-label="Đóng">×</button></div>
        <form className="catalog-form" onSubmit={submit}>
          {type === "group" ? <h3 className="group-form-section-title full-field">Thông tin chung</h3> : null}
          {!["group", "item"].includes(type) ? <label className={type === "unit" ? "full-field" : ""}>Mã{type === "unit" ? <span className="required-mark">*</span> : null} <input name="code" value={form.code} onChange={update} placeholder={type === "unit" ? "Nhập mã đơn vị tính" : "VD: NVL-001"} autoFocus /></label> : <label className="full-field">{type === "group" ? "Mã nhóm" : "Mã hàng"}<input value="Mã sinh tự động" disabled readOnly /></label>}
          {type !== "unit" ? <label className={type === "group" ? "full-field" : ""}>Tên{["group", "item"].includes(type) ? <span className="required-mark">*</span> : null} <input name="name" value={form.name} onChange={update} placeholder="Tên dễ nhận biết" autoFocus={type === "group"} /></label> : null}
          {type === "group" ? <label className="full-field">Mô tả<textarea name="description" value={form.description} onChange={update} placeholder="Nhập mô tả nhóm hàng hóa" rows="4" /></label> : null}
          {type === "item" && <>
            <h3 className="group-form-section-title full-field">Thông tin chung</h3>
            <label>Loại hàng<span className="required-mark">*</span><select name="itemType" value={form.itemType} onChange={update}><option value="">Chọn loại hàng</option><option value="ingredient">Nguyên vật liệu</option><option value="finished_good">Thành phẩm</option><option value="semi_finished">Bán thành phẩm</option><option value="direct_sale">Hàng bán thẳng</option><option value="other">Khác (Công cụ dụng cụ...)</option><option value="note">Ghi chú</option></select>{form.itemType ? <small className="type-description">{ITEM_TYPE_DESCRIPTIONS[form.itemType]}</small> : null}</label>
            <label>Nhóm hàng<select name="groupId" value={form.groupId} onChange={update}><option value="">Chưa phân nhóm</option>{data.groups.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            <label>Đơn vị chính<span className="required-mark">*</span><SearchableUnitSelect units={data.units} value={form.baseUnitId} required onChange={(baseUnitId) => setForm((current) => ({ ...current, baseUnitId }))} /></label>
            <label className="full-field">Mô tả<textarea name="description" value={form.description} onChange={update} rows="3" /></label>
            <h3 className="group-form-section-title full-field">Theo dõi tồn kho</h3>
            <label className="item-switch full-field"><input type="checkbox" name="tracksInventory" checked={form.tracksInventory} onChange={update} /><span><strong>Theo dõi số lượng tồn kho</strong><small>Phiếu nhập, xuất và kiểm kê sẽ làm thay đổi tồn của hàng hóa này.</small></span></label>
            <h3 className="group-form-section-title full-field">Quy đổi đơn vị mua</h3>
            <label>Đơn vị mua<SearchableUnitSelect units={data.units} value={form.purchaseUnitId} placeholder="Dùng đơn vị chính" onChange={(purchaseUnitId) => setForm((current) => ({ ...current, purchaseUnitId }))} /></label>
            <label>Tỷ lệ về đơn vị chính<input type="number" min="0.000001" step="0.000001" name="purchaseToBaseRatio" value={form.purchaseToBaseRatio} onChange={update} /></label>
          </>}
          {type === "warehouse" && <><label>Loại kho<select name="warehouseType" value={form.warehouseType} onChange={update}><option value="central">Kho trung tâm</option><option value="branch">Chi nhánh</option><option value="mobile">Xe đẩy mini</option><option value="other">Kho khác</option></select></label><label>Kho cấp hàng<select name="supplyWarehouseId" value={form.supplyWarehouseId} onChange={update}><option value="">Chưa thiết lập</option>{data.warehouses.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label><label className="full-field">Địa chỉ<input name="address" value={form.address} onChange={update} /></label></>}
          {type === "supplier" && <><label>Người liên hệ<input name="contactName" value={form.contactName} onChange={update} /></label><label>Số điện thoại<input name="phone" value={form.phone} onChange={update} /></label><label className="full-field">Địa chỉ<input name="address" value={form.address} onChange={update} /></label></>}
          {type === "unit" && <><label className="full-field">Tên đơn vị tính<span className="required-mark">*</span><input name="name" value={form.name} onChange={update} placeholder="Nhập tên đơn vị tính" /></label><label className="full-field">Mô tả<textarea name="description" value={form.description} onChange={update} placeholder="Nhập mô tả" rows="4" /></label></>}
          {error ? <p className="form-error full-field">{error}</p> : null}
          <div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => onClose()}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</button></div>
        </form>
      </section>
    </div>
  );
}

function exportItems(items) {
  const header = ["Mã hàng", "Tên hàng", "ĐVT chính", "Loại hàng", "Nhóm hàng", "Tồn tối thiểu"];
  const rows = items.map((item) => [item.code, item.name, item.inventory_units?.name || "", item.item_type, item.inventory_item_groups?.name || "", item.minimum_stock]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(new window.Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = "danh-muc-hang-hoa.csv";
  link.click();
  window.URL.revokeObjectURL(link.href);
}

function exportUnits(units) {
  const header = ["Mã đơn vị tính", "Tên đơn vị tính", "Mô tả", "Trạng thái"];
  const rows = units.map((unit) => [unit.code, unit.name, unit.description || "", unit.is_active === false ? "Không hoạt động" : "Đang hoạt động"]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(new window.Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = "danh-muc-don-vi-tinh.csv";
  link.click();
  window.URL.revokeObjectURL(link.href);
}

function ItemWorkspace({ data, search, setSearch, groupId, setGroupId }) {
  const filtered = useMemo(() => data.items.filter((item) => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    const matchesText = !keyword || `${item.code} ${item.name}`.toLocaleLowerCase("vi").includes(keyword);
    return matchesText && (!groupId || item.inventory_item_groups?.id === groupId);
  }), [data.items, groupId, search]);
  const classified = filtered.filter((item) => item.inventory_item_groups).length;
  return <>
    <div className="catalog-filters"><label><span>Tìm kiếm</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập mã hoặc tên" /></label><label><span>Nhóm hàng hóa</span><select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">Tất cả nhóm</option>{data.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label></div>
    <div className="catalog-tabs"><span className="active">Tất cả <strong>{filtered.length}</strong></span><span>Đã phân loại <strong>{classified}</strong></span><span>Chưa phân loại <strong>{filtered.length - classified}</strong></span></div>
    <div className="catalog-table-wrap"><table className="catalog-table"><thead><tr><th>#</th><th>Mã hàng</th><th>Tên hàng</th><th>ĐVT chính</th><th>Loại hàng</th><th>Nhóm hàng</th><th>Theo dõi tồn</th><th>Trạng thái</th></tr></thead><tbody>{filtered.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td className="code-cell">{item.code}</td><td><strong>{item.name}</strong></td><td>{item.inventory_units?.name || "—"}</td><td>{item.item_type === "ingredient" ? "Nguyên vật liệu" : item.item_type === "finished_good" ? "Thành phẩm" : item.item_type === "semi_finished" ? "Bán thành phẩm" : item.item_type === "direct_sale" ? "Hàng bán thẳng" : item.item_type === "note" ? "Ghi chú" : "Khác"}</td><td>{item.inventory_item_groups?.name || "Chưa phân loại"}</td><td>{item.tracks_inventory === false ? "Không" : "Có"}</td><td><span className="active-status">Hoạt động</span></td></tr>)}</tbody></table>{!filtered.length && <p className="catalog-no-result">Không tìm thấy hàng hóa phù hợp.</p>}</div>
  </>;
}

function UnitWorkspace({ units, search, setSearch, status, setStatus }) {
  const activeCount = units.filter((unit) => unit.is_active !== false).length;
  const inactiveCount = units.length - activeCount;
  const filtered = useMemo(() => units.filter((unit) => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    const matchesText = !keyword || `${unit.code} ${unit.name} ${unit.description || ""}`.toLocaleLowerCase("vi").includes(keyword);
    return matchesText && (status === "active" ? unit.is_active !== false : unit.is_active === false);
  }), [search, status, units]);

  return <>
    <div className="catalog-filters unit-filters"><label><span>Tìm kiếm</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập mã hoặc tên" /></label></div>
    <div className="catalog-tabs button-tabs"><button className={status === "active" ? "active" : ""} onClick={() => setStatus("active")}>Đang hoạt động <strong>{activeCount}</strong></button><button className={status === "inactive" ? "active" : ""} onClick={() => setStatus("inactive")}>Không hoạt động <strong>{inactiveCount}</strong></button></div>
    <div className="catalog-table-wrap"><table className="catalog-table unit-table"><thead><tr><th>#</th><th>Mã đơn vị tính</th><th>Tên đơn vị tính</th><th>Mô tả</th><th>Trạng thái</th></tr></thead><tbody>{filtered.map((unit, index) => <tr key={unit.id}><td>{index + 1}</td><td className="code-cell">{unit.code}</td><td><strong>{unit.name}</strong></td><td>{unit.description || "—"}</td><td>{unit.is_active === false ? "Không hoạt động" : <span className="active-status">Đang hoạt động</span>}</td></tr>)}</tbody></table>{!filtered.length && <p className="catalog-no-result">Không tìm thấy đơn vị tính phù hợp.</p>}</div>
  </>;
}

function NormEditor({ row, data, onClose, onSave }) {
  const current = getInventoryStatus(row, data.itemWarehouseNorms);
  const [minimumStock, setMinimumStock] = useState(String(current.minimum));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const warehouse = data.warehouses.find((entry) => entry.id === row.warehouse_id);
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ itemId: row.item_id, warehouseId: row.warehouse_id, minimumStock });
      onClose("Đã cập nhật định mức tồn kho.");
    } catch (saveError) {
      setError(saveError.message || "Chưa thể lưu định mức.");
    } finally {
      setSaving(false);
    }
  };
  return <div className="modal-backdrop drawer-backdrop"><section className="catalog-modal catalog-drawer norm-editor" role="dialog" aria-modal="true" aria-labelledby="norm-editor-title"><div className="modal-heading"><div><p className="eyebrow">Thiết lập theo kho</p><h2 id="norm-editor-title">Định mức tồn kho</h2></div><button type="button" className="modal-close" onClick={() => onClose()} aria-label="Đóng">×</button></div><form className="catalog-form" onSubmit={submit}><div className="norm-editor-summary full-field"><span>Hàng hóa<strong>{row.inventory_items?.name}</strong><small>{row.inventory_items?.code}</small></span><span>Kho áp dụng<strong>{warehouse?.name || "Không xác định"}</strong><small>{warehouse?.code}</small></span><span>Tồn thực tế<strong>{Number(row.quantity || 0).toLocaleString("vi-VN")}</strong><small>{row.inventory_items?.inventory_units?.name}</small></span></div><label className="full-field">Định mức tối thiểu<span className="required-mark">*</span><input type="number" min="0" step="0.001" value={minimumStock} onChange={(event) => setMinimumStock(event.target.value)} autoFocus /><small className="field-help">Hệ thống cảnh báo khi tồn thực tế bằng hoặc thấp hơn mức này.</small></label>{error ? <p className="form-error full-field">{error}</p> : null}<div className="modal-actions full-field"><button type="button" className="secondary-button" onClick={() => onClose()}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? "Đang lưu..." : "Lưu định mức"}</button></div></form></section></div>;
}

function NormWorkspace({ data, search, setSearch, onEdit }) {
  const rows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    return data.balances.filter((balance) => {
      const item = balance.inventory_items;
      const warehouse = data.warehouses.find((entry) => entry.id === balance.warehouse_id);
      return !keyword || `${item?.code || ""} ${item?.name || ""} ${warehouse?.name || ""}`.toLocaleLowerCase("vi").includes(keyword);
    });
  }, [data.balances, data.warehouses, search]);
  const warningCount = rows.filter((balance) => {
    const inventoryStatus = getInventoryStatus(balance, data.itemWarehouseNorms);
    return ["danger", "warning"].includes(inventoryStatus.key);
  }).length;

  return <>
    <div className="catalog-filters unit-filters"><label><span>Tìm kiếm</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập mã, tên hàng hoặc kho" /></label></div>
    <div className="catalog-tabs"><span className="active">Tất cả <strong>{rows.length}</strong></span><span>Cần bổ sung <strong>{warningCount}</strong></span></div>
    <div className="catalog-table-wrap"><table className="catalog-table norm-table"><thead><tr><th>Hàng hóa</th><th>Kho</th><th>Đơn vị</th><th className="right">Tồn thực tế</th><th className="right">Định mức tối thiểu</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead><tbody>{rows.map((balance) => {
      const item = balance.inventory_items;
      const warehouse = data.warehouses.find((entry) => entry.id === balance.warehouse_id);
      const quantity = Number(balance.quantity || 0);
      const inventoryStatus = getInventoryStatus(balance, data.itemWarehouseNorms);
      return <tr key={`${balance.warehouse_id}-${balance.item_id}`}><td><strong>{item?.name || "Không xác định"}</strong><small>{item?.code || "—"}</small></td><td>{warehouse?.name || "Không xác định"}</td><td>{item?.inventory_units?.name || "—"}</td><td className="right quantity">{quantity.toLocaleString("vi-VN")}</td><td className="right quantity">{inventoryStatus.minimum > 0 ? inventoryStatus.minimum.toLocaleString("vi-VN") : "—"}</td><td><span className={`norm-status ${inventoryStatus.key}`}>{inventoryStatus.label}</span></td><td className="norm-action"><button type="button" className="secondary-button" onClick={() => onEdit(balance)}>Thiết lập</button></td></tr>;
    })}</tbody></table>{!rows.length && <p className="catalog-no-result">Chưa có số dư tồn kho phù hợp.</p>}</div>
  </>;
}

function SimpleWorkspace({ type, data }) {
  const collections = { group: data.groups, unit: data.units, warehouse: data.warehouses, supplier: data.suppliers };
  const rows = collections[type] || [];
  const detailLabel = type === "supplier" ? "Liên hệ" : type === "warehouse" ? "Địa chỉ" : "Mô tả";
  return <div className="catalog-table-wrap"><table className="catalog-table standard-catalog-table"><thead><tr><th>#</th><th>Mã</th><th>Tên</th><th>{detailLabel}</th><th>Trạng thái</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td className="code-cell">{row.code}</td><td><strong>{row.name}</strong></td><td>{type === "supplier" ? row.contact_name || row.phone || "—" : type === "warehouse" ? row.address || "—" : row.description || "—"}</td><td><span className="active-status">Đang hoạt động</span></td></tr>)}</tbody></table>{!rows.length && <p className="catalog-no-result">Danh mục này chưa có dữ liệu.</p>}</div>;
}

export default function CatalogManager({ data, onCreate, onSaveNorm }) {
  const [active, setActive] = useState("item");
  const [formType, setFormType] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState("");
  const [unitSearch, setUnitSearch] = useState("");
  const [unitStatus, setUnitStatus] = useState("active");
  const [normSearch, setNormSearch] = useState("");
  const [editingNorm, setEditingNorm] = useState(null);
  const section = SECTIONS.find((entry) => entry.id === active);
  const ActiveIcon = section.icon;
  const closeForm = (message = "") => { setFormType(""); setNotice(message); };

  return <div className="catalog-workspace">
    <aside className="catalog-sidebar">{SECTIONS.map(({ id, label, icon: Icon, ready }) => <button key={id} className={active === id ? "active" : ""} onClick={() => { setActive(id); setNotice(""); }}><Icon size={18} /><span>{label}</span>{!ready && <small>Sắp có</small>}</button>)}</aside>
    <section className="catalog-content">
      <header className="catalog-content-header"><div><h2>{section.label}</h2><p>Quản lý dữ liệu dùng chung cho hoạt động kho.</p></div><div className="catalog-actions">{["item", "unit"].includes(active) && <><button className="secondary-button" disabled title="Nhập dữ liệu sẽ được mở khi có mẫu Excel chuẩn"><UploadSimple /> Nhập Excel</button><button className="secondary-button" onClick={() => active === "item" ? exportItems(data.items) : exportUnits(data.units)}><DownloadSimple /> Xuất Excel</button></>} {section.ready && section.canCreate !== false && <button className="primary-button compact" onClick={() => setFormType(active)}><Plus weight="bold" /> Tạo mới</button>}</div></header>
      {notice && <div className="success-banner"><CheckCircle weight="fill" />{notice}</div>}
      {active === "item" ? <ItemWorkspace data={data} search={search} setSearch={setSearch} groupId={groupId} setGroupId={setGroupId} /> : active === "unit" ? <UnitWorkspace units={data.units} search={unitSearch} setSearch={setUnitSearch} status={unitStatus} setStatus={setUnitStatus} /> : active === "norm" ? <NormWorkspace data={data} search={normSearch} setSearch={setNormSearch} onEdit={setEditingNorm} /> : section.ready ? <SimpleWorkspace type={active} data={data} /> : <div className="catalog-coming-soon"><span><ActiveIcon size={34} weight="duotone" /></span><h3>{section.label}</h3><p>Phần này cần bổ sung cấu trúc dữ liệu và quy trình duyệt trước khi đưa vào vận hành thật.</p><small>Đã đặt đúng vị trí trong hệ thống để triển khai ở bước tiếp theo.</small></div>}
    </section>
    {formType && <CreateForm type={formType} data={data} onClose={closeForm} onCreate={onCreate} />}
    {editingNorm && <NormEditor row={editingNorm} data={data} onSave={onSaveNorm} onClose={(message = "") => { setEditingNorm(null); setNotice(message); }} />}
  </div>;
}
