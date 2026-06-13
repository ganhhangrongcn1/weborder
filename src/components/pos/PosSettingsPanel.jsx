export default function PosSettingsPanel({ branchLabel = "", cashierName = "" }) {
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
        <strong>Tạm khóa để ổn định POS</strong>
        <p>Sau khi POS ổn định, mình sẽ làm lại mở ca, chốt ca và thống kê theo ca ở bước riêng.</p>
      </article>
    </section>
  );
}
