export const PARTNER_REVIEW_PLATFORMS = [
  ["grabfood", "GrabFood"],
  ["shopeefood", "ShopeeFood"],
  ["xanhngon", "Xanh Ngon"],
  ["other", "Nền tảng khác"]
];

export const PARTNER_REVIEW_INTERVAL_OPTIONS = [5, 10, 15, 30, 60, 120, 360, 720, 1440];

export const textValue = (value = "") => String(value || "").trim();

export const platformName = (value) => (
  PARTNER_REVIEW_PLATFORMS.find(([id]) => id === value)?.[1] || value || "Đối tác"
);

export const badgeTone = (value) => {
  if (["ready", "success"].includes(value)) return "success";
  if (["error", "failed", "expired"].includes(value)) return "danger";
  if (value === "running") return "info";
  return "neutral";
};
export const syncStatusLabel = (value) => {
  if (value === "success") return "Lần cuối thành công";
  if (value === "failed" || value === "error") return "Lần cuối thất bại";
  if (value === "running") return "Đang đồng bộ";
  return "Chưa đồng bộ";
};

export const formatReviewDate = (value, fallback = "Chưa có thời gian") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
};

export const intervalLabel = (minutes) => {
  const value = Number(minutes) || 60;
  if (value < 60) return `${value} phút`;
  if (value % 60 === 0) return `${value / 60} giờ`;
  return `${value} phút`;
};

export const isStoreControlSelected = (source, action) => {
  const observed = source.store_status;
  if (observed) {
    const age = Date.now() - Date.parse(observed.checked_at || '');
    if (!Number.isFinite(age) || age < 0 || age > 10 * 60_000) return false;
    return observed.state === (action === 'busy' ? 'BUSY' : 'NORMAL');
  }
  if (source.store_control_action !== action) return false;
  if (source.store_control_status !== "success") return false;
  return true;
};

export const storeStatusLabel = (source) => {
  const value = source.store_status;
  if (!value) return 'Chưa đọc trạng thái hiện tại từ Grab';
  const labels = {BUSY:'Đang Bận · chuẩn bị 15 phút',NORMAL:'Đang mở bình thường',CLOSED:'Đang đóng cửa',PAUSED:'Đang tạm nghỉ',UNKNOWN:'Chưa xác định'};
  const stale = Date.now() - Date.parse(value.checked_at || '') > 10 * 60_000;
  return `${labels[value.state] || labels.UNKNOWN}${stale ? ' · Cần cập nhật lại' : ''}`;
};

export const ratingTone = (rating) => {
  const value = Number(rating) || 0;
  if (value <= 2) return "danger";
  if (value === 3) return "warning";
  if (value >= 4) return "positive";
  return "neutral";
};

export const branchTone = (branchCode = "") => {
  const value = textValue(branchCode).toLowerCase();
  if (value.includes("tqd")) return "tqd";
  if (value.includes("lhp")) return "lhp";
  if (value.includes("304") || value.includes("30/4")) return "304";
  return "default";
};
