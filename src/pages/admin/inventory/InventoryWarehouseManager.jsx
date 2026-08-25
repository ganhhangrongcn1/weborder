import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { buildBranchFilterOptions } from "../../../services/branchIdentityService.js";
import InventoryWarehouseList from "./InventoryWarehouseList.jsx";

const TYPE_OPTIONS = [
  { value: "central", label: "Kho trung tâm", level: "Tầng 1", note: "Nhận hàng nhà cung cấp và chuyển xuống chi nhánh." },
  { value: "branch", label: "Kho chi nhánh", level: "Tầng 2", note: "Kho mặc định của quán khi BOM chưa gán mã khu." },
  { value: "department", label: "Kho bộ phận", level: "Tầng 3", note: "BOM gán mã khu sẽ trừ đúng kho bộ phận cùng mã tại chi nhánh." },
  { value: "mobile", label: "Kho lưu động", level: "Ngoài chuỗi", note: "Dùng cho điểm bán hoặc phương tiện lưu động; không thuộc chuỗi kho mặc định của chi nhánh." }
];

const TYPE_ICONS = {
  central: "store",
  branch: "home",
  department: "folder",
  mobile: "refresh"
};

const EMPTY_FORM = {
  name: "",
  warehouseType: "branch",
  branchUuid: "",
  departmentCode: "",
  departmentName: "",
  address: "",
  allowNegativeStock: false,
  isDefaultForBranch: true
};

function buildWarehouseForm(record, initialType) {
  if (!record) return { ...EMPTY_FORM, warehouseType: initialType };
  return {
    name: record.name || "",
    warehouseType: record.warehouseType || initialType,
    branchUuid: record.branchUuid || "",
    departmentCode: record.departmentCode || "",
    departmentName: record.departmentName || "",
    address: record.address || "",
    allowNegativeStock: Boolean(record.allowNegativeStock),
    isDefaultForBranch: Boolean(record.isDefaultForBranch)
  };
}

function WarehouseCard({ warehouse }) {
  return (
    <article className={`inventory-diagram-node type-${warehouse.warehouseType}`}>
      <span><Icon name="store" size={19} /></span>
      <div>
        <strong>{warehouse.name}</strong>
        <small>{warehouse.code}</small>
        {warehouse.isDefaultForBranch ? <em>Trừ kho mặc định</em> : null}
        {warehouse.isDraft ? <em className="is-draft">Bản nháp local</em> : null}
      </div>
    </article>
  );
}

function WarehouseDiagram({ warehouses, onAddDepartment }) {
  const central = warehouses.filter((row) => row.warehouseType === "central");
  const branchWarehouses = warehouses.filter((row) => row.warehouseType === "branch");
  const departments = warehouses.filter((row) => row.warehouseType === "department");
  const others = warehouses.filter((row) => !["central", "branch", "department"].includes(row.warehouseType));
  const draftCount = warehouses.filter((row) => row.isDraft).length;

  return (
    <section className="inventory-diagram-card">
      <div className="inventory-diagram-help">
        <Icon name="info" size={16} />
        <span>{draftCount
          ? `Sơ đồ đọc từ trên xuống: kho trung tâm → kho chi nhánh → kho bộ phận. Có ${draftCount} bản nháp local, chưa tác động tồn kho thật.`
          : "Sơ đồ đang đọc dữ liệu Kho từ Supabase. Chỉ chứng từ đã hoàn tất mới làm thay đổi tồn kho."}</span>
      </div>
      <div className="inventory-diagram-flow">
        <p>Tầng 1 · Kho trung tâm</p>
        <div className="inventory-diagram-row">{central.length ? central.map((row) => <WarehouseCard key={row.id} warehouse={row} />) : <span className="inventory-diagram-placeholder">Chưa tạo kho trung tâm</span>}</div>
        <b>Chuyển kho nội bộ</b>
        <p>Tầng 2 · Kho chi nhánh</p>
        <div className="inventory-diagram-row">{branchWarehouses.length ? branchWarehouses.map((row) => <WarehouseCard key={row.id} warehouse={row} />) : <span className="inventory-diagram-placeholder">Chưa tạo kho chi nhánh</span>}</div>
        <b>Yêu cầu xuất kho</b>
        <p>Tầng 3 · Kho bộ phận</p>
        <div className="inventory-diagram-row">
          {departments.map((row) => <WarehouseCard key={row.id} warehouse={row} />)}
          <button type="button" className="inventory-add-department" onClick={onAddDepartment}><Icon name="plus" size={19} />Thêm kho bộ phận</button>
        </div>
        {others.length ? <><p>Kho lưu động / khác</p><div className="inventory-diagram-row">{others.map((row) => <WarehouseCard key={row.id} warehouse={row} />)}</div></> : null}
      </div>
    </section>
  );
}

