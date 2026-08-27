import { useMemo } from "react";
import Icon from "../../../components/Icon.jsx";

const DOMAIN_CONFIG = {
  receipts: { title: "Chi tiết phiếu nhập kho", icon: "download" },
  issues: { title: "Chi tiết phiếu xuất kho", icon: "share" },
  transfers: { title: "Chi tiết chuyển kho nội bộ", icon: "refresh" },
  disposals: { title: "Chi tiết phiếu hủy", icon: "trash" },
  requisitions: { title: "Chi tiết yêu cầu xuất kho", icon: "bell" },
  adjustments: { title: "Chi tiết phiếu điều chỉnh tồn", icon: "edit" }
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

function formatDateOnly(value = "") {
  if (!value) return "Không theo dõi";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(`${value}T00:00:00`));
}

function formatQuantity(value) {
  if (value == null || value === "") return "—";
  return Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function firstQuantity(...values) {
  return values.find((value) => value != null) ?? 0;
}

function getUnitName(item, line, unitMap) {
  const unit = unitMap.get(line?.unitId);
  return unit?.name || unit?.symbol || item?.purchaseUnit?.name || item?.baseUnit?.name || "Đơn vị";
}

function QuantityDifference({ value, available = true }) {
  if (!available) return <span>—</span>;
  const quantity = Number(value || 0);
  return <span className={`inventory-detail-variance ${quantity !== 0 ? "is-different" : ""}`}>{quantity > 0 ? "+" : ""}{formatQuantity(quantity)}</span>;
}

export default function InventoryDocumentDetailModal({
  domain,
  document,
  warehouses = [],
  items = [],
  units = [],
  suppliers = [],
  onClose
}) {
  const config = DOMAIN_CONFIG[domain] || DOMAIN_CONFIG.receipts;
  const warehouseMap = useMemo(() => new Map(warehouses.map((row) => [row.id, row.name])), [warehouses]);
  const itemMap = useMemo(() => new Map(items.map((row) => [row.id, row])), [items]);
  const unitMap = useMemo(() => new Map(units.map((row) => [row.id, row])), [units]);
  const supplierMap = useMemo(() => new Map(suppliers.map((row) => [row.id, row.name])), [suppliers]);
  const sourceWarehouse = warehouseMap.get(document.sourceWarehouseId) || "—";
  const destinationWarehouse = warehouseMap.get(document.destinationWarehouseId) || "—";
  const warehouseFlow = domain === "transfers"
    ? `${sourceWarehouse} → ${destinationWarehouse}`
    : ["issues", "disposals", "adjustments"].includes(domain) ? sourceWarehouse : destinationWarehouse;

  const renderLineHeader = () => {
    if (domain === "transfers") return <tr><th>Nguyên vật liệu</th><th>Đơn vị</th><th>Yêu cầu</th><th>Duyệt</th><th>Đã giao</th><th>Đã nhận</th><th>Chênh lệch</th><th>Lý do</th></tr>;
    if (domain === "requisitions") return <tr><th>Nguyên vật liệu</th><th>Đơn vị</th><th>Yêu cầu</th><th>Đã duyệt</th><th>Đã giao</th><th>Đã nhận</th><th>Chênh lệch nhận</th><th>Lý do</th></tr>;
    if (domain === "receipts") return <tr><th>Nguyên vật liệu</th><th>Đơn vị</th><th>Thực nhập</th><th>Mã lô</th><th>Hạn sử dụng</th><th>Đơn giá</th><th>Thành tiền</th></tr>;
    if (domain === "disposals") return <tr><th>Nguyên vật liệu</th><th>Đơn vị</th><th>Số lượng hủy</th><th>Lý do hủy</th></tr>;
    if (domain === "adjustments") return <tr><th>Nguyên vật liệu</th><th>Đơn vị</th><th>Điều chỉnh</th><th>Số lượng</th><th>Lý do</th></tr>;
    return <tr><th>Nguyên vật liệu</th><th>Đơn vị</th><th>Số trên phiếu</th><th>Thực xuất</th><th>Ghi chú</th></tr>;
  };

  const renderLine = (line) => {
    const item = itemMap.get(line.itemId);
    const expected = Number(line.expectedQuantity || 0);
    const approved = firstQuantity(line.approvedQuantity, line.expectedQuantity);
    const shipped = firstQuantity(line.shippedQuantity, line.approvedQuantity, line.expectedQuantity);
    const received = firstQuantity(line.receivedQuantity, line.actualQuantity);
    const actual = firstQuantity(line.actualQuantity, line.expectedQuantity);
    const reason = line.varianceReason || line.rejectionReason || line.notes || "—";

    if (domain === "transfers") {
      const hasVariance = line.receivedQuantity != null && line.shippedQuantity != null;
      return <tr key={line.id}><td><strong>{item?.name || "Nguyên vật liệu"}</strong><small>{item?.code || ""}</small></td><td>{getUnitName(item, line, unitMap)}</td><td>{formatQuantity(expected)}</td><td>{formatQuantity(approved)}</td><td>{formatQuantity(line.shippedQuantity)}</td><td>{formatQuantity(line.receivedQuantity)}</td><td><QuantityDifference available={hasVariance} value={received - shipped} /></td><td>{reason}</td></tr>;
    }
    if (domain === "requisitions") {
      const transferLine = document.linkedTransfer?.lines?.find((row) => row.itemId === line.itemId);
      const transferShipped = transferLine?.shippedQuantity;
      const transferReceived = transferLine?.receivedQuantity;
      const transferReason = transferLine?.varianceReason || line.rejectionReason || line.notes || "—";
      return <tr key={line.id}><td><strong>{item?.name || "Nguyên vật liệu"}</strong><small>{item?.code || ""}</small></td><td>{getUnitName(item, line, unitMap)}</td><td>{formatQuantity(expected)}</td><td>{formatQuantity(line.approvedQuantity)}</td><td>{formatQuantity(transferShipped)}</td><td>{formatQuantity(transferReceived)}</td><td><QuantityDifference available={transferShipped != null && transferReceived != null} value={Number(transferReceived || 0) - Number(transferShipped || 0)} /></td><td>{transferReason}</td></tr>;
    }
    if (domain === "receipts") {
      return <tr key={line.id}><td><strong>{item?.name || "Nguyên vật liệu"}</strong><small>{item?.code || ""}</small></td><td>{getUnitName(item, line, unitMap)}</td><td>{formatQuantity(actual)}</td><td><span className="inventory-lot-badge">{line.lotNumber || "—"}</span></td><td><span className={`inventory-expiry-badge ${line.expiresOn ? "has-expiry" : ""}`}>{formatDateOnly(line.expiresOn)}</span></td><td>{formatMoney(line.unitPrice)}</td><td><strong>{formatMoney(actual * Number(line.unitPrice || 0))}</strong></td></tr>;
    }
    if (domain === "disposals") {
      return <tr key={line.id}><td><strong>{item?.name || "Nguyên vật liệu"}</strong><small>{item?.code || ""}</small></td><td>{getUnitName(item, line, unitMap)}</td><td>{formatQuantity(actual)}</td><td><span className="inventory-disposal-reason">{line.disposalReason || line.notes || document.metadata?.disposal_reason || "—"}</span></td></tr>;
    }
    if (domain === "adjustments") {
      const isIncrease = line.adjustmentDirection === "in";
      const isDecrease = line.adjustmentDirection === "out";
      const directionLabel = isIncrease ? "+ Tăng tồn" : isDecrease ? "− Giảm tồn" : "Theo kiểm kê";
      return <tr key={line.id}><td><strong>{item?.name || "Nguyên vật liệu"}</strong><small>{item?.code || ""}</small></td><td>{getUnitName(item, line, unitMap)}</td><td><span className={`inventory-adjustment-direction ${isIncrease ? "is-increase" : isDecrease ? "is-decrease" : "is-from-count"}`}>{directionLabel}</span></td><td><strong>{formatQuantity(actual)}</strong></td><td>{document.notes || line.varianceReason || "—"}</td></tr>;
    }
    return <tr key={line.id}><td><strong>{item?.name || "Nguyên vật liệu"}</strong><small>{item?.code || ""}</small></td><td>{getUnitName(item, line, unitMap)}</td><td>{formatQuantity(expected)}</td><td>{formatQuantity(actual)}</td><td>{line.notes || "—"}</td></tr>;
  };

  return (
    <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="inventory-warehouse-modal inventory-detail-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-detail-title">
        <header>
          <div className="inventory-modal-heading">
            <span><Icon name={config.icon} size={20} /></span>
            <div><h2 id="inventory-detail-title">{config.title}</h2><p>Đối chiếu toàn bộ số lượng theo từng bước xử lý.</p></div>
          </div>
          <button type="button" aria-label="Đóng" onClick={onClose}><Icon name="close" size={18} /></button>
        </header>

        <div className="inventory-detail-readonly"><Icon name="eye" size={16} />Màn hình chỉ đọc, không làm thay đổi phiếu hoặc số tồn kho.</div>

        <div className="inventory-detail-body">
          <div className="inventory-detail-summary">
            <div><span>Mã phiếu</span><strong>{document.documentNo}</strong></div>
            <div><span>Trạng thái</span><strong><em className={`inventory-document-status is-${document.status}`}>{STATUS_LABELS[document.status] || document.status}</em></strong></div>
            <div><span>Ngày lập</span><strong>{formatDate(document.occurredAt)}</strong></div>
            <div className={domain === "requisitions" ? "is-destination-warehouse" : ""}><span>{domain === "transfers" ? "Luồng chuyển" : domain === "issues" ? "Kho xuất" : domain === "disposals" ? "Kho hủy" : domain === "adjustments" ? "Kho điều chỉnh" : "Kho nhận"}</span><strong>{warehouseFlow}</strong></div>
            {domain === "requisitions" ? <div><span>Cách tạo yêu cầu</span><strong>{document.metadata?.request_origin === "admin_on_behalf" ? "Admin tạo thay chi nhánh" : "Chi nhánh tự tạo"}</strong></div> : null}
            {domain === "receipts" ? <div><span>Nhà cung cấp</span><strong>{supplierMap.get(document.supplierId) || "—"}</strong></div> : null}
            {domain === "receipts" ? <div><span>Tổng tiền</span><strong>{formatMoney(document.totalAmount)}</strong></div> : null}
            {domain === "disposals" ? <div><span>Lý do hủy chung</span><strong>{document.metadata?.disposal_reason || "—"}</strong></div> : null}
            <div className="is-wide"><span>{domain === "adjustments" ? "Lý do điều chỉnh" : "Ghi chú"}</span><strong>{document.notes || "Không có ghi chú"}</strong></div>
            {document.rejectionReason ? <div className="is-wide is-rejection"><span>Lý do từ chối</span><strong>{document.rejectionReason}</strong></div> : null}
            {document.cancellationReason ? <div className="is-wide is-rejection"><span>Lý do hoàn tác / hủy</span><strong>{document.cancellationReason}</strong></div> : null}
          </div>

          {domain === "requisitions" ? (
            <div className={`inventory-detail-linked ${document.linkedTransfer ? "has-transfer" : ""}`}>
              <Icon name="refresh" size={18} />
              <div>
                <span>Phiếu chuyển kho liên kết</span>
                <strong>{document.linkedTransfer ? document.linkedTransfer.documentNo : "Chưa tạo phiếu chuyển"}</strong>
                <small>{document.linkedTransfer ? `Trạng thái: ${STATUS_LABELS[document.linkedTransfer.status] || document.linkedTransfer.status}` : "Yêu cầu được duyệt xong mới tạo phiếu chuyển để giao và nhận hàng."}</small>
              </div>
            </div>
          ) : null}

          <div className="inventory-detail-section">
            <div className="inventory-detail-section__head"><div><Icon name="tag" size={17} /><strong>Đối chiếu nguyên vật liệu</strong></div><span>{document.lines.length} mặt hàng</span></div>
            <div className="inventory-table-scroll">
              <table className={`inventory-data-table inventory-detail-table is-${domain}`}>
                <thead>{renderLineHeader()}</thead>
                <tbody>{document.lines.map(renderLine)}</tbody>
              </table>
            </div>
            {!document.lines.length ? <div className="inventory-detail-empty">Phiếu chưa có dòng nguyên vật liệu.</div> : null}
          </div>
        </div>

        <footer className="inventory-detail-footer"><button type="button" onClick={onClose}>Đóng</button></footer>
      </section>
    </div>
  );
}
