import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventoryDocumentActionModal from "./InventoryDocumentActionModal.jsx";
import InventoryDocumentDetailModal from "./InventoryDocumentDetailModal.jsx";
import InventoryDocumentModal from "./InventoryDocumentModal.jsx";

const DOMAIN_CONFIG = {
  receipts: { title: "Phiếu nhập kho", action: "Tạo phiếu nhập", icon: "download", warehouseColumn: "Kho nhận", empty: "Chưa có phiếu nhập kho." },
  issues: { title: "Phiếu xuất kho", action: "Tạo phiếu xuất", icon: "share", warehouseColumn: "Kho xuất", empty: "Chưa có phiếu xuất kho." },
  transfers: { title: "Chuyển kho nội bộ", action: "Tạo phiếu chuyển", icon: "refresh", warehouseColumn: "Luồng chuyển", empty: "Chưa có phiếu chuyển kho." },
  disposals: { title: "Phiếu hủy", action: "Tạo phiếu hủy", icon: "trash", warehouseColumn: "Kho hủy", empty: "Chưa có phiếu hủy nào." },
  requisitions: { title: "Yêu cầu xuất kho", action: "Tạo yêu cầu", icon: "bell", warehouseColumn: "Kho yêu cầu", empty: "Chưa có yêu cầu xuất kho." }
};

const STATUS_LABELS = {
  draft: "Bản nháp",
  submitted: "Chờ xử lý",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  in_transit: "Đang chuyển",
  received: "Đã nhận",
  received_with_variance: "Nhận lệch",
  fulfilled: "Đã cấp hàng",
  completed: "Hoàn tất",
  cancelled: "Đã hủy"
};