function WarehouseCreateModal({ branches, initialType = "branch", record = null, writesLive = false, onClose, onSave }) {
  const [form, setForm] = useState(() => buildWarehouseForm(record, initialType));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const branchOptions = useMemo(() => buildBranchFilterOptions(branches), [branches]);

  const update = ({ target }) => {
    const value = target.type === "checkbox" ? target.checked : target.value;
    setForm((current) => ({ ...current, [target.name]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ id: record?.id || "", input: form });
      onClose(record ? "Kho đã được cập nhật." : writesLive ? "Kho mới đã được tạo trên Supabase." : "Kho mới đã được tạo dưới dạng bản nháp local.");
    } catch (saveError) {
      setError(saveError.message || "Chưa thể tạo kho.");
    } finally {
      setSaving(false);
    }
  };

  const selectedType = TYPE_OPTIONS.find((item) => item.value === form.warehouseType) || TYPE_OPTIONS[1];
  const needsBranch = ["branch", "department"].includes(form.warehouseType);
  const createDisabled = saving
    || !form.name.trim()
    || needsBranch && !form.branchUuid
    || form.warehouseType === "department" && !form.departmentCode.trim();

  return (
    <div className="inventory-modal-backdrop" role="presentation">
      <section className="inventory-warehouse-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-create-title">
        <header>
          <div className="inventory-modal-heading">
            <span><Icon name="store" size={20} /></span>
            <div><h2 id="inventory-create-title">{record ? "Chỉnh sửa kho" : "Thêm kho mới"}</h2><p>{record ? "Cập nhật cấu hình vận hành của kho." : "Nhập thông tin kho mới theo cấu trúc vận hành."}</p></div>
          </div>
          <button type="button" onClick={() => onClose()} aria-label="Đóng"><Icon name="close" size={18} /></button>
        </header>
        <div className={writesLive ? "inventory-live-write-notice" : "inventory-draft-notice"}><Icon name="warning" size={17} /><span>{writesLive ? "Thao tác này ghi cấu hình kho vào Supabase; chưa làm thay đổi tồn nếu không có chứng từ." : "Đang lưu bản nháp trên máy này, chưa ghi vào Supabase production."}</span></div>
        <form onSubmit={submit}>
          <label className="inventory-form-field full-field" htmlFor="inventory-warehouse-name">
            <span className="inventory-field-label"><Icon name="store" size={15} />Tên kho <b>*</b></span>
            <span className="inventory-control-shell"><Icon name="tag" size={17} /><input id="inventory-warehouse-name" name="name" value={form.name} onChange={update} placeholder="Kho trung tâm, Kho chi nhánh 1..." autoFocus /></span>
          </label>

          <div className={`inventory-form-row full-field${needsBranch ? " inventory-form-row--paired" : ""}`}>
            <label className="inventory-form-field" htmlFor="inventory-warehouse-type">
              <span className="inventory-field-label"><Icon name="folder" size={15} />Loại kho <b>*</b></span>
              <span className="inventory-control-shell inventory-control-shell--select"><Icon name={TYPE_ICONS[selectedType.value]} size={17} /><select id="inventory-warehouse-type" name="warehouseType" value={form.warehouseType} onChange={update}>{TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label} · {item.level}</option>)}</select></span>
              <span className="inventory-field-help inventory-field-help--type"><Icon name={TYPE_ICONS[selectedType.value]} size={17} /><span><strong>{selectedType.label}<em>{selectedType.level}</em></strong><small>{selectedType.note}</small></span></span>
            </label>

            {needsBranch ? (
              <label className="inventory-form-field" htmlFor="inventory-warehouse-branch">
                <span className="inventory-field-label"><Icon name="home" size={15} />Chi nhánh <b>*</b></span>
                <span className="inventory-control-shell inventory-control-shell--select"><Icon name="store" size={17} /><select id="inventory-warehouse-branch" name="branchUuid" value={form.branchUuid} onChange={update}><option value="">Chọn chi nhánh</option>{branchOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></span>
                <span className="inventory-field-help"><Icon name="gear" size={17} /><small>{form.warehouseType === "branch" ? "Kho này sẽ tự động trừ tồn khi đơn hàng của chi nhánh hoàn tất." : "Kho bộ phận chỉ phục vụ nguyên vật liệu của đúng chi nhánh đã chọn."}</small></span>
              </label>
            ) : null}
          </div>

          {form.warehouseType === "department" ? (
            <div className="inventory-form-row inventory-form-row--paired full-field">
              <label className="inventory-form-field" htmlFor="inventory-department-name">
                <span className="inventory-field-label"><Icon name="folder" size={15} />Tên bộ phận</span>
                <span className="inventory-control-shell"><Icon name="folder" size={17} /><input id="inventory-department-name" name="departmentName" value={form.departmentName} onChange={update} placeholder="Ví dụ: Bếp, Quầy bar..." /></span>
              </label>
              <label className="inventory-form-field" htmlFor="inventory-department-code">
                <span className="inventory-field-label"><Icon name="tag" size={15} />Mã khu <b>*</b></span>
                <span className="inventory-control-shell"><Icon name="tag" size={17} /><input id="inventory-department-code" name="departmentCode" value={form.departmentCode} onChange={update} placeholder="Ví dụ: BEP, BAR..." /></span>
                <span className="inventory-field-help"><Icon name="gear" size={17} /><small>BOM chọn mã khu để hệ thống tìm đúng kho bộ phận tại từng chi nhánh.</small></span>
              </label>
            </div>
          ) : null}

          <label className="inventory-form-field full-field" htmlFor="inventory-warehouse-address">
            <span className="inventory-field-label"><Icon name="home" size={15} />Địa chỉ <em>Không bắt buộc</em></span>
            <span className="inventory-control-shell"><Icon name="home" size={17} /><input id="inventory-warehouse-address" name="address" value={form.address} onChange={update} placeholder="Nhập địa chỉ kho..." /></span>
            <small className="inventory-plain-help">Dùng để nhận biết địa điểm giao nhận và luân chuyển hàng.</small>
          </label>

          <label className="inventory-stock-setting full-field" htmlFor="inventory-negative-stock">
            <span className="inventory-setting-icon"><Icon name="refresh" size={19} /></span>
            <span className="inventory-setting-copy"><strong>Bán trước, nhập hàng sau</strong><small>Vẫn cho phép bán và trừ kho khi chưa kịp nhập hàng. Tồn kho có thể xuống số âm và sẽ được bù lại khi nhập hàng sau. Nếu tắt, đơn sẽ không thể hoàn tất khi thiếu tồn.</small></span>
            <span className="inventory-switch"><input id="inventory-negative-stock" type="checkbox" name="allowNegativeStock" checked={form.allowNegativeStock} onChange={update} /><span aria-hidden="true" /></span>
          </label>
          {form.warehouseType === "branch" ? (
            <label className="inventory-stock-setting full-field" htmlFor="inventory-default-warehouse">
              <span className="inventory-setting-icon"><Icon name="check" size={19} /></span>
              <span className="inventory-setting-copy"><strong>Kho mặc định của chi nhánh</strong><small>Khi BOM chưa gắn mã khu, nguyên vật liệu sẽ trừ tại kho mặc định này. Mỗi chi nhánh chỉ có một kho mặc định đang hoạt động.</small></span>
              <span className="inventory-switch"><input id="inventory-default-warehouse" type="checkbox" name="isDefaultForBranch" checked={form.isDefaultForBranch} onChange={update} /><span aria-hidden="true" /></span>
            </label>
          ) : null}
          {error ? <p className="inventory-form-error full-field">{error}</p> : null}
          <footer className="full-field"><button type="button" onClick={() => onClose()}>Huỷ</button><button type="submit" disabled={createDisabled}><Icon name={record ? "check" : "plus"} size={17} />{saving ? "Đang lưu..." : record ? "Lưu thay đổi" : "Tạo kho"}</button></footer>
        </form>
      </section>
    </div>
  );
}

