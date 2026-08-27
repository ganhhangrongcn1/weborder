import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import InventoryBomModal from "./InventoryBomModal.jsx";

const STATUS_META = {
  draft: { label: "Bản nháp", tone: "draft" },
  active: { label: "Đang áp dụng", tone: "active" },
  inactive: { label: "Ngừng áp dụng", tone: "inactive" }
};

const SCOPE_LABELS = {
  central: "Sản xuất/đóng gói",
  branch: "Sơ chế chi nhánh",
  department: "Sơ chế bộ phận",
  any: "Công thức dùng chung"
};

function formatQuantity(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Number(value || 0));
}

export default function InventoryBomManager({
  rows = [],
  items = [],
  units = [],
  warehouses = [],
  canWrite = false,
  scopeLabel = "Phạm vi được cấp",
  mutationStatus = "idle",
  mutationMessage = "",
  onSave,
  onActivate,
  onDelete,
  onArchive
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [modal, setModal] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows = useMemo(() => rows.filter((bom) => {
    if (status !== "all" && bom.status !== status) return false;
    if (!normalizedSearch) return true;
    return [bom.code, bom.outputItem?.name, bom.outputItem?.code]
      .some((value) => String(value || "").toLowerCase().includes(normalizedSearch));
  }), [normalizedSearch, rows, status]);
  const activeCount = rows.filter((bom) => bom.status === "active").length;
  const draftCount = rows.filter((bom) => bom.status === "draft").length;
  const semiFinishedCount = items.filter((item) => item.itemType === "semi_finished" && item.isActive !== false).length;

  const openVersion = (bom) => setModal({
    mode: "edit",
    bom: { ...bom, id: "", code: "", status: "draft", version: Number(bom.version || 0) + 1 }
  });

  const requestActivation = (bom) => setConfirmation({ type: "activate", bom });
  const requestDelete = (bom) => setConfirmation({ type: "delete", bom });
  const requestArchive = (bom) => setConfirmation({ type: "archive", bom });

  const confirmMutation = async () => {
    if (!confirmation?.bom) return;
    try {
      if (confirmation.type === "activate") await onActivate(confirmation.bom.id);
      else if (confirmation.type === "delete") await onDelete(confirmation.bom);
      else await onArchive(confirmation.bom);
      setConfirmation(null);
    } catch {
      // Thông báo lỗi được luồng quản lý BOM hiển thị ở danh sách.
    }
  };

  const replacedBom = confirmation?.type === "activate"
    ? rows.find((bom) => (
        bom.id !== confirmation.bom.id
        && bom.outputItemId === confirmation.bom.outputItemId
        && bom.productionScope === confirmation.bom.productionScope
        && bom.defaultWarehouseId === confirmation.bom.defaultWarehouseId
        && bom.status === "active"
      ))
    : null;

  return (
    <section className="inventory-list-card inventory-bom-manager">
      <div className="inventory-bom-manager__head">
        <span><Icon name="menu" size={20} /></span>
        <div>
          <strong>Công thức chế biến</strong>
          <small>Định mức sản xuất, đóng gói hoặc sơ chế để tạo bán thành phẩm.</small>
        </div>
        <button type="button" disabled={!canWrite || semiFinishedCount === 0} onClick={() => setModal({ mode: "edit", bom: {} })}><Icon name="plus" size={16} /> Tạo công thức</button>
      </div>

      <div className="inventory-bom-guide">
        <Icon name="check" size={17} />
        <div><strong>Phạm vi: {scopeLabel}.</strong><span>Chỉ hiển thị công thức thuộc kho tài khoản được cấp; tạo công thức chưa làm thay đổi tồn kho.</span></div>
      </div>

      <div className="inventory-summary-grid inventory-bom-summary">
        <div><span>Tổng công thức</span><strong>{rows.length}</strong></div>
        <div><span>Đang áp dụng</span><strong>{activeCount}</strong></div>
        <div><span>Bản nháp</span><strong>{draftCount}</strong></div>
        <div><span>Mã bán thành phẩm</span><strong>{semiFinishedCount}</strong></div>
      </div>

      {mutationMessage ? <div className={`inventory-count-notice${mutationStatus === "error" ? " is-error" : ""}`}><Icon name={mutationStatus === "error" ? "warning" : "check"} size={16} />{mutationMessage}</div> : null}

      <div className="inventory-list-toolbar inventory-bom-toolbar">
        <label className="inventory-search-field"><Icon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã BOM hoặc bán thành phẩm..." /></label>
        <InventorySearchableSelect value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang áp dụng</option>
          <option value="draft">Bản nháp</option>
          <option value="inactive">Ngừng áp dụng</option>
        </InventorySearchableSelect>
      </div>

      <div className="inventory-table-scroll">
        <table className="inventory-data-table inventory-bom-table">
          <thead><tr><th>Mã BOM</th><th>Bán thành phẩm đầu ra</th><th>Đầu ra</th><th>Nơi thực hiện</th><th>Thành phần</th><th>Hiệu lực</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {filteredRows.map((bom) => {
              const meta = STATUS_META[bom.status] || STATUS_META.draft;
              return (
                <tr key={bom.id}>
                  <td><strong>{bom.code}</strong><small>Phiên bản {bom.version}</small></td>
                  <td><strong>{bom.outputItem?.name || "Bán thành phẩm"}</strong><small>{bom.outputItem?.code || ""}</small></td>
                  <td><strong>{formatQuantity(bom.yieldQuantity)} {bom.yieldUnit?.name || ""}</strong></td>
                  <td><span className="inventory-bom-scope">{SCOPE_LABELS[bom.productionScope] || "Dùng chung"}</span><small>{bom.defaultWarehouse?.name || "Chọn khi lập lệnh"}</small></td>
                  <td><strong>{bom.components.length} thành phần</strong><small>{bom.components.slice(0, 2).map((line) => line.componentItem?.name).filter(Boolean).join(", ")}{bom.components.length > 2 ? "..." : ""}</small></td>
                  <td><strong>{bom.effectiveFrom || "-"}</strong><small>{bom.effectiveTo ? `Đến ${bom.effectiveTo}` : "Không giới hạn"}</small></td>
                  <td><span className={`inventory-bom-status is-${meta.tone}`}>{meta.label}</span></td>
                  <td>
                    <div className="inventory-row-actions inventory-bom-actions">
                      <button type="button" onClick={() => setModal({ mode: "view", bom })}><Icon name="eye" size={14} /> Xem</button>
                      {canWrite && bom.status === "draft" ? <button type="button" onClick={() => setModal({ mode: "edit", bom })}><Icon name="edit" size={14} /> Sửa</button> : null}
                      {canWrite && bom.status === "draft" ? <button type="button" className="is-primary" onClick={() => requestActivation(bom)}><Icon name="check" size={14} /> Kích hoạt</button> : null}
                      {canWrite && bom.status !== "draft" ? <button type="button" onClick={() => openVersion(bom)}><Icon name="refresh" size={14} /> Tạo phiên bản</button> : null}
                      {canWrite && bom.status === "draft" ? <button type="button" className="is-danger" onClick={() => requestDelete(bom)}><Icon name="trash" size={14} /> Xóa</button> : null}
                      {canWrite && bom.status === "inactive" ? <button type="button" onClick={() => requestArchive(bom)}><Icon name="archive" size={14} /> Lưu trữ</button> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!filteredRows.length ? (
        <div className="inventory-list-empty">
          <span><Icon name="menu" size={24} /></span>
          <strong>{semiFinishedCount ? "Chưa có công thức chế biến" : "Chưa có mã Bán thành phẩm"}</strong>
          <span>{semiFinishedCount ? "Tạo công thức đầu tiên cho Gói bánh tráng gia vị hoặc một bán thành phẩm sơ chế." : "Hãy tạo Nguyên vật liệu loại Bán thành phẩm trước khi khai báo công thức."}</span>
        </div>
      ) : null}

      {modal ? (
        <InventoryBomModal
          bom={modal.bom}
          items={items}
          units={units}
          warehouses={warehouses}
          readOnly={modal.mode === "view"}
          isSaving={mutationStatus === "saving"}
          onClose={() => setModal(null)}
          onSave={onSave}
        />
      ) : null}

      {confirmation ? (
        <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && mutationStatus !== "saving" && setConfirmation(null)}>
          <section className="inventory-warehouse-modal inventory-bom-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="inventory-bom-confirm-title">
            <header>
              <div className="inventory-modal-heading">
                <span className={confirmation.type === "delete" ? "is-danger" : ""}><Icon name={confirmation.type === "activate" ? "check" : confirmation.type === "delete" ? "trash" : "archive"} size={20} /></span>
                <div>
                  <h2 id="inventory-bom-confirm-title">{confirmation.type === "activate" ? "Kích hoạt công thức?" : confirmation.type === "delete" ? "Xóa bản nháp công thức?" : "Lưu trữ công thức?"}</h2>
                  <p>Vui lòng kiểm tra thông tin trước khi xác nhận.</p>
                </div>
              </div>
              <button type="button" disabled={mutationStatus === "saving"} onClick={() => setConfirmation(null)} aria-label="Đóng"><Icon name="close" size={18} /></button>
            </header>

            <div className="inventory-bom-confirm-modal__body">
              <div className="inventory-bom-confirm-modal__identity">
                <span>Mã công thức</span>
                <strong>{confirmation.bom.code}</strong>
                <small>{confirmation.bom.outputItem?.name || "Bán thành phẩm"}</small>
              </div>
              {confirmation.type === "activate" ? (
                <div className="inventory-bom-confirm-modal__notice is-success">
                  <Icon name="check" size={18} />
                  <div>
                    <strong>Công thức này sẽ chuyển sang “Đang áp dụng”.</strong>
                    <span>{replacedBom ? `${replacedBom.code} đang áp dụng sẽ tự ngừng và vẫn được giữ lại để tra cứu.` : "Hiện chưa có công thức nào đang áp dụng, nên không có phiên bản nào bị ngừng."}</span>
                  </div>
                </div>
              ) : confirmation.type === "delete" ? (
                <div className="inventory-bom-confirm-modal__notice is-warning">
                  <Icon name="warning" size={18} />
                  <div><strong>Bản nháp này sẽ bị xóa vĩnh viễn.</strong><span>Chỉ bản nháp chưa từng áp dụng mới được xóa. Thao tác này không làm thay đổi tồn kho.</span></div>
                </div>
              ) : (
                <div className="inventory-bom-confirm-modal__notice is-warning">
                  <Icon name="archive" size={18} />
                  <div><strong>Công thức sẽ được đưa khỏi danh sách vận hành.</strong><span>Dữ liệu vẫn được giữ lại để tra cứu lịch sử và không làm thay đổi tồn kho.</span></div>
                </div>
              )}
            </div>

            <footer className="inventory-bom-confirm-modal__footer">
              <button type="button" disabled={mutationStatus === "saving"} onClick={() => setConfirmation(null)}>Hủy</button>
              <button type="button" className={confirmation.type === "delete" ? "is-danger" : confirmation.type === "activate" ? "is-primary" : ""} disabled={mutationStatus === "saving"} onClick={confirmMutation}>
                <Icon name={confirmation.type === "activate" ? "check" : confirmation.type === "delete" ? "trash" : "archive"} size={16} />
                {mutationStatus === "saving" ? "Đang xử lý..." : confirmation.type === "activate" ? "Kích hoạt" : confirmation.type === "delete" ? "Xóa bản nháp" : "Lưu trữ"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
