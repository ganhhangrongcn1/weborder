import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import InventoryCountModal from "./InventoryCountModal.jsx";

const STATUS = {
  draft: { label: "Bản nháp", className: "is-draft" },
  counting: { label: "Đang kiểm", className: "is-processing" },
  submitted: { label: "Chờ duyệt", className: "is-pending" },
  approved: { label: "Đã duyệt", className: "is-approved" },
  completed: { label: "Hoàn tất", className: "is-completed" }
};

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function InventoryCountManager({ rows = [], warehouses = [], items = [], units = [], canWrite = false, canManage = false, canCount = false, mutationStatus = "idle", mutationMessage = "", onCreateAndStart, onRecordAndSubmit, onApproveAndComplete, onCompleteApproved, warehouseSelectionLocked = false }) {
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [localNotice, setLocalNotice] = useState("");
  const warehouseById = useMemo(() => new Map(warehouses.map((row) => [row.id, row])), [warehouses]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (statusFilter === "active" && row.status === "completed") return false;
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

  return (
    <section className="inventory-list-card inventory-count-manager">
      {(mutationMessage || localNotice) ? <div className={`inventory-count-notice ${mutationStatus === "error" ? "is-error" : ""}`}><Icon name={mutationStatus === "error" ? "warning" : "check"} size={17} />{localNotice || mutationMessage}</div> : null}
      <header className="inventory-count-manager__head"><span><Icon name="check" size={21} /></span><div><strong>Đợt kiểm kê kho</strong><small>Đếm thực tế, đối chiếu chênh lệch rồi mới điều chỉnh tồn sau khi quản lý duyệt.</small></div><button type="button" disabled={!canWrite || !canManage} onClick={() => setModal({ mode: "create" })}><Icon name="plus" size={17} />Tạo đợt kiểm kê</button></header>
      <div className="inventory-summary-grid"><div><span>Tổng đợt kiểm</span><strong>{rows.length}</strong></div><div><span>Đang xử lý</span><strong>{activeCount}</strong></div><div className="is-warning"><span>Chờ duyệt</span><strong>{pendingCount}</strong></div><div><span>Hoàn tất</span><strong>{rows.filter((row) => row.status === "completed").length}</strong></div></div>
      <div className="inventory-list-toolbar"><label className="inventory-search-field"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã phiếu hoặc kho..." /></label><InventorySearchableSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">Đang cần xử lý</option><option value="all">Tất cả trạng thái</option><option value="counting">Đang kiểm</option><option value="submitted">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="completed">Hoàn tất</option></InventorySearchableSelect></div>
      {filteredRows.length ? <div className="inventory-table-scroll"><table className="inventory-data-table inventory-count-table"><thead><tr><th>Mã phiếu</th><th>Kho kiểm kê</th><th>Ngày bắt đầu</th><th>Nguyên vật liệu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{filteredRows.map((row) => {
        const status = STATUS[row.status] || { label: row.status || "—", className: "" };
        return <tr key={row.id}><td><strong>{row.documentNo}</strong><small>{row.notes || "Không có ghi chú"}</small></td><td><strong>{warehouseById.get(row.warehouseId)?.name || "Kho không còn hoạt động"}</strong></td><td>{formatDate(row.occurredAt || row.createdAt)}</td><td>{row.lines.length} mã</td><td><span className={`inventory-document-status ${status.className}`}>{status.label}</span></td><td><div className="inventory-row-actions inventory-count-actions"><button type="button" onClick={() => setModal({ mode: "view", count: row })}><Icon name="eye" size={15} />Xem</button>{row.status === "counting" && canWrite && canCount ? <button type="button" className="is-primary" onClick={() => setModal({ mode: "count", count: row })}>Nhập số đếm</button> : null}{row.status === "submitted" && canWrite && canManage ? <button type="button" className="is-primary" onClick={() => setModal({ mode: "review", count: row })}>Duyệt</button> : null}{row.status === "approved" && canWrite && canManage ? <button type="button" className="is-primary" onClick={() => complete(row)}>Hoàn tất</button> : null}</div></td></tr>;
      })}</tbody></table></div> : <div className="inventory-list-empty"><Icon name="check" size={28} /><strong>Không có đợt kiểm kê cần xử lý</strong><span>Bấm “Tạo đợt kiểm kê” khi cần đối chiếu tồn thực tế.</span></div>}
      <div className={`inventory-readonly-footnote${canWrite ? " is-writable" : ""}`}><Icon name={canWrite ? "check" : "eye"} size={16} /><span>{canWrite ? "Kiểm kê dùng dữ liệu Supabase và chỉ điều chỉnh tồn sau khi quản lý duyệt." : "Chế độ chỉ đọc: thao tác kiểm kê đang bị khóa an toàn."}</span></div>
      {modal ? <InventoryCountModal mode={modal.mode} count={modal.count} warehouses={warehouses} items={items} units={units} warehouseSelectionLocked={warehouseSelectionLocked} saving={mutationStatus === "saving"} onClose={() => setModal(null)} onCreate={onCreateAndStart} onSubmitCount={onRecordAndSubmit} onApprove={onApproveAndComplete} /> : null}
    </section>
  );
}
