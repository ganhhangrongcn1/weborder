import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import InventorySearchableSelect from "./InventorySearchableSelect.jsx";
import InventoryMasterDataModal from "./InventoryMasterDataModal.jsx";

const ITEM_TYPE_LABELS = {
  ingredient: "Nguyên liệu",
  semi_finished: "Bán thành phẩm",
  finished_good: "Thành phẩm",
  direct_sale: "Bán thẳng",
  packaging: "Bao bì",
  consumable: "Vật tư tiêu hao",
  tool: "Công cụ, dụng cụ",
  other: "Khác"
};

const DOMAIN_CONFIG = {
  suppliers: {
    icon: "user",
    title: "Danh sách nhà cung cấp",
    description: "Quản lý đầu mối giao hàng, liên hệ và thông tin phục vụ nhập mua.",
    searchPlaceholder: "Tìm mã, tên, người liên hệ hoặc số điện thoại...",
    addLabel: "Thêm nhà cung cấp",
    emptyTitle: "Chưa có nhà cung cấp",
    emptyDescription: "Dữ liệu nhà cung cấp sẽ xuất hiện sau khi migration và quyền đọc được duyệt."
  },
  items: {
    icon: "bag",
    title: "Danh mục nguyên vật liệu",
    description: "Thiết lập nguyên vật liệu dùng cho nhập, xuất và trừ kho.",
    searchPlaceholder: "Tìm mã, tên, danh mục hoặc đơn vị...",
    addLabel: "Thêm nguyên vật liệu",
    emptyTitle: "Chưa có nguyên vật liệu",
    emptyDescription: "Nguyên vật liệu sẽ xuất hiện sau khi migration và quyền đọc được duyệt."
  }
};

function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 6 }).format(Number(value || 0));
}

function getUnitLabel(unit = {}) {
  const name = unit.name || unit.code || "Chưa gắn";
  return unit.symbol ? `${name} (${unit.symbol})` : name;
}

function getUnitShortLabel(unit = {}) {
  return unit.symbol || unit.name || unit.code || "đơn vị";
}

function getItemUnitInfo(row, units) {
  const displayUnit = units.find((unit) => unit.id === row.displayUnitId);
  const baseUnit = units.find((unit) => unit.id === row.baseUnitId) || row.baseUnit || {};
  if (displayUnit?.baseUnitId) {
    return {
      primary: getUnitLabel(displayUnit),
      secondary: `Quy đổi: 1 ${getUnitShortLabel(displayUnit)} = ${formatNumber(displayUnit.conversionFactor)} ${getUnitShortLabel(baseUnit)}`
    };
  }
  if (displayUnit) return { primary: getUnitLabel(displayUnit), secondary: "Dùng trực tiếp, không cần quy đổi" };
  const purchaseUnit = units.find((unit) => unit.id === row.purchaseUnitId) || row.purchaseUnit || {};
  if (!row.purchaseUnitId || row.purchaseUnitId === row.baseUnitId) {
    return { primary: getUnitLabel(baseUnit), secondary: "Dùng trực tiếp, không cần quy đổi" };
  }
  return {
    primary: getUnitLabel(purchaseUnit),
    secondary: `Quy đổi: 1 ${getUnitShortLabel(purchaseUnit)} = ${formatNumber(row.purchaseToBaseRatio)} ${getUnitShortLabel(baseUnit)}`
  };
}

function ItemUnitCell({ row, units }) {
  const unitInfo = getItemUnitInfo(row, units);
  return <span className="inventory-item-unit-cell"><strong>{unitInfo.primary}</strong><small>{unitInfo.secondary}</small></span>;
}

