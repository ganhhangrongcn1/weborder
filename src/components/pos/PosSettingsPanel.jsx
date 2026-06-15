import { formatMoney } from "./posHelpers.js";

function formatShiftTime(value = "") {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  });
}

export default function PosSettingsPanel({ branchLabel = "", cashierName = "", activeShift = null }) {
  return (
    <section className="pos-settings-grid">
      <article className="pos-settings-card is-wide">
        <span>Trạng thái POS</span>
        <strong>Đang ưu tiên ổn định luồng bán</strong>
        <p>{branchLabel}</p>
        <small>Thu ngân: {cashierName || "Chưa xác định"}</small>
      </article>
      <article className="pos-settings-card">
        <span>Máy in</span>
        <strong>Đang dùng luồng in hiện tại</strong>
        <p>POS vẫn nhận realtime và đẩy lệnh in theo cấu hình chi nhánh đang hoạt động.</p>
      </article>
      <article className="pos-settings-card">
        <span>Ca bán</span>
        <strong>{activeShift?.id ? "Đang mở ca" : "Chưa mở ca"}</strong>
        {activeShift?.id ? (
          <>
            <p>Mở lúc {formatShiftTime(activeShift.openedAt)} · Tiền đầu ca {formatMoney(activeShift.openingCash)}</p>
            <small>Mã ca: {activeShift.id}</small>
          </>
        ) : (
          <p>POS cần mở ca trước khi bán hàng.</p>
        )}
      </article>
    </section>
  );
}