export default function InventoryWarehouseManager({ warehouses = [], branches = [], canWrite = false, onSave, onArchive, onPublishDrafts }) {
  const [viewMode, setViewMode] = useState("diagram");
  const [modalType, setModalType] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [publishingDrafts, setPublishingDrafts] = useState(false);
  const draftCount = warehouses.filter((warehouse) => warehouse.isDraft).length;

  const closeModal = (message = "") => {
    setModalType("");
    setEditingWarehouse(null);
    setNotice(message);
    setNoticeType("success");
  };

  const openCreate = (type) => {
    setEditingWarehouse(null);
    setModalType(type);
  };

  const openEdit = (warehouse) => {
    setEditingWarehouse(warehouse);
    setModalType(warehouse.warehouseType || "other");
  };

  const publishDrafts = async () => {
    if (!draftCount || !canWrite || publishingDrafts) return;
    const confirmed = globalThis.confirm?.(`Đưa ${draftCount} bản nháp lên Supabase production? Hệ thống sẽ tạo kho trung tâm trước, sau đó tạo các kho chi nhánh và chỉ xoá bản nháp khi toàn bộ hoàn tất.`);
    if (!confirmed) return;

    setPublishingDrafts(true);
    setNotice("");
    try {
      const result = await onPublishDrafts?.();
      const createdCount = result?.created?.length || 0;
      const matchedCount = result?.matched?.length || 0;
      setNotice(`Đã chuyển ${draftCount} bản nháp lên Supabase: tạo mới ${createdCount}${matchedCount ? `, nhận diện có sẵn ${matchedCount}` : ""}.`);
      setNoticeType("success");
    } catch (error) {
      setNotice(error.message || "Không thể chuyển bản nháp lên Supabase.");
      setNoticeType("error");
    } finally {
      setPublishingDrafts(false);
    }
  };

  return (
    <>
      {notice ? <div className={`inventory-success-banner${noticeType === "error" ? " is-error" : ""}`}><Icon name={noticeType === "error" ? "warning" : "check"} size={17} />{notice}</div> : null}
      <div className="inventory-warehouse-actions">
        <div><button type="button" className={viewMode === "diagram" ? "is-active" : ""} onClick={() => setViewMode("diagram")}>Sơ đồ</button><button type="button" className={viewMode === "list" ? "is-active" : ""} onClick={() => setViewMode("list")}>Danh sách</button></div>
        <span className="inventory-warehouse-action-buttons">
          {draftCount ? <button type="button" className="inventory-publish-drafts" disabled={!canWrite || publishingDrafts} onClick={publishDrafts}><Icon name="refresh" size={17} />{publishingDrafts ? "Đang chuyển..." : `Đưa ${draftCount} bản nháp lên Supabase`}</button> : null}
          <button type="button" onClick={() => openCreate("branch")}><Icon name="plus" size={17} />Thêm kho</button>
        </span>
      </div>
      {viewMode === "diagram"
        ? <WarehouseDiagram warehouses={warehouses} onAddDepartment={() => openCreate("department")} />
        : <InventoryWarehouseList warehouses={warehouses} branches={branches} canWrite={canWrite} onEdit={openEdit} onArchive={onArchive} onNotice={(message) => { setNotice(message); setNoticeType(message?.startsWith("Đã") ? "success" : "error"); }} />}
      {modalType ? <WarehouseCreateModal branches={branches} initialType={modalType} record={editingWarehouse} writesLive={canWrite} onClose={closeModal} onSave={onSave} /> : null}
    </>
  );
}