export default function InventoryCatalogManager({
  domain = "suppliers",
  rows = [],
  units = [],
  categories = [],
  canWrite = false,
  onSave,
  onArchive
}) {
  const config = DOMAIN_CONFIG[domain] || DOMAIN_CONFIG.suppliers;
  const isItems = domain === "items";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [notice, setNotice] = useState("");

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi-VN");
    return rows.filter((row) => {
      if (statusFilter === "active" && !row.isActive) return false;
      if (statusFilter === "inactive" && row.isActive) return false;
      if (isItems && typeFilter !== "all" && row.itemType !== typeFilter) return false;
      if (!keyword) return true;

      const searchable = isItems
        ? [row.code, row.name, row.itemGroup?.name, row.baseUnit?.name, row.purchaseUnit?.name, ITEM_TYPE_LABELS[row.itemType]]
        : [row.code, row.name, row.contactName, row.phone, row.email, row.address];
      return searchable.filter(Boolean).join(" ").toLocaleLowerCase("vi-VN").includes(keyword);
    });
  }, [isItems, rows, search, statusFilter, typeFilter]);

  const activeCount = rows.filter((row) => row.isActive).length;
  const inactiveCount = rows.length - activeCount;
  const attentionCount = isItems
    ? rows.filter((row) => row.reorderPoint > 0).length
    : rows.filter((row) => row.phone || row.email).length;

  const openModal = (row = null) => {
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
    if (!globalThis.confirm?.(`Lưu trữ “${row.name}”? Dữ liệu và lịch sử chứng từ cũ vẫn được giữ.`)) return;
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
        <button type="button" disabled={!canWrite} onClick={() => openModal()} title={canWrite ? config.addLabel : "Đang khóa ghi cho đến khi migration Kho được duyệt"}><Icon name="plus" size={17} />{config.addLabel}</button>
      </div>

      <div className="inventory-summary-grid" aria-label={`Tóm tắt ${config.title}`}>
        <div><span>Tổng số</span><strong>{rows.length}</strong></div>
        <div><span>Đang sử dụng</span><strong>{activeCount}</strong></div>
        <div><span>Ngừng sử dụng</span><strong>{inactiveCount}</strong></div>
        <div><span>{isItems ? "Có điểm đặt hàng" : "Có thông tin liên hệ"}</span><strong>{attentionCount}</strong></div>
      </div>

      <div className="inventory-list-toolbar">
        <label className="inventory-search-field">
          <Icon name="search" size={17} />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={config.searchPlaceholder} />
        </label>
        {isItems ? (
          <InventorySearchableSelect value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Lọc loại nguyên vật liệu">
            <option value="all">Tất cả loại NVL</option>
            {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </InventorySearchableSelect>
        ) : null}
        <InventorySearchableSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Lọc trạng thái">
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang sử dụng</option>
          <option value="inactive">Ngừng sử dụng</option>
        </InventorySearchableSelect>
      </div>

      {filteredRows.length ? (
        <div className="inventory-table-scroll">
          {isItems ? (
            <table className="inventory-data-table inventory-catalog-table">
              <thead><tr><th>Mã NVL</th><th>Tên nguyên vật liệu</th><th>Loại</th><th>Danh mục</th><th>Đơn vị / Quy đổi</th><th>Điểm đặt hàng</th><th>Hạn sử dụng</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead>
              <tbody>{filteredRows.map((row) => (
                <tr key={row.id || row.code}>
                  <td><strong>{row.code || "—"}</strong></td>
                  <td><strong>{row.name || "Chưa đặt tên"}</strong><small>{row.notes || "Chưa có ghi chú"}</small></td>
                  <td><span className="inventory-data-pill is-type">{ITEM_TYPE_LABELS[row.itemType] || ITEM_TYPE_LABELS.other}</span></td>
                  <td><span className={`inventory-data-pill ${row.itemGroup?.name ? "is-category" : "is-muted"}`}>{row.itemGroup?.name || "Chưa phân nhóm"}</span></td>
                  <td><ItemUnitCell row={row} units={units} /></td>
                  <td>{formatNumber(row.reorderPoint)}</td>
                  <td><span className={`inventory-data-pill ${row.trackExpiry ? "is-expiry" : "is-muted"}`} title={row.trackExpiry ? `Cảnh báo trước ${formatNumber(row.expiryWarningDays)} ngày` : "Không theo dõi hạn sử dụng"}>{row.trackExpiry ? `${formatNumber(row.shelfLifeDays)} ngày` : "Không"}</span></td>
                  <td><span className={`inventory-status-pill ${row.isActive ? "is-active" : "is-inactive"}`}>{row.isActive ? "Đang sử dụng" : "Ngừng sử dụng"}</span></td>
                  <td><div className="inventory-row-actions"><button type="button" disabled={!canWrite} onClick={() => openModal(row)} aria-label={`Sửa ${row.name}`}><Icon name="edit" size={16} /></button><button type="button" disabled={!canWrite} onClick={() => archiveRow(row)} aria-label={`Lưu trữ ${row.name}`}><Icon name="trash" size={16} /></button></div></td>
                </tr>
              ))}</tbody>
            </table>
          ) : (
            <table className="inventory-data-table inventory-catalog-table">
              <thead><tr><th>Mã NCC</th><th>Nhà cung cấp</th><th>Người liên hệ</th><th>Điện thoại</th><th>Email</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead>
              <tbody>{filteredRows.map((row) => (
                <tr key={row.id || row.code}>
                  <td><strong>{row.code || "—"}</strong></td>
                  <td><strong>{row.name || "Chưa đặt tên"}</strong><small>{row.address || "Chưa có địa chỉ"}</small></td>
                  <td>{row.contactName || "—"}</td><td>{row.phone || "—"}</td><td>{row.email || "—"}</td>
                  <td><span className={`inventory-status-pill ${row.isActive ? "is-active" : "is-inactive"}`}>{row.isActive ? "Đang sử dụng" : "Ngừng sử dụng"}</span></td>
                  <td><div className="inventory-row-actions"><button type="button" disabled={!canWrite} onClick={() => openModal(row)} aria-label={`Sửa ${row.name}`}><Icon name="edit" size={16} /></button><button type="button" disabled={!canWrite} onClick={() => archiveRow(row)} aria-label={`Lưu trữ ${row.name}`}><Icon name="trash" size={16} /></button></div></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="inventory-list-empty">
          <Icon name={config.icon} size={28} />
          <strong>{rows.length ? "Không có dữ liệu phù hợp bộ lọc" : config.emptyTitle}</strong>
          <span>{rows.length ? "Hãy đổi từ khóa hoặc bộ lọc." : config.emptyDescription}</span>
        </div>
      )}

      <div className={`inventory-readonly-footnote${canWrite ? " is-writable" : ""}`}><Icon name={canWrite ? "check" : "eye"} size={16} /><span>{canWrite ? "Đã mở quản lý dữ liệu Kho theo quyền Admin và RLS." : "Chế độ chỉ đọc: chưa mở tạo, sửa hoặc lưu trữ dữ liệu trên Supabase production."}</span></div>
      {modalOpen ? <InventoryMasterDataModal domain={domain} record={editingRow} units={units} categories={categories} existingRows={rows} onClose={closeModal} onSave={onSave} /> : null}
    </section>
  );
}
