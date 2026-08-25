import { useMemo, useState } from "react";
import Icon from "../../../components/Icon.jsx";
import { resolveBranchFromCandidates } from "../../../services/branchIdentityService.js";

const WAREHOUSE_TYPE_LABELS = {
  central: "Kho trung tâm",
  branch: "Kho chi nhánh",
  department: "Kho bộ phận",
  mobile: "Kho lưu động",
  other: "Kho khác"
};

function getBranchLabel(warehouse = {}, branches = []) {
  if (warehouse.warehouseType === "central") return "Toàn hệ thống";
  const branch = resolveBranchFromCandidates(
    [warehouse.branchUuid, warehouse.branchId],
    branches
  );
  return branch?.name || warehouse.departmentName || "Chưa gắn chi nhánh";
}

export default function InventoryWarehouseList({ warehouses = [], branches = [], canWrite = false, onEdit, onArchive, onNotice }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredWarehouses = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi-VN");
    return warehouses.filter((warehouse) => {
      if (typeFilter !== "all" && warehouse.warehouseType !== typeFilter) return false;
      if (!keyword) return true;
      const searchable = [
        warehouse.code,
        warehouse.name,
        warehouse.departmentName,
        warehouse.address,
        warehouse.managerName,
        getBranchLabel(warehouse, branches)
      ].join(" ").toLocaleLowerCase("vi-VN");
      return searchable.includes(keyword);
    });
  }, [branches, search, typeFilter, warehouses]);

  const activeCount = warehouses.filter((warehouse) => warehouse.isActive).length;
  const branchWarehouseCount = warehouses.filter((warehouse) => warehouse.warehouseType === "branch").length;
  const departmentWarehouseCount = warehouses.filter((warehouse) => warehouse.warehouseType === "department").length;

  const archiveWarehouse = async (warehouse) => {
    if (!globalThis.confirm?.(`Lưu trữ “${warehouse.name}”? Kho sẽ không còn được chọn cho nghiệp vụ mới.`)) return;
    try {
      await onArchive(warehouse.id);
      onNotice?.(`Đã lưu trữ ${warehouse.name}.`);
    } catch (error) {
      onNotice?.(error.message || "Không thể lưu trữ kho.");
    }
  };

  return (
    <section className="inventory-list-card">
      <div className="inventory-summary-grid" aria-label="Tóm tắt danh sách kho">
        <div><span>Tổng số kho</span><strong>{warehouses.length}</strong></div>
        <div><span>Đang hoạt động</span><strong>{activeCount}</strong></div>
        <div><span>Kho chi nhánh</span><strong>{branchWarehouseCount}</strong></div>
        <div><span>Kho bộ phận</span><strong>{departmentWarehouseCount}</strong></div>
      </div>

      <div className="inventory-list-toolbar">
        <label className="inventory-search-field">
          <Icon name="search" size={17} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm mã kho, tên kho, chi nhánh..."
          />
        </label>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Lọc loại kho">
          <option value="all">Tất cả loại kho</option>
          {Object.entries(WAREHOUSE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {filteredWarehouses.length ? (
        <div className="inventory-table-scroll">
          <table className="inventory-data-table">
            <thead>
              <tr>
                <th>Mã kho</th>
                <th>Tên kho</th>
                <th>Loại kho</th>
                <th>Chi nhánh / bộ phận</th>
                <th>Bán trước, nhập sau</th>
                <th>Trạng thái</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {filteredWarehouses.map((warehouse) => {
                return (
                  <tr key={warehouse.id}>
                    <td><strong>{warehouse.code || "—"}</strong></td>
                    <td><strong>{warehouse.name || "Chưa đặt tên"}</strong><small>{warehouse.address || "Chưa có địa chỉ"}</small></td>
                    <td>{WAREHOUSE_TYPE_LABELS[warehouse.warehouseType] || WAREHOUSE_TYPE_LABELS.other}</td>
                    <td>{getBranchLabel(warehouse, branches)}{warehouse.isDefaultForBranch ? <small>Kho mặc định</small> : null}</td>
                    <td>{warehouse.allowNegativeStock ? "Có" : "Không"}</td>
                    <td><span className={`inventory-status-pill ${warehouse.isActive ? "is-active" : "is-inactive"}`}>{warehouse.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}</span></td>
                    <td><div className="inventory-row-actions"><button type="button" disabled={!canWrite || warehouse.isDraft} onClick={() => onEdit(warehouse)} aria-label={`Sửa ${warehouse.name}`} title={warehouse.isDraft ? "Bản nháp local chưa thể sửa trên Supabase" : "Sửa cấu hình kho"}><Icon name="edit" size={16} /></button><button type="button" disabled={!canWrite || warehouse.isDraft} onClick={() => archiveWarehouse(warehouse)} aria-label={`Lưu trữ ${warehouse.name}`} title={warehouse.isDraft ? "Bản nháp local chưa thể lưu trữ trên Supabase" : "Lưu trữ kho"}><Icon name="trash" size={16} /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="inventory-list-empty">
          <Icon name="store" size={26} />
          <strong>{warehouses.length ? "Không có kho phù hợp bộ lọc" : "Chưa có dữ liệu kho"}</strong>
          <span>{warehouses.length ? "Hãy đổi từ khóa hoặc loại kho." : "Sau khi migration được duyệt, danh sách kho sẽ xuất hiện tại đây."}</span>
        </div>
      )}
    </section>
  );
}
