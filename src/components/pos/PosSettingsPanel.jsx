export default function PosSettingsPanel({
  branchLabel = "",
  cashierName = ""
}) {
  return (
    <section className="pos-settings-grid">
      <article className="pos-settings-card is-wide">
        <span>Thiết lập POS</span>
        <strong>Cấu hình vận hành tại quầy</strong>
        <p>Các thiết lập ngân hàng và tài khoản nhận QR sẽ quản lý bên Admin.</p>
      </article>

      <article className="pos-settings-card">
        <span>Chi nhánh</span>
        <strong>{branchLabel || "Chưa xác định"}</strong>
        <p>POS đang bán theo chi nhánh đăng nhập hiện tại.</p>
      </article>

      <article className="pos-settings-card">
        <span>Thu ngân</span>
        <strong>{cashierName || "Chưa xác định"}</strong>
        <p>Dùng thông tin tài khoản đăng nhập POS.</p>
      </article>

      <article className="pos-settings-card">
        <span>Máy in</span>
        <strong>Sẵn sàng theo cấu hình chi nhánh</strong>
        <p>Luồng in tự động vẫn dùng cấu hình hiện tại. Sau này có thể thêm test in và chọn khổ giấy tại đây.</p>
      </article>

      <article className="pos-settings-card">
        <span>Đồng bộ</span>
        <strong>Realtime đang bật</strong>
        <p>POS tự cập nhật đơn, phiên QR và trạng thái bếp theo Supabase.</p>
      </article>
    </section>
  );
}
