import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import { getInventoryProductionScopeMeta } from "../../../services/inventoryProductionService.js";
import InventoryProductionOrderModal from "./InventoryProductionOrderModal.jsx";

const STATUS_META = {
  draft: { label: "Bản nháp", tone: "draft" },
  in_progress: { label: "Đang làm", tone: "progress" },
  completed: { label: "Hoàn thành", tone: "active" },
  cancelled: { label: "Đã hủy", tone: "inactive" }
};

function formatQuantity(value) {
  return Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

export default function InventoryProductionOrderManager({
  rows = [],
  boms = [],
  warehouses = [],
  warehouseSelectionLocked = false,
  canWrite = false,
  mutationStatus = "idle",
  mutationMessage = "",
  onSave,
  onStart,
  onComplete,
  onCancel,
  onDeleteDraft
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [modal, setModal] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [reason, setReason] = useState("");
  const busy = mutationStatus === "saving";
  const filteredRows = useMemo(() => rows.filter((order) => {
    if (status !== "all" && order.status !== status) return false;
    const term = search.trim().toLowerCase();
    return !term || [order.orderNo, order.outputItem?.name, order.outputItem?.code, order.warehouse?.name]
      .some((value) => String(value || "").toLowerCase().includes(term));
  }), [rows, search, status]);
  const inProgressCount = rows.filter((order) => order.status === "in_progress").length;
  const draftCount = rows.filter((order) => order.status === "draft").length;
  const completedCount = rows.filter((order) => order.status === "completed").length;
  const activeBoms = boms.filter((bom) => bom.status === "active" && !bom.deletedAt);
  const availableScopes = new Set([
    ...activeBoms.map((bom) => bom.productionScope || "central"),
    ...rows.map((order) => order.productionScope || "central")
  ]);
  const hasCentral = availableScopes.has("central");
  const hasPreprocessing = availableScopes.has("branch") || availableScopes.has("department");
  const pageTitle = hasCentral && hasPreprocessing
    ? "Lệnh sản xuất & sơ chế"
    : hasPreprocessing
      ? "Lệnh sơ chế"
      : "Lệnh sản xuất";
  const createLabel = hasPreprocessing && !hasCentral ? "Tạo lệnh sơ chế" : "Tạo lệnh";

  const confirmAction = async () => {
    if (!confirmation?.order) return;
    if (confirmation.type === "start") await onStart(confirmation.order.id);
    else if (confirmation.type === "delete") await onDeleteDraft(confirmation.order.id);
    else await onCancel(confirmation.order.id, reason);
    setConfirmation(null);
    setReason("");
  };

  return (
    <section className="inventory-list-card inventory-production-manager">
      <div className="inventory-bom-manager__head">
        <span><Icon name="gear" size={19} /></span>
        <div><strong>{pageTitle}</strong><small>Chọn công thức đúng kho, nhập số lượng cần làm và hoàn thành để cập nhật tồn kho.</small></div>
        <button type="button" disabled={!canWrite || !activeBoms.length} onClick={() => setModal({ mode: "create", order: {} })}><Icon name="plus" size={16} /> {createLabel}</button>
      </div>

      <div className="inventory-production-flow"><span>1. Tạo lệnh</span><Icon name="share" size={15} /><span>2. Bắt đầu làm</span><Icon name="share" size={15} /><span>3. Hoàn thành</span></div>

      <div className="inventory-summary-grid inventory-bom-summary">
        <div><span>Tổng lệnh</span><strong>{rows.length}</strong></div>
        <div><span>Đang làm</span><strong>{inProgressCount}</strong></div>
        <div><span>Bản nháp</span><strong>{draftCount}</strong></div>
        <div><span>Đã hoàn thành</span><strong>{completedCount}</strong></div>
      </div>

      {mutationMessage ? <div className={`inventory-mutation-notice is-${mutationStatus}`}><Icon name={mutationStatus === "error" ? "warning" : "check"} size={16} />{mutationMessage}</div> : null}

      <div className="inventory-list-toolbar inventory-bom-toolbar">
        <label className="inventory-search-field"><Icon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã lệnh, thành phẩm, kho..." /></label>
        <InventorySearchableSelect value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="in_progress">Đang làm</option><option value="completed">Hoàn thành</option><option value="cancelled">Đã hủy</option></InventorySearchableSelect>
      </div>

      <div className="inventory-table-scroll">
        <table className="inventory-data-table inventory-production-table">
          <thead><tr><th>Mã lệnh</th><th>Thành phẩm</th><th>Số lượng</th><th>Kho làm</th><th>Nguyên liệu</th><th>Giá vốn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {filteredRows.map((order) => {
              const meta = STATUS_META[order.status] || STATUS_META.draft;
              const scopeMeta = getInventoryProductionScopeMeta(order.productionScope);
              const outputQuantity = order.actualOutputQuantity || order.plannedOutputQuantity;
              return (
                <tr key={order.id}>
                  <td><strong>{order.orderNo}</strong><small>{new Date(order.createdAt).toLocaleString("vi-VN")}</small></td>
                  <td><strong>{order.outputItem?.name || "Bán thành phẩm"}</strong><small>{order.outputItem?.code || ""}</small></td>
                  <td><strong>{formatQuantity(outputQuantity)} {order.outputUnit?.name || ""}</strong><small>{order.actualOutputQuantity ? "Thực nhận" : "Dự kiến"}</small></td>
                  <td><strong>{order.warehouse?.name || "Kho thực hiện"}</strong><small>{scopeMeta.processLabel}</small></td>
                  <td><strong>{order.lines.length} thành phần</strong><small>{order.lines.slice(0, 2).map((line) => line.item?.name).filter(Boolean).join(", ")}</small></td>
                  <td><strong>{order.status === "completed" ? `${Number(order.actualTotalCost || 0).toLocaleString("vi-VN")} đ` : `${Number(order.estimatedTotalCost || 0).toLocaleString("vi-VN")} đ`}</strong><small>{order.status === "completed" ? "Thực tế" : "Tạm tính"}</small></td>
                  <td><span className={`inventory-bom-status is-${meta.tone}`}>{meta.label}</span></td>
                  <td><div className="inventory-row-actions inventory-production-actions">
                    <button type="button" onClick={() => setModal({ mode: "view", order })}><Icon name="eye" size={14} /> Xem</button>
                    {canWrite && order.status === "draft" ? <button type="button" onClick={() => setModal({ mode: "edit", order })}><Icon name="edit" size={14} /> Sửa</button> : null}
                    {canWrite && order.status === "draft" ? <button type="button" className="is-primary" onClick={() => setConfirmation({ type: "start", order })}><Icon name="play" size={14} /> Bắt đầu</button> : null}
                    {canWrite && order.status === "in_progress" ? <button type="button" className="is-primary" onClick={() => setModal({ mode: "complete", order })}><Icon name="check" size={14} /> Hoàn thành</button> : null}
                    {canWrite && order.status === "draft" ? <button type="button" className="is-danger" onClick={() => setConfirmation({ type: "delete", order })}><Icon name="trash" size={14} /> Xóa</button> : null}
                    {canWrite && order.status === "in_progress" ? <button type="button" className="is-danger" onClick={() => setConfirmation({ type: "cancel", order })}><Icon name="close" size={14} /> Hủy</button> : null}
                  </div></td>
                </tr>
              );
            })}
            {!filteredRows.length ? <tr><td colSpan="8"><div className="inventory-empty-row">Chưa có lệnh sản xuất hoặc sơ chế phù hợp.</div></td></tr> : null}
          </tbody>
        </table>
      </div>

      {modal ? <InventoryProductionOrderModal mode={modal.mode} order={modal.order} boms={boms} warehouses={warehouses} warehouseSelectionLocked={warehouseSelectionLocked} isSaving={busy} onClose={() => setModal(null)} onSave={onSave} onComplete={onComplete} /> : null}

      {confirmation ? (
        <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirmation(null)}>
          <section className="inventory-warehouse-modal inventory-bom-confirm-modal" role="alertdialog" aria-modal="true">
            <header><div className="inventory-modal-heading"><span className={confirmation.type !== "start" ? "is-danger" : ""}><Icon name={confirmation.type === "start" ? "play" : "warning"} size={20} /></span><div><h2>{confirmation.type === "start" ? "Bắt đầu lệnh sản xuất?" : confirmation.type === "delete" ? "Xóa bản nháp?" : "Hủy lệnh đang làm?"}</h2><p>{confirmation.order.orderNo} · {confirmation.order.outputItem?.name}</p></div></div><button type="button" className="inventory-modal-close" onClick={() => setConfirmation(null)}><Icon name="close" size={18} /></button></header>
            <div className="inventory-bom-confirm-modal__body">
              {confirmation.type === "start" ? <div className="inventory-bom-confirm-modal__notice is-success"><Icon name="check" size={18} /><div><strong>Chưa trừ tồn ở bước này</strong><span>Bắt đầu thực hiện. Tồn kho chỉ thay đổi khi hoàn thành.</span></div></div> : null}
              {confirmation.type === "delete" ? <div className="inventory-bom-confirm-modal__notice is-warning"><Icon name="warning" size={18} /><div><strong>Chỉ xóa bản nháp</strong><span>Không có tồn kho nào bị thay đổi.</span></div></div> : null}
              {confirmation.type === "cancel" ? <label className="inventory-form-field"><span>Lý do hủy *</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: thay đổi kế hoạch sản xuất" autoFocus /></label> : null}
            </div>
            <footer className="inventory-bom-confirm-modal__footer"><button type="button" onClick={() => setConfirmation(null)}>Đóng</button><button type="button" className={confirmation.type === "start" ? "is-primary" : "is-danger"} disabled={busy || (confirmation.type === "cancel" && !reason.trim())} onClick={confirmAction}>{busy ? "Đang xử lý..." : "Xác nhận"}</button></footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
