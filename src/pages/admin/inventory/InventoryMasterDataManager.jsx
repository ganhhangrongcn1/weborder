import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import InventoryMasterDataModal from "./InventoryMasterDataModal.jsx";

const UNIT_TYPE_LABELS = {
  count: "Đếm số lượng",
  weight: "Khối lượng",
  volume: "Thể tích",
  length: "Chiều dài",
  other: "Khác"
};

const DOMAIN_CONFIG = {
  units: {
    icon: "tag",
    title: "Hệ đơn vị tính",
    description: "Mỗi đơn vị là một đơn vị gốc độc lập. Tỷ lệ giữa đơn vị mua và đơn vị sử dụng được đặt riêng trên từng nguyên vật liệu.",
    searchPlaceholder: "Tìm mã hoặc tên đơn vị...",
    emptyTitle: "Chưa có đơn vị tính",
    emptyDescription: "Sau khi migration và RLS được duyệt, các đơn vị như kg, gram, chai hoặc thùng sẽ xuất hiện tại đây.",
    addLabel: "Thêm đơn vị"
  },
  "item-categories": {
    icon: "folder",
    title: "Nhóm nguyên vật liệu",
    description: "Danh mục do anh tự đặt để tìm và lọc; khác với Loại NVL cố định dùng cho mã và sản xuất.",
    searchPlaceholder: "Tìm mã hoặc tên danh mục...",
    emptyTitle: "Chưa có danh mục NVL",
    emptyDescription: "Sau khi migration và RLS được duyệt, các nhóm thực phẩm, gia vị hoặc bao bì sẽ xuất hiện tại đây.",
    addLabel: "Thêm danh mục"
  }
};

