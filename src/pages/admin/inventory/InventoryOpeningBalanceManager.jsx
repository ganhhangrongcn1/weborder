import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventoryOpeningBalanceModal from "./InventoryOpeningBalanceModal.jsx";

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export default function InventoryOpeningBalanceManager({ rows = [], warehouses = [], items = [], units = [], canWrite = false, mutationStatus = "idle", mutationMessage = "", onCreate }) {
  const [modal, setModal] = useState(null);
  const activeWarehouses = warehouses.filter((warehouse) => warehouse.isActive !== false && !warehouse.isDraft);
  const documentByWarehouse = useMemo(() => new Map(rows.map((row) => [row.warehouseId, row])), [rows]);
  const completedCount = activeWarehouses.filter((warehouse) => documentByWarehouse.has(warehouse.id)).length;
  const progress = activeWarehouses.length ? Math.round((completedCount / activeWarehouses.length) * 100) : 0;

  return (
    <section className="inventory-list-card inventory-opening-manager">
      {mutationMessage ? <div className={`inventory-count-notice ${mutationStatus === "error" ? "is-error" : ""}`}><Icon name={mutationStatus === "error" ? "warning" : "check"} size={17} />{mutationMessage}</div> : null}
      <header className="inventory-opening-head"><span><Icon name="download" size={21} /></span><div><strong>Khởi tạo tồn kho ban đầu</strong><small>Nhập số lượng thực tế và giá vốn tại thời điểm bắt đầu dùng phần mềm.</small></div><div className="inventory-opening-progress-label"><strong>{completedCount}/{activeWarehouses.length} kho</strong><span>đã khởi tạo</span></div></header>
      <div className="inventory-opening-progress"><span style={{ width: `${progress}%` }} /><strong>{progress}%</strong></div>
      <div className="inventory-opening-safe-note"><Icon name="info" size={17} /><span>Kho đã ghi nhận sẽ được khóa. Mọi phát sinh sau đó dùng Phiếu nhập kho, Phiếu xuất kho hoặc Điều chỉnh tồn.</span></div>
      {activeWarehouses.length ? <div className="inventory-opening-grid">{activeWarehouses.map((warehouse) => {
        const document = documentByWarehouse.get(warehouse.id);
        return (
          <article key={warehouse.id} className={`inventory-opening-card${document ? " is-completed" : ""}`}>
            <div className="inventory-opening-card__icon"><Icon name={warehouse.warehouseType === "central" ? "store" : "home"} size={20} /></div>
            <div className="inventory-opening-card__content"><strong>{warehouse.name}</strong><small>{warehouse.code || "Kho đang hoạt động"}</small>{document ? <span><Icon name="check" size={14} />Đã ghi nhận {formatDate(document.completedAt || document.occurredAt)}</span> : <span className="is-pending"><Icon name="clock" size={14} />Chưa nhập tồn đầu kỳ</span>}</div>
            {document ? <button type="button" onClick={() => setModal({ mode: "view", warehouse, document })}><Icon name="eye" size={15} />Xem phiếu</button> : <button type="button" className="is-primary" disabled={!canWrite} onClick={() => setModal({ mode: "create", warehouse })}><Icon name="plus" size={15} />Nhập tồn đầu kỳ</button>}
          </article>
        );
      })}</div> : <div className="inventory-list-empty"><Icon name="store" size={28} /><strong>Chưa có kho đang hoạt động</strong><span>Hãy tạo kho trước khi nhập tồn đầu kỳ.</span></div>}
      <div className={`inventory-readonly-footnote${canWrite ? " is-writable" : ""}`}><Icon name={canWrite ? "check" : "eye"} size={16} /><span>{canWrite ? "Admin và Tổng kho được ghi nhận tồn đầu kỳ cho toàn bộ kho." : "Chế độ chỉ đọc: chỉ Admin hoặc Tổng kho mới được ghi nhận tồn đầu kỳ."}</span></div>
      {modal ? <InventoryOpeningBalanceModal mode={modal.mode} warehouse={modal.warehouse} document={modal.document} items={items} units={units} saving={mutationStatus === "saving"} onClose={() => setModal(null)} onSave={onCreate} /> : null}
    </section>
  );
}