function formatDate(value = "") {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function InventoryDocumentManager({
  domain,
  rows = [],
  warehouses = [],
  items = [],
  suppliers = [],
  canWrite = false,
  canApproveDisposals = false,
  mutationStatus = "idle",
  mutationMessage = "",
  onSave,
  onDeleteDraft,
  onSubmit,
  onComplete,
  onDispatchTransfer,
  onReceiveTransfer,
  onCompleteTransfer,
  onApproveRequisition,
  onRejectRequisition,
  onCreateRequisitionTransfer,
  onFulfillRequisition,
  requestCreationMode = "warehouse_self"
}) {
  const config = DOMAIN_CONFIG[domain] || DOMAIN_CONFIG.receipts;
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [actionError, setActionError] = useState("");
  const [actionModal, setActionModal] = useState(null);
  const [detailDocument, setDetailDocument] = useState(null);
  const warehouseMap = useMemo(() => new Map(warehouses.map((row) => [row.id, row.name])), [warehouses]);
  const supplierMap = useMemo(() => new Map(suppliers.map((row) => [row.id, row.name])), [suppliers]);
  const visibleRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi-VN");
    return rows.filter((row) => {
      const lineReasons = row.lines.map((line) => line.disposalReason || line.notes).join(" ");
      const text = [row.documentNo, row.notes, row.metadata?.disposal_reason, lineReasons, supplierMap.get(row.supplierId)].join(" ").toLocaleLowerCase("vi-VN");
      return (!keyword || text.includes(keyword)) && (status === "all" || row.status === status);
    });
  }, [rows, search, status, supplierMap]);
  const draftCount = rows.filter((row) => row.status === "draft").length;
  const pendingCount = rows.filter((row) => ["submitted", "approved", "in_transit", "received", "received_with_variance"].includes(row.status)).length;
  const completedCount = rows.filter((row) => ["completed", "fulfilled"].includes(row.status)).length;

  const getWarehouseLabel = (row) => {
    if (domain === "transfers") return `${warehouseMap.get(row.sourceWarehouseId) || "—"} → ${warehouseMap.get(row.destinationWarehouseId) || "—"}`;
    const id = ["issues", "disposals"].includes(domain) ? row.sourceWarehouseId : row.destinationWarehouseId;
    return warehouseMap.get(id) || "—";
  };

  const getDisposalReasonLabel = (row) => {
    const defaultReason = row.metadata?.disposal_reason || "";
    const reasons = [...new Set(row.lines.map((line) => line.disposalReason || line.notes || defaultReason).filter(Boolean))];
    if (reasons.length > 1) return "Nhiều lý do";
    return reasons[0] || defaultReason || "—";
  };

  const runAction = async (action) => {
    setActionError("");
    try {
      await action();
    } catch (error) {
      setActionError(error.message || "Không thể xử lý phiếu.");
    }
  };

  const confirmModalAction = async ({ sourceWarehouseId, lines, rejectionReason }) => {
    const { mode, document } = actionModal;
    if (mode === "dispatch") return onDispatchTransfer(document.id, lines);
    if (mode === "receive") return onReceiveTransfer(document.id, lines);
    if (mode === "approve") return onApproveRequisition(document.id, sourceWarehouseId, lines);
    if (mode === "reject") return onRejectRequisition(document.id, sourceWarehouseId, rejectionReason);
    if (mode === "delete") return onDeleteDraft(document.id);
    return null;
  };

  const renderRowActions = (row) => {
    const disabled = !canWrite || mutationStatus === "saving";
    if (row.status === "draft") {
      return <>
        <button className="is-danger" type="button" disabled={disabled} onClick={() => setActionModal({ mode: "delete", document: row })}><Icon name="trash" size={14} />Xóa</button>
        <button type="button" disabled={disabled} onClick={() => runAction(() => onSubmit(row.id))}>Gửi xử lý</button>
      </>;
    }
    if (row.status === "submitted" && ["receipts", "issues", "disposals"].includes(domain)) {
      if (domain === "disposals" && !canApproveDisposals) {
        return <span className="inventory-waiting-approval">Chờ Admin/Quản lý kho duyệt</span>;
      }
      return <button className="is-primary" type="button" disabled={disabled} onClick={() => runAction(() => onComplete(row.id))}>Hoàn tất</button>;
    }
    if (domain === "transfers") {
      if (["submitted", "approved"].includes(row.status)) {
        return <button className="is-primary" type="button" disabled={disabled} onClick={() => setActionModal({ mode: "dispatch", document: row })}>Giao hàng</button>;
      }
      if (row.status === "in_transit") {
        return <button className="is-primary" type="button" disabled={disabled} onClick={() => setActionModal({ mode: "receive", document: row })}>Nhận hàng</button>;
      }
      if (row.status === "received_with_variance") {
        return <button className="is-primary" type="button" disabled={disabled} onClick={() => runAction(() => onCompleteTransfer(row.id))}>Đối chiếu & khép phiếu</button>;
      }
      if (row.status === "received") {
        return <button type="button" disabled={disabled} onClick={() => runAction(() => onCompleteTransfer(row.id))}>Khép phiếu cũ</button>;
      }
    }
    if (domain === "requisitions") {
      if (row.status === "submitted") {
        return <>
          <button className="is-primary" type="button" disabled={disabled} onClick={() => setActionModal({ mode: "approve", document: row })}>Duyệt</button>
          <button type="button" disabled={disabled} onClick={() => setActionModal({ mode: "reject", document: row })}>Từ chối</button>
        </>;
      }
      if (row.status === "approved" && !row.linkedTransfer) {
        return <button type="button" disabled={disabled} onClick={() => runAction(() => onCreateRequisitionTransfer(row.id))}>Tạo phiếu còn thiếu</button>;
      }
      if (row.status === "approved" && row.linkedTransfer?.status === "completed") {
        return <button type="button" disabled={disabled} onClick={() => runAction(() => onFulfillRequisition(row.id))}>Khép yêu cầu cũ</button>;
      }
      if (row.status === "approved" && row.linkedTransfer) {
        return <span className="inventory-linked-transfer">Chờ {row.linkedTransfer.documentNo}</span>;
      }
    }
    return <span>—</span>;
  };

  const guideText = domain === "transfers"
    ? <span><strong>Giao hàng</strong> trừ kho xuất. <strong>Nhận đủ</strong> cộng kho nhận và tự khép phiếu. Nhận lệch sẽ chờ đối chiếu.</span>
    : domain === "requisitions"
      ? <span><strong>Duyệt</strong> là hệ thống tự tạo phiếu giao hàng. Nhân viên chỉ cần qua <strong>Chuyển kho nội bộ</strong> để giao và nhận.</span>
      : domain === "disposals"
        ? <span><strong>Lưu nháp</strong> chưa trừ tồn. Chỉ khi bấm <strong>Hoàn tất</strong>, hệ thống mới trừ đúng kho và lưu lý do hủy.</span>
      : <span><strong>Bản nháp</strong> chưa thay đổi tồn kho. Chỉ khi bấm <strong>Hoàn tất</strong> hệ thống mới ghi sổ kho.</span>;

  return (
    <section className="inventory-list-card inventory-document-card">
      <div className="inventory-master-intro">
        <span><Icon name={config.icon} size={21} /></span>
        <div><strong>{config.title}</strong><small>Giao diện nhập nhanh, chỉ giữ các thông tin cần cho vận hành kho hiện tại.</small></div>
        <button type="button" disabled={!canWrite} onClick={() => setShowModal(true)}><Icon name="plus" size={16} />{config.action}</button>
      </div>
      <div className="inventory-document-guide">
        <Icon name="info" size={16} />
        {guideText}
      </div>
      <div className="inventory-summary-grid inventory-document-summary">
        <div><span>Tổng phiếu</span><strong>{rows.length}</strong></div>
        <div><span>Bản nháp</span><strong>{draftCount}</strong></div>
        <div><span>Chờ xử lý</span><strong>{pendingCount}</strong></div>
        <div><span>Đã hoàn tất</span><strong>{completedCount}</strong></div>
      </div>
      <div className="inventory-list-toolbar">
        <label className="inventory-search-field"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo mã phiếu, ghi chú…" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {mutationMessage || actionError ? <div className={`inventory-operation-message ${mutationStatus === "error" || actionError ? "is-error" : ""}`}>{actionError || mutationMessage}</div> : null}
      <div className="inventory-table-scroll">
        <table className="inventory-data-table inventory-document-table">
          <thead><tr><th>Mã phiếu</th><th>{domain === "disposals" ? "Ngày hủy" : "Ngày lập"}</th><th>{config.warehouseColumn}</th>{domain === "receipts" ? <th>Nhà cung cấp</th> : null}{domain === "disposals" ? <th>Lý do hủy</th> : null}<th>Nguyên vật liệu</th>{domain === "receipts" ? <th>Tổng tiền</th> : null}<th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.documentNo}</strong></td>
                <td>{formatDate(row.occurredAt)}</td>
                <td><strong>{getWarehouseLabel(row)}</strong></td>
                {domain === "receipts" ? <td>{supplierMap.get(row.supplierId) || "—"}</td> : null}
                {domain === "disposals" ? <td><span className={`inventory-disposal-reason ${getDisposalReasonLabel(row) === "Nhiều lý do" ? "is-multiple" : ""}`}>{getDisposalReasonLabel(row)}</span></td> : null}
                <td><strong>{row.lines.length} mặt hàng</strong><small>{row.notes || "Không có ghi chú"}</small></td>
                {domain === "receipts" ? <td><strong>{row.totalAmount.toLocaleString("vi-VN")} đ</strong></td> : null}
                <td><span className={`inventory-document-status is-${row.status}`}>{STATUS_LABELS[row.status] || row.status}</span></td>
                <td>
                  <div className="inventory-document-actions">
                    <button type="button" onClick={() => setDetailDocument(row)}><Icon name="eye" size={14} />Xem</button>
                    {renderRowActions(row)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visibleRows.length ? <div className="inventory-list-empty"><Icon name={config.icon} size={28} /><strong>{config.empty}</strong><span>Tạo phiếu đầu tiên khi dữ liệu kho và nguyên vật liệu đã sẵn sàng.</span></div> : null}
      {showModal ? <InventoryDocumentModal domain={domain} warehouses={warehouses} items={items} suppliers={suppliers} requestCreationMode={requestCreationMode} onClose={() => setShowModal(false)} onSave={onSave} /> : null}
      {detailDocument ? <InventoryDocumentDetailModal domain={domain} document={detailDocument} warehouses={warehouses} items={items} suppliers={suppliers} onClose={() => setDetailDocument(null)} /> : null}
      {actionModal ? <InventoryDocumentActionModal mode={actionModal.mode} document={actionModal.document} warehouses={warehouses} items={items} onClose={() => setActionModal(null)} onConfirm={confirmModalAction} /> : null}
    </section>
  );
}
