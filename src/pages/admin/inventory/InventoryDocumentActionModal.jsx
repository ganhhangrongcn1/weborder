import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";

const MODE_CONFIG = {
  delete: {
    title: "Xóa bản nháp",
    icon: "trash",
    description: "Chỉ xóa phiếu chưa gửi xử lý và chưa làm thay đổi tồn kho.",
    actionLabel: "Xóa bản nháp"
  },
  reverse: {
    title: "Hoàn tác phiếu nhập",
    icon: "refresh",
    description: "Tạo chứng từ đảo để trừ lại đúng số tồn đã nhập và giữ nguyên lịch sử.",
    actionLabel: "Xác nhận hoàn tác"
  },
  dispatch: {
    title: "Xác nhận giao hàng",
    icon: "share",
    description: "Số lượng giao mặc định bằng số lượng trên phiếu.",
    quantityLabel: "Số lượng giao",
    actionLabel: "Xác nhận giao"
  },
  receive: {
    title: "Xác nhận nhận hàng",
    icon: "download",
    description: "Nếu nhận thiếu, hãy nhập số thực nhận và ghi lý do.",
    quantityLabel: "Thực nhận",
    actionLabel: "Xác nhận nhận"
  },
  approve: {
    title: "Duyệt yêu cầu xuất kho",
    icon: "check",
    description: "Chọn kho xuất; số duyệt mặc định bằng số yêu cầu.",
    quantityLabel: "Số lượng duyệt",
    actionLabel: "Duyệt yêu cầu"
  },
  reject: {
    title: "Từ chối yêu cầu xuất kho",
    icon: "warning",
    description: "Chọn kho xử lý và ghi lý do để kho yêu cầu biết.",
    actionLabel: "Xác nhận từ chối"
  }
};

function buildActionLines(document, mode) {
  return document.lines.map((line) => ({
    lineId: line.id,
    itemId: line.itemId,
    unitId: line.unitId,
    expectedQuantity: line.expectedQuantity,
    maximumQuantity: mode === "receive" ? Number(line.shippedQuantity || 0) : Number(line.expectedQuantity || 0),
    quantity: mode === "receive" ? Number(line.shippedQuantity || 0) : Number(line.expectedQuantity || 0),
    reason: ""
  }));
}

