import { employeeName } from "../services/attendancePresentation.js";

export default function Account({ app }) {
  const phone = app.state.phones[app.actor.id];
  const name = employeeName(app.actor.name);
  const tools = import.meta.env.DEV && new URLSearchParams(window.location.search).get("tools") === "1";
  return <div className="check-grid"><section className="card account-profile"><span className="profile-avatar">{name.split(" ").at(-1)?.slice(0, 1)}</span><h2>{name}</h2><span className="badge">{app.actor.role === "manager" ? "Quản lý" : "Nhân viên"}</span>
    <dl><dt>Mã nhân viên</dt><dd>{app.actor.code}</dd><dt>Tài khoản</dt><dd>{app.actor.username}</dd><dt>Số điện thoại</dt><dd>{phone?.masked || "Chưa liên kết"}</dd></dl>
    <button disabled={app.busy} className="primary" onClick={app.phone}>Liên kết số điện thoại</button>
    <button className="account-logout" disabled={app.busy} onClick={app.logout}>Đăng xuất</button>
  </section><section className="card"><p className="eyebrow">Thông tin tài khoản</p><h2>Liên kết và hỗ trợ</h2><p>Số điện thoại giúp đối chiếu tài khoản với hồ sơ nhân viên. Chỉ lấy thông tin sau khi bạn đồng ý.</p><div className="account-info"><strong>Thông tin nhân sự cần thay đổi?</strong><p>Liên hệ quản lý để kiểm tra mã nhân viên, phân công chi nhánh và quyền sử dụng.</p></div><div className="account-info"><strong>Giờ công chưa chính xác?</strong><p>Gửi yêu cầu trong mục Điều chỉnh để quản lý xem xét.</p></div></section>
    {tools && <section className="card full-width"><h2>Công cụ phát triển</h2><label className="switch"><input type="checkbox" checked={app.simulated} onChange={(e) => app.setSimulated(e.target.checked)}/>Sử dụng GPS và QR mẫu (chỉ kiểm thử local)</label><p>Kho dữ liệu hiện tại: IndexedDB, chưa kết nối Supabase.</p></section>}
  </div>;
}
