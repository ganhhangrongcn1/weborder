import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import InventoryCountModal from "./InventoryCountModal.jsx";

const STATUS = {
  draft: { label: "Bản nháp", className: "is-draft" },
  counting: { label: "Đang kiểm", className: "is-processing" },
  submitted: { label: "Chờ duyệt", className: "is-pending" },
  approved: { label: "Đã duyệt", className: "is-approved" },
  completed: { label: "Hoàn tất", className: "is-completed" },
  cancelled: { label: "Đã hủy", className: "is-cancelled" }
};

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function InventoryCountManager({ rows = [], warehouses = [], items = [], units = [], canWrite = false, canManage = false, canCancel = false, canCount = false, mutationStatus = "idle", mutationMessage = "", onCreateAndStart, onRecordAndSubmit, onApproveAndComplete, onCancel, onCompleteApproved, warehouseSelectionLocked = false, defaultWarehouseId = "" }) {
  const [modal, setModal] = useState(null);
  const [cancellation, setCancellation] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [localNotice, setLocalNotice] = useState("");
  const warehouseById = useMemo(() => new Map(warehouses.map((row) => [row.id, row])), [warehouses]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (statusFilter === "active" && ["completed", "cancelled"].includes(row.status)) return false;
    if (statusFilter !== "all" && statusFilter !== "active" && row.status !== statusFilter) return false;
    const keyword = search.trim().toLocaleLowerCase("vi");
    return !keyword || `${row.documentNo} ${warehouseById.get(row.warehouseId)?.name || ""}`.toLocaleLowerCase("vi").includes(keyword);
  }), [rows, search, statusFilter, warehouseById]);
  const pendingCount = rows.filter((row) => row.status === "submitted").length;
  const activeCount = rows.filter((row) => ["draft", "counting", "submitted", "approved"].includes(row.status)).length;

  const complete = async (row) => {
    try {
      await onCompleteApproved(row.id);
      setLocalNotice("Đã hoàn tất kiểm kê và cập nhật tồn kho.");
    } catch (error) {
      setLocalNotice(error.message || "Không thể hoàn tất kiểm kê.");
    }
  };

  const cancel = async () => {
    if (!cancellation?.id || !cancellationReason.trim()) return;
    try {
      await onCancel(cancellation.id, cancellationReason);
      setCancellation(null);
      setCancellationReason("");
      setLocalNotice("Đã hủy đợt kiểm kê. Tồn kho không thay đổi.");
    } catch (error) {
      setLocalNotice(error.message || "Không thể hủy đợt kiểm kê.");
    }
  };

  return (
    <section className="inventory-list-card inventory-count-manager">
      {(mutationMessage || localNotice) ? <div className={`inventory-count-notice ${mutationStatus === "error" ? "is-error" : ""}`}><Icon name={mutationStatus === "error" ? "warning" : "check"} size={17} />{localNotice || mutationMessage}</div> : null}
      <header className="inventory-count-manager__head"><span><Icon name="check" size={21} /></span><div><strong>Đợt kiểm kê kho</strong><small>Đếm thực tế, đối chiếu chênh lệch rồi mới điều chỉnh tồn sau khi quản lý duyệt.</small></div><button type="button" disabled={!canWrite || !canManage} onClick={() => setModal({ mode: "create" })}><Icon name="plus" size={17} />Tạo đợt kiểm kê</button></header>
      <div className="inventory-summary-grid"><div><span>Tổng đợt kiểm</span><strong>{rows.length}</strong></div><div><span>Đang xử lý</span><strong>{activeCount}</strong></div><div className="is-warning"><span>Chờ duyệt</span><strong>{pendingCount}</strong></div><div><span>Hoàn tất</span><strong>{rows.filter((row) => row.status === "completed").length}</strong></div></div>
      <div className="inventory-list-toolbar"><label className="inventory-search-field"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã phiếu hoặc kho..." /></label><InventorySearchableSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">Đang cần xử lý</option><option value="all">Tất cả trạng thái</option><option value="counting">Đang kiểm</option><option value="submitted">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="completed">Hoàn tất</option><option value="cancelled">Đã hủy</option></InventorySearchableSelect></div>
      {filteredRows.length ? <div className="inventory-table-scroll"><table className="inventory-data-table inventory-count-table"><thead><tr><th>Mã phiếu</th><th>Kho kiểm kê</th><th>Ngày bắt đầu</th><th>Nguyên vật liệu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{filteredRows.map((row) => {
        const status = STATUS[row.status] || { label: row.status || "—", className: "" };
        return <tr key={row.id}><td><strong>{row.documentNo}</strong><small>{row.status === "cancelled" ? row.cancellationReason || "Đã hủy" : row.notes || "Không có ghi chú"}</small></td><td><strong>{warehouseById.get(row.warehouseId)?.name || "Kho không còn hoạt động"}</strong></td><td>{formatDate(row.occurredAt || row.createdAt)}</td><td>{row.lines.length} mã</td><td><span className={`inventory-document-status ${status.className}`}>{status.label}</span></td><td><div className="inventory-row-actions inventory-count-actions"><button type="button" onClick={() => setModal({ mode: "view", count: row })}><Icon name="eye" size={15} />Xem</button>{row.status === "counting" && canWrite && canCount ? <button type="button" className="is-primary" onClick={() => setModal({ mode: "count", count: row })}>Nhập số đếm</button> : null}{row.status === "counting" && canWrite && canCancel ? <button type="button" className="is-danger" onClick={() => { setCancellation(row); setCancellationReason(""); }}><Icon name="close" size={14} />Hủy</button> : null}{row.status === "submitted" && canWrite && canManage ? <button type="button" className="is-primary" onClick={() => setModal({ mode: "review", count: row })}>Duyệt</button> : null}{row.status === "approved" && canWrite && canManage ? <button type="button" className="is-primary" onClick={() => complete(row)}>Hoàn tất</button> : null}</div></td></tr>;
      })}</tbody></table></div> : <div className="inventory-list-empty"><Icon name="check" size={28} /><strong>Không có đợt kiểm kê cần xử lý</strong><span>Bấm “Tạo đợt kiểm kê” khi cần đối chiếu tồn thực tế.</span></div>}
      <div className={`inventory-readonly-footnote${canWrite ? " is-writable" : ""}`}><Icon name={canWrite ? "check" : "eye"} size={16} /><span>{canWrite ? "Kiểm kê dùng dữ liệu Supabase và chỉ điều chỉnh tồn sau khi quản lý duyệt." : "Chế độ chỉ đọc: thao tác kiểm kê đang bị khóa an toàn."}</span></div>
      {modal ? <InventoryCountModal mode={modal.mode} count={modal.count} warehouses={warehouses} items={items} units={units} warehouseSelectionLocked={warehouseSelectionLocked} defaultWarehouseId={defaultWarehouseId} saving={mutationStatus === "saving"} onClose={() => setModal(null)} onCreate={onCreateAndStart} onSubmitCount={onRecordAndSubmit} onApprove={onApproveAndComplete} /> : null}
      {cancellation ? <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCancellation(null)}><section className="inventory-warehouse-modal inventory-bom-confirm-modal" role="alertdialog" aria-modal="true"><header><div className="inventory-modal-heading"><span className="is-danger"><Icon name="warning" size={20} /></span><div><h2>Hủy đợt kiểm kê?</h2><p>{cancellation.documentNo} · {warehouseById.get(cancellation.warehouseId)?.name || "Kho kiểm kê"}</p></div></div><button type="button" className="inventory-modal-close" onClick={() => setCancellation(null)} aria-label="Đóng"><Icon name="close" size={18} /></button></header><div className="inventory-bom-confirm-modal__body"><div className="inventory-bom-confirm-modal__notice is-warning"><Icon name="warning" size={18} /><div><strong>Tồn kho sẽ không thay đổi</strong><span>Phiếu được chuyển sang Đã hủy và vẫn giữ lịch sử để đối chiếu.</span></div></div><label className="inventory-form-field"><span>Lý do hủy *</span><input value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} placeholder="Ví dụ: Tạo nhầm kho kiểm kê" autoFocus /></label></div><footer className="inventory-bom-confirm-modal__footer"><button type="button" onClick={() => setCancellation(null)}>Đóng</button><button type="button" className="is-danger" disabled={mutationStatus === "saving" || !cancellationReason.trim()} onClick={cancel}>{mutationStatus === "saving" ? "Đang hủy..." : "Xác nhận hủy"}</button></footer></section></div> : null}
    </section>
  );
}