export default function InventoryDocumentActionModal({
  mode,
  document,
  warehouses = [],
  items = [],
  units = [],
  onClose,
  onConfirm
}) {
  const config = MODE_CONFIG[mode] || MODE_CONFIG.dispatch;
  const [sourceWarehouseId, setSourceWarehouseId] = useState(document.sourceWarehouseId || "");
  const [lines, setLines] = useState(() => buildActionLines(document, mode));
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const itemMap = useMemo(() => new Map(items.map((row) => [row.id, row])), [items]);
  const unitMap = useMemo(() => new Map(units.map((row) => [row.id, row])), [units]);
  const availableWarehouses = warehouses.filter((row) => row.isActive !== false && !row.isDraft && row.id !== document.destinationWarehouseId);

  const updateLine = (lineId, key, value) => {
    setLines((current) => current.map((line) => line.lineId === lineId ? { ...line, [key]: value } : line));
  };

  const validate = () => {
    if (mode === "delete") return "";
    if (mode === "reverse" && !rejectionReason.trim()) return "Vui lòng nhập lý do hoàn tác phiếu nhập.";
    if (mode === "reverse") return "";
    if (["approve", "reject"].includes(mode) && !sourceWarehouseId) return "Vui lòng chọn kho xuất hàng.";
    if (mode === "reject" && !rejectionReason.trim()) return "Vui lòng nhập lý do từ chối.";
    if (mode === "reject") return "";
    const invalidQuantity = lines.some((line) => {
      const quantity = Number(line.quantity);
      return !Number.isFinite(quantity)
        || (mode === "receive" || mode === "approve" ? quantity < 0 : quantity <= 0)
        || quantity > line.maximumQuantity;
    });
    if (invalidQuantity) return "Số lượng không hợp lệ hoặc vượt quá số lượng trên phiếu.";
    if (mode === "approve" && !lines.some((line) => Number(line.quantity) > 0)) return "Cần duyệt ít nhất một nguyên vật liệu.";
    const missingReason = lines.some((line) => Number(line.quantity) !== line.maximumQuantity && !line.reason.trim());
    if (["receive", "approve"].includes(mode) && missingReason) return "Vui lòng ghi lý do cho dòng có số lượng chênh lệch.";
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onConfirm({
        sourceWarehouseId,
        rejectionReason,
        reversalReason: mode === "reverse" ? rejectionReason.trim() : "",
        lines: lines.map((line) => ({
          lineId: line.lineId,
          shippedQuantity: mode === "dispatch" ? Number(line.quantity) : undefined,
          receivedQuantity: mode === "receive" ? Number(line.quantity) : undefined,
          varianceReason: mode === "receive" ? line.reason.trim() : "",
          approvedQuantity: mode === "approve" ? Number(line.quantity) : undefined,
          rejectionReason: mode === "approve" ? line.reason.trim() : ""
        }))
      });
      onClose();
    } catch (nextError) {
      setError(nextError.message || "Không thể xử lý chứng từ.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="inventory-warehouse-modal inventory-action-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-action-title">
        <header>
          <div className="inventory-modal-heading">
            <span><Icon name={config.icon} size={20} /></span>
            <div><h2 id="inventory-action-title">{config.title}</h2><p>{config.description}</p></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng"><Icon name="close" size={18} /></button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="inventory-action-document">
            <span>Phiếu đang xử lý</span>
            <strong>{document.documentNo}</strong>
          </div>

          {mode === "delete" ? (
            <div className="inventory-delete-confirmation">
              <span><Icon name="warning" size={19} /></span>
              <div>
                <strong>Xóa vĩnh viễn phiếu nháp này?</strong>
                <p>Các dòng nguyên vật liệu trong phiếu cũng sẽ được xóa. Tồn kho thực tế không bị thay đổi.</p>
              </div>
            </div>
          ) : null}

          {mode === "reverse" ? (
            <div className="inventory-delete-confirmation">
              <span><Icon name="warning" size={19} /></span>
              <div>
                <strong>Hoàn tác toàn bộ phiếu nhập này?</strong>
                <p>Hệ thống sẽ tạo chứng từ đảo, trừ lại tồn và cập nhật lô hàng. Phiếu gốc vẫn được giữ để đối chiếu.</p>
              </div>
            </div>
          ) : null}

          {mode !== "delete" && ["approve", "reject"].includes(mode) ? (
            <label className="inventory-form-field">
              <span className="inventory-field-label"><Icon name="store" size={15} />Kho xuất hàng <b>*</b></span>
              <span className="inventory-control-shell inventory-control-shell--select">
                <InventorySearchableSelect value={sourceWarehouseId} onChange={(event) => setSourceWarehouseId(event.target.value)} required>
                  <option value="">Chọn kho xuất</option>
                  {availableWarehouses.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                </InventorySearchableSelect>
              </span>
            </label>
          ) : null}

          {mode === "delete" ? null : ["reject", "reverse"].includes(mode) ? (
            <label className="inventory-form-field">
              <span className="inventory-field-label"><Icon name="edit" size={15} />{mode === "reverse" ? "Lý do hoàn tác" : "Lý do từ chối"} <b>*</b></span>
              <span className="inventory-control-shell"><input value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder={mode === "reverse" ? "Ví dụ: nhập nhầm số lượng hoặc sai nguyên vật liệu…" : "Ví dụ: kho không đủ hàng, yêu cầu chưa đúng…"} required /></span>
            </label>
          ) : (
            <div className="inventory-action-lines">
              <div className="inventory-action-lines__header"><span>Nguyên vật liệu</span><span>Số trên phiếu</span><span>{config.quantityLabel}</span>{["receive", "approve"].includes(mode) ? <span>Lý do nếu lệch</span> : null}</div>
              {lines.map((line) => {
                const item = itemMap.get(line.itemId);
                const selectedUnit = unitMap.get(line.unitId);
                const unitName = selectedUnit?.name || selectedUnit?.symbol || item?.purchaseUnit?.name || item?.baseUnit?.name || "đơn vị";
                const isDifferent = Number(line.quantity) !== line.maximumQuantity;
                return (
                  <div key={line.lineId} className={`inventory-action-line ${["receive", "approve"].includes(mode) ? "has-reason" : ""}`}>
                    <div><strong>{item?.name || "Nguyên vật liệu"}</strong><small>{unitName}</small></div>
                    <span>{line.maximumQuantity.toLocaleString("vi-VN")}</span>
                    <input type="number" min={mode === "dispatch" ? "0.001" : "0"} max={line.maximumQuantity} step="0.001" value={line.quantity} onChange={(event) => updateLine(line.lineId, "quantity", event.target.value)} required />
                    {["receive", "approve"].includes(mode) ? <input className={isDifferent ? "is-required" : ""} value={line.reason} onChange={(event) => updateLine(line.lineId, "reason", event.target.value)} placeholder={isDifferent ? "Bắt buộc nhập lý do" : "Không cần nếu đủ"} /> : null}
                  </div>
                );
              })}
            </div>
          )}

          {error ? <p className="inventory-form-error" role="alert">{error}</p> : null}
          <footer>
            <span><Icon name="info" size={16} />{mode === "delete" ? "Chỉ bản nháp mới được phép xóa." : mode === "reverse" ? "Chỉ hoàn tác khi kho còn đủ toàn bộ số đã nhập." : "Hệ thống chỉ ghi tồn đúng một lần cho mỗi bước."}</span>
            <button type="button" onClick={onClose}>Hủy</button>
            <button className={["delete", "reverse"].includes(mode) ? "is-danger" : ""} type="submit" disabled={saving}><Icon name={["delete", "reject", "reverse"].includes(mode) ? "warning" : "check"} size={16} />{saving ? "Đang xử lý…" : config.actionLabel}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
