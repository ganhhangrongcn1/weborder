const PAGER_COUNT = 16;

export function toText(value = "") {
  return String(value || "").normalize("NFC").trim();
}

export function toNumber(value = 0) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value = 0) {
  return `${Math.max(0, Math.round(toNumber(value))).toLocaleString("vi-VN")}đ`;
}

export function getBranchName(branch = {}) {
  return toText(branch.name || branch.branchName || branch.branch_name) || "Chi nhánh";
}

export function getBranchAddress(branch = {}) {
  return toText(branch.address || branch.branchAddress || branch.branch_address);
}

export function getBranchLabel(branch = {}) {
  return [getBranchName(branch), getBranchAddress(branch)].filter(Boolean).join(" - ");
}

export function getBranchUuid(branch = {}, getBranchValue) {
  return toText(branch.branch_uuid || branch.branchUuid || branch.uuid || getBranchValue(branch));
}

export function buildPagerOptions() {
  return Array.from({ length: PAGER_COUNT }, (_, index) => String(index + 1).padStart(2, "0"));
}

export function getOrderCode(order = {}) {
  return toText(order.displayOrderCode || order.display_order_code || order.orderCode || order.order_code || order.id);
}

export function getOrderTotal(order = {}) {
  return toNumber(order.totalAmount ?? order.total_amount ?? order.total, 0);
}

export function getOrderStatusLabel(status = "") {
  const normalized = toText(status).toLowerCase();
  if (["done", "completed", "complete"].includes(normalized)) return "Hoàn tất";
  if (["cancelled", "canceled", "cancel"].includes(normalized)) return "Đã hủy";
  if (normalized === "pending_payment") return "Chờ thanh toán";
  return "Đang xử lý";
}

