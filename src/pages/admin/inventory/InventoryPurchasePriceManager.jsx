import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} đ`;
}

export default function InventoryPurchasePriceManager({
  rows = [],
  canWrite = false,
  mutationStatus = "idle",
  onSavePrice
}) {
  const [search, setSearch] = useState("");
  const [priceFilter, setPriceFilter] = useState("all");
  const [editingId, setEditingId] = useState("");
  const [draftPrice, setDraftPrice] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const ingredientRows = useMemo(
    () => rows.filter((row) => row.itemType === "ingredient"),
    [rows]
  );
  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi-VN");
    return ingredientRows.filter((row) => {
      const hasPrice = Number(row.defaultPurchasePrice || 0) > 0;
      if (priceFilter === "configured" && !hasPrice) return false;
      if (priceFilter === "missing" && hasPrice) return false;
      if (!keyword) return true;
      return [row.code, row.name, row.itemGroup?.name]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("vi-VN")
        .includes(keyword);
    });
  }, [ingredientRows, priceFilter, search]);

  const configuredCount = ingredientRows.filter((row) => Number(row.defaultPurchasePrice || 0) > 0).length;

  const startEditing = (row) => {
    setEditingId(row.id);
    setDraftPrice(String(Number(row.defaultPurchasePrice || 0)));
    setNotice("");
    setError("");
  };

  const cancelEditing = () => {
    setEditingId("");
    setDraftPrice("");
    setError("");
  };

  const savePrice = async (row) => {
    const value = Number(draftPrice);
    if (!Number.isFinite(value) || value < 0) {
      setError("Giá mua mặc định phải từ 0 đồng trở lên.");
      return;
    }
    setError("");
    try {
      await onSavePrice({ id: row.id, value });
      setEditingId("");
      setDraftPrice("");
      setNotice(`Đã cập nhật giá mua mặc định của ${row.name}.`);
    } catch (nextError) {
      setError(nextError.message || "Không thể cập nhật bảng giá.");
    }
  };

  return (
    <section className="inventory-list-card inventory-purchase-price-card">
      {notice ? <div className="inventory-success-banner"><Icon name="check" size={17} />{notice}</div> : null}
      <div className="inventory-master-intro">
        <span><Icon name="wallet" size={22} /></span>
        <div>
          <strong>Bảng giá mua nguyên vật liệu</strong>
          <small>Giá được tính theo đơn vị mua/nhập và tự điền vào phiếu nhập kho. Sửa giá trên một phiếu không làm thay đổi bảng này.</small>
        </div>
      </div>

      <div className="inventory-summary-grid" aria-label="Tóm tắt bảng giá nguyên vật liệu">
        <div><span>Tổng nguyên vật liệu</span><strong>{ingredientRows.length}</strong></div>
        <div><span>Đã nhập giá</span><strong>{configuredCount}</strong></div>
        <div><span>Chưa nhập giá</span><strong>{ingredientRows.length - configuredCount}</strong></div>
        <div><span>Phạm vi</span><strong>Toàn hệ thống</strong></div>
      </div>

      <div className="inventory-domain-explainer">
        <Icon name="info" size={18} />
        <span>Đặt giá <strong>0 đ</strong> để bỏ giá mặc định. Bảng giá chỉ áp dụng cho loại <strong>Nguyên liệu · NVL</strong>.</span>
      </div>

      <div className="inventory-list-toolbar">
        <label className="inventory-search-field">
          <Icon name="search" size={17} />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã, tên hoặc danh mục nguyên vật liệu..." />
        </label>
        <InventorySearchableSelect value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)} aria-label="Lọc trạng thái bảng giá">
          <option value="all">Tất cả trạng thái giá</option>
          <option value="configured">Đã nhập giá</option>
          <option value="missing">Chưa nhập giá</option>
        </InventorySearchableSelect>
      </div>

      {error ? <p className="inventory-form-error inventory-purchase-price-error" role="alert">{error}</p> : null}

      {filteredRows.length ? (
        <div className="inventory-table-scroll">
          <table className="inventory-data-table inventory-purchase-price-table">
            <thead><tr><th>Nguyên vật liệu</th><th>Danh mục</th><th>Đơn vị mua/nhập</th><th>Giá mua mặc định</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead>
            <tbody>
              {filteredRows.map((row) => {
                const isEditing = editingId === row.id;
                const unitLabel = row.purchaseUnit?.symbol || row.purchaseUnit?.name || row.baseUnit?.symbol || row.baseUnit?.name || "đơn vị";
                const hasPrice = Number(row.defaultPurchasePrice || 0) > 0;
                return (
                  <tr key={row.id}>
                    <td><strong>{row.name}</strong><small>{row.code}</small></td>
                    <td>{row.itemGroup?.name || "Chưa phân nhóm"}</td>
                    <td><strong>{unitLabel}</strong></td>
                    <td>
                      {isEditing ? (
                        <label className="inventory-inline-price-input">
                          <input autoFocus type="number" min="0" step="100" value={draftPrice} onChange={(event) => setDraftPrice(event.target.value)} aria-label={`Giá mua mặc định của ${row.name}`} />
                          <span>đ / {unitLabel}</span>
                        </label>
                      ) : <strong>{hasPrice ? `${formatMoney(row.defaultPurchasePrice)} / ${unitLabel}` : "Chưa nhập giá"}</strong>}
                    </td>
                    <td><span className={`inventory-status-pill ${hasPrice ? "is-active" : "is-inactive"}`}>{hasPrice ? "Đã có giá" : "Chưa có giá"}</span></td>
                    <td>
                      <div className="inventory-row-actions inventory-price-actions">
                        {isEditing ? <>
                          <button type="button" disabled={mutationStatus === "saving"} onClick={() => savePrice(row)} aria-label={`Lưu giá ${row.name}`}><Icon name="check" size={16} /></button>
                          <button type="button" disabled={mutationStatus === "saving"} onClick={cancelEditing} aria-label="Hủy sửa giá"><Icon name="close" size={16} /></button>
                        </> : <button type="button" disabled={!canWrite} onClick={() => startEditing(row)} aria-label={`Sửa giá ${row.name}`}><Icon name="edit" size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="inventory-list-empty">
          <Icon name="wallet" size={28} />
          <strong>{ingredientRows.length ? "Không có nguyên vật liệu phù hợp bộ lọc" : "Chưa có nguyên vật liệu"}</strong>
          <span>{ingredientRows.length ? "Hãy đổi từ khóa hoặc trạng thái giá." : "Tạo nguyên vật liệu trước khi khai báo bảng giá mua."}</span>
        </div>
      )}
    </section>
  );
}
