import useInventorySalesDeductionSettings from "../../../hooks/useInventorySalesDeductionSettings.js";

export default function InventoryManualCountNotice({ warehouses = [] }) {
  const state = useInventorySalesDeductionSettings();
  const branchIds = new Set(warehouses.map((warehouse) => warehouse.branchUuid).filter(Boolean));
  const disabled = state.rows.filter((row) => branchIds.has(row.branchUuid) && !row.enabled);
  if (state.status !== "ready" || !disabled.length) return null;
  return <div className="inventory-count-notice"><strong>Đang chốt tồn bằng kiểm kê: {disabled.map((row) => row.branchName).join(", ")}</strong><p>Chốt phiếu nhận hàng, sơ chế và hủy trước khi bắt đầu kiểm kê; ngừng luân chuyển trong lúc đếm. Nhập số lượng thực tế còn lại, gửi quản lý duyệt. Chênh lệch còn bao gồm hàng đã bán chưa tự trừ, không mặc định là thất thoát. Không tạo thêm phiếu xuất cho cùng phần chênh lệch.</p></div>;
}
