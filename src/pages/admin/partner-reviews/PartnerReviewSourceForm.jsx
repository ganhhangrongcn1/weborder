import Icon from "../../../components/Icon.jsx";
import { AdminButton, AdminSwitch } from "../ui/AdminCommon.jsx";
import { PARTNER_REVIEW_PLATFORMS } from "./partnerReviewUi.js";

export default function PartnerReviewSourceForm({
  form,
  branchOptions = [],
  saving = false,
  onChange,
  onSelectBranch,
  onClose,
  onSubmit
}) {
  if (!form) return null;

  return (
    <div className="admin-review-form-overlay" role="presentation" onMouseDown={onClose}>
      <aside className="admin-review-form-panel" aria-label={form.id ? "Cập nhật gian hàng" : "Thêm gian hàng"} onMouseDown={(event) => event.stopPropagation()}>
        <div className="admin-review-form-panel-head">
          <div><h2>{form.id ? "Cập nhật gian hàng" : "Thêm gian hàng"}</h2><p>Mật khẩu được mã hóa trong Supabase Vault.</p></div>
          <button type="button" aria-label="Đóng" onClick={onClose}><Icon name="close" size={19} /></button>
        </div>
        <form className="admin-review-form" onSubmit={onSubmit}>
          {form.id ? (
            <div className={`admin-review-credential-state is-wide ${form.credentialsConfigured ? "is-ready" : "is-missing"}`}>
              <Icon name={form.credentialsConfigured ? "check" : "warning"} size={18} />
              <div><strong>{form.credentialsConfigured ? "Thông tin đăng nhập đã được lưu" : "Chưa đủ thông tin đăng nhập"}</strong><small>{form.credentialsConfigured ? `Tài khoản: ${form.loginIdentifierHint || "đã ẩn"} · Mật khẩu: ••••••••` : "Hãy nhập lại cả tài khoản và mật khẩu rồi bấm Lưu gian hàng."}</small></div>
            </div>
          ) : null}
          <label><span>Nền tảng</span><select value={form.platform} onChange={(event) => onChange({ platform: event.target.value })}>{PARTNER_REVIEW_PLATFORMS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Chi nhánh</span><select required value={form.branchUuid} onChange={(event) => onSelectBranch(event.target.value)}><option value="">Chọn chi nhánh</option>{branchOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="is-wide"><span>Tên gian hàng</span><input required value={form.displayName} onChange={(event) => onChange({ displayName: event.target.value })} /></label>
          <label><span>Mã quản lý nội bộ</span><input required placeholder="grab_304_primary" value={form.accountKey} onChange={(event) => onChange({ accountKey: event.target.value })} /></label>
          <label><span>Merchant ID</span><input placeholder="Có thể bổ sung sau" value={form.merchantId} onChange={(event) => onChange({ merchantId: event.target.value })} /></label>
          <label><span>Tài khoản đăng nhập</span><input autoComplete="off" placeholder={form.credentialsConfigured ? `Đã lưu: ${form.loginIdentifierHint || "tài khoản được bảo mật"}` : ""} value={form.username} onChange={(event) => onChange({ username: event.target.value })} />{form.credentialsConfigured ? <small>Để trống nếu không thay tài khoản.</small> : null}</label>
          <label><span>Mật khẩu</span><input type="password" autoComplete="new-password" placeholder={form.credentialsConfigured ? "Đã lưu mật khẩu ••••••••" : ""} value={form.password} onChange={(event) => onChange({ password: event.target.value })} />{form.credentialsConfigured ? <small>Để trống nếu không thay mật khẩu.</small> : null}</label>
          <div className="admin-review-switch is-wide"><div><strong>Tự động đồng bộ</strong><small>Cho phép worker xử lý gian hàng này.</small></div><AdminSwitch checked={form.syncEnabled} onChange={(checked) => onChange({ syncEnabled: checked })} /></div>
          <div className="admin-review-switch is-wide"><div><strong>Tự động kéo Bận 15 phút</strong><small>Chỉ áp dụng cho gian hàng này khi worker đồng bộ; cửa hàng đang đóng sẽ được giữ nguyên.</small></div><AdminSwitch checked={form.busyEnabled} onChange={(checked) => onChange({ busyEnabled: checked })} /></div>
          <div className="admin-review-actions is-wide"><AdminButton type="button" variant="secondary" onClick={onClose}>Hủy</AdminButton><AdminButton type="submit" disabled={saving}>{saving ? "Đang lưu..." : "Lưu gian hàng"}</AdminButton></div>
        </form>
      </aside>
    </div>
  );
}