function formatUpdatedAt(value = "") {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

export default function InventoryMasterDataManager({
  domain = "units",
  rows = [],
  canWrite = false,
  onSave,
  onArchive
}) {
  const config = DOMAIN_CONFIG[domain] || DOMAIN_CONFIG.units;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [notice, setNotice] = useState("");

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi-VN");
    return rows.filter((row) => {
      if (statusFilter === "active" && !row.isActive) return false;
      if (statusFilter === "inactive" && row.isActive) return false;
      if (!keyword) return true;
      return [row.code, row.name, row.symbol, row.description, UNIT_TYPE_LABELS[row.unitType]]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("vi-VN")
        .includes(keyword);
    });
  }, [rows, search, statusFilter]);

  const activeCount = rows.filter((row) => row.isActive).length;
  const inactiveCount = rows.length - activeCount;
  const highlightedCount = domain === "units" ? activeCount : rows.filter((row) => row.description).length;

  const openCreate = () => {
    setEditingRow(null);
    setModalOpen(true);
    setNotice("");
  };

  const openEdit = (row) => {
    setEditingRow(row);
    setModalOpen(true);
    setNotice("");
  };

  const closeModal = (message = "") => {
    setModalOpen(false);
    setEditingRow(null);
    setNotice(message);
  };

  const archiveRow = async (row) => {
    if (!globalThis.confirm?.(`Lưu trữ “${row.name}”? Dữ liệu cũ vẫn được giữ để đối chiếu.`)) return;
    try {
      await onArchive(row.id);
      setNotice(`Đã lưu trữ ${row.name}.`);
    } catch (error) {
      setNotice(error.message || "Không thể lưu trữ dữ liệu.");
    }
  };

  return (
    <section className="inventory-list-card inventory-master-card">
      {notice ? <div className="inventory-success-banner"><Icon name="check" size={17} />{notice}</div> : null}
      <div className="inventory-master-intro">
        <span><Icon name={config.icon} size={22} /></span>
        <div><strong>{config.title}</strong><small>{config.description}</small></div>
        <button type="button" disabled={!canWrite} onClick={openCreate} title={canWrite ? config.addLabel : "Đang khóa ghi cho đến khi migration Kho được duyệt"}><Icon name="plus" size={17} />{config.addLabel}</button>
      </div>

      {domain === "units" ? (
        <div className="inventory-domain-explainer inventory-unit-guide">
          <div><Icon name="info" size={18} /><span><strong>Tất cả đơn vị đều là đơn vị gốc.</strong> Khi một nguyên vật liệu mua theo Kg nhưng sử dụng theo Gram, hãy nhập tỷ lệ riêng tại phần Nguyên vật liệu.</span></div>
          <div className="inventory-unit-guide__legend"><span className="is-base"><i />Đơn vị độc lập <small>— không khai quy đổi chung tại đây</small></span></div>
        </div>
      ) : (
        <div className="inventory-domain-explainer"><Icon name="info" size={18} /><span><strong>Danh mục</strong> do anh tự đặt như Gia vị, Rau củ. <strong>Loại NVL</strong> là danh sách cố định quyết định tiền tố mã và cách dùng trong sản xuất.</span></div>
      )}

      {domain === "units" ? (
        <div className="inventory-unit-overview" aria-label="Tóm tắt đơn vị tính kho"><strong>Đơn vị tính kho</strong><span>{rows.length} đơn vị gốc · <b>{activeCount} đang dùng</b> · <b>{inactiveCount} tạm ngưng</b></span></div>
      ) : (
        <div className="inventory-summary-grid" aria-label={`Tóm tắt ${config.title}`}>
          <div><span>Tổng danh mục</span><strong>{rows.length}</strong></div>
          <div><span>Đang sử dụng</span><strong>{activeCount}</strong></div>
          <div><span>Ngừng sử dụng</span><strong>{inactiveCount}</strong></div>
          <div><span>Có mô tả</span><strong>{highlightedCount}</strong></div>
        </div>
      )}

      <div className="inventory-list-toolbar">
        <label className="inventory-search-field">
          <Icon name="search" size={17} />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={config.searchPlaceholder} />
        </label>
        <InventorySearchableSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc trạng thái">
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang sử dụng</option>
          <option value="inactive">Ngừng sử dụng</option>
        </InventorySearchableSelect>
      </div>

      {filteredRows.length ? (
        <div className="inventory-table-scroll">
          <table className="inventory-data-table inventory-master-table">
            <thead>
              {domain === "units" ? <tr><th>Tên đơn vị</th><th>Ký hiệu</th><th>Vai trò</th><th>Kho lưu bằng</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr> : <tr><th>Mã</th><th>Tên danh mục</th><th>Mô tả</th><th>Thứ tự</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr>}
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                return <tr key={row.id || row.code}>
                  {domain === "units" ? <>
                    <td><span className="inventory-unit-name is-base"><i /><strong>{row.name || "Chưa đặt tên"}</strong></span></td>
                    <td>{row.symbol || "—"}</td>
                    <td><span className="inventory-unit-role-badge is-base">Đơn vị gốc</span></td>
                    <td><span className="inventory-unit-storage">Kho lưu trực tiếp bằng <strong>{row.name}</strong></span></td>
                  </> : <>
                    <td><strong>{row.code || "—"}</strong></td>
                    <td><strong>{row.name || "Chưa đặt tên"}</strong><small>{formatUpdatedAt(row.updatedAt)}</small></td>
                    <td>{row.description || "Chưa có mô tả"}</td>
                    <td>{row.displayOrder || 0}</td>
                  </>}
                  <td><span className={`inventory-status-pill${domain === "units" ? " inventory-unit-state" : ""} ${row.isActive ? "is-active" : "is-inactive"}`}>{row.isActive ? domain === "units" ? "Đang dùng" : "Đang sử dụng" : domain === "units" ? "Tạm ngưng" : "Ngừng sử dụng"}</span></td>
                  <td><div className="inventory-row-actions"><button type="button" disabled={!canWrite} onClick={() => openEdit(row)} aria-label={`Sửa ${row.name}`}><Icon name="edit" size={16} /></button><button type="button" disabled={!canWrite} onClick={() => archiveRow(row)} aria-label={`Lưu trữ ${row.name}`}><Icon name="trash" size={16} /></button></div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="inventory-list-empty">
          <Icon name={config.icon} size={28} />
          <strong>{rows.length ? "Không có dữ liệu phù hợp bộ lọc" : config.emptyTitle}</strong>
          <span>{rows.length ? "Hãy đổi từ khóa hoặc trạng thái." : config.emptyDescription}</span>
        </div>
      )}

      <div className={`inventory-readonly-footnote${canWrite ? " is-writable" : ""}`}><Icon name={canWrite ? "check" : "eye"} size={16} /><span>{canWrite ? "Đã mở quản lý dữ liệu Kho theo quyền Admin và RLS." : "Chế độ chỉ đọc: chưa mở tạo, sửa hoặc lưu trữ dữ liệu trên Supabase production."}</span></div>
      {modalOpen ? <InventoryMasterDataModal domain={domain} record={editingRow} units={domain === "units" ? rows : []} onClose={closeModal} onSave={onSave} /> : null}
    </section>
  );
}
