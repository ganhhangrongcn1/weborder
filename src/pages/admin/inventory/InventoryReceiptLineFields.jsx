import { useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";

export default function InventoryReceiptLineFields({
  line,
  item,
  unit,
  items = [],
  canDelete,
  occurredDate = "",
  onUpdate,
  onDelete
}) {
  const [showDetails, setShowDetails] = useState(false);
  const unitName = unit?.name || item?.purchaseUnit?.name || item?.baseUnit?.name || "—";
  const baseUnitName = item?.baseUnit?.name || "đơn vị gốc";

  return (
    <div className="inventory-receipt-line">
      <div className="inventory-receipt-row">
        <InventorySearchableSelect value={line.itemId} onChange={(event) => onUpdate("itemId", event.target.value)} required>
          <option value="">Chọn nguyên vật liệu</option>
          {items.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </InventorySearchableSelect>
        <div className="inventory-document-unit">
          <strong>{unitName}</strong>
          {item && line.conversionToBase !== 1
            ? <small>1 {unitName} = {line.conversionToBase} {baseUnitName}</small>
            : <small>Đơn vị lưu kho</small>}
        </div>
        <input aria-label="Số lượng nhập" type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => onUpdate("quantity", event.target.value)} required />
        <input aria-label="Đơn giá nhập" type="number" min="0" step="100" value={line.unitPrice} onChange={(event) => onUpdate("unitPrice", event.target.value)} />
        <input aria-label={item?.trackExpiry ? "Hạn sử dụng bắt buộc" : "Hạn sử dụng"} type="date" min={line.manufacturedOn || occurredDate} value={line.expiresOn} onChange={(event) => onUpdate("expiresOn", event.target.value)} required={item?.trackExpiry === true} />
        <button className={`inventory-receipt-detail-button ${showDetails ? "is-active" : ""}`} type="button" onClick={() => setShowDetails((current) => !current)} aria-expanded={showDetails}>
          <Icon name="edit" size={14} />{showDetails ? "Ẩn" : "Chi tiết"}
        </button>
        <button className="inventory-receipt-delete-button" type="button" disabled={!canDelete} onClick={onDelete} aria-label="Xóa dòng"><Icon name="trash" size={16} /></button>
      </div>

      {showDetails ? (
        <div className="inventory-receipt-details">
          <label>
            <span>Ngày sản xuất</span>
            <input type="date" max={occurredDate} value={line.manufacturedOn} onChange={(event) => onUpdate("manufacturedOn", event.target.value)} />
          </label>
          <div>
            <span className={item?.trackExpiry ? "is-expiry" : ""}>{item?.trackExpiry ? "Theo dõi HSD" : "HSD không bắt buộc"}</span>
            <small>Cảnh báo tính theo ngày hết hạn thực tế; ngày sản xuất chỉ dùng để gợi ý HSD.</small>
          </div>
        </div>
      ) : null}
    </div>
  );
}
