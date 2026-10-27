// Presentation only: eligibility never substitutes for a recorded award.
export function getOrderPointBadge(order = {}, { orderStatusKey = "", now = Date.now() } = {}) {
  const status = String(order.pointStatus || order.point_status || "").trim().toLowerCase();
  const badge = (label, tone) => ({ label, className: tone });
  const muted = "bg-slate-100 text-slate-600";
  const blocked = "bg-red-50 text-red-700";
  if (orderStatusKey === "cancelled" || ["blocked", "rejected", "cancelled", "canceled"].includes(status)) {
    return badge("Không tích điểm", blocked);
  }
  if (status === "claimed") return badge("Đã tích điểm", "bg-green-50 text-green-700");
  if (orderStatusKey === "awaiting_payment") return badge("Chờ thanh toán để tích điểm", muted);
  const purchasedAt = new Date(order.orderTime || order.order_time || order.createdAt || order.created_at || "").getTime();
  if (status === "expired" || (Number.isFinite(purchasedAt) && now >= purchasedAt + 24 * 60 * 60 * 1000)) {
    return badge("Đã hết hạn tích điểm", blocked);
  }
  if (status === "waiting_data") return badge("Chờ đối soát để tích điểm", muted);
  const phone = String(order.customerPhoneKey || order.customer_phone_key || order.customerPhone || order.customer_phone || "").trim();
  if (!phone) return badge("Chưa có SĐT nhận điểm", muted);
  const normalizedPhone = phone.replace(/\D/g, "").replace(/^(?:84|0084)(?=\d{9}$)/, "0");
  if (!/^0[35789]\d{8}$/.test(normalizedPhone)) return badge("SĐT chưa hợp lệ để tích điểm", muted);
  return badge("Đang cập nhật điểm", muted);
}

export default getOrderPointBadge;
