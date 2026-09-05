export default function WelcomeVoucherSettings({ config, coupons = [], onChange }) {
  return (
    <section className="admin-promo-helper-card">
      <div className="admin-promo-helper-panel">
        <div className="admin-promo-helper-panel-head">
          <div>
            <strong>Voucher chào thành viên mới</strong>
            <small>Tặng một lần khi khách đăng ký thành viên.</small>
          </div>
          <label className="admin-switch">
            <input
              type="checkbox"
              aria-label="Bật voucher chào thành viên mới"
              checked={config.welcomeVoucherEnabled}
              onChange={(event) => onChange({ welcomeVoucherEnabled: event.target.checked })}
            />
            <span />
          </label>
        </div>
        <label className="admin-promo-field-label">
          Voucher tặng khách mới
          <select
            className="admin-input admin-promo-field-input"
            value={config.welcomeVoucherId}
            onChange={(event) => onChange({ welcomeVoucherId: event.target.value })}
          >
            <option value="">Chưa chọn voucher</option>
            {coupons.map((voucher) => (
              <option key={voucher.id || voucher.code} value={voucher.id || voucher.code}>
                {voucher.code} - {voucher.name || voucher.title || "Voucher"}{voucher.active === false ? " (đang tắt)" : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="admin-promo-helper-note">Giá trị giảm và hạn dùng theo voucher đã chọn. Bấm Lưu khuyến mãi để lưu thay đổi.</p>
      </div>
    </section>
  );
}
