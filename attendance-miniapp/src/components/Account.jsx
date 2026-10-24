import ContactActions from "./ContactActions.jsx";
import { DEMO_BRANCH } from "../data/demo.js";
import { useState } from "react";
import PhoneLinkDialog from "./PhoneLinkDialog.jsx";
import { employeeName } from "../services/attendancePresentation.js";

export default function Account({ app, navigation }) {
  const [scenario, setScenario] = useState("match");
  const [consent, setConsent] = useState(false);
  const phone = app.state.phones[app.actor.id];
  const name = employeeName(app.actor.name);
  const tools = import.meta.env.DEV && new URLSearchParams(window.location.search).get("tools") === "1";
  return <div className="check-grid"><section className="card account-profile"><span className="profile-avatar">{name.split(" ").at(-1)?.slice(0, 1)}</span><h2>{name}</h2><span className="badge">{app.actor.role === "manager" ? "Quản lý" : "Nhân viên"}</span>
    <dl><dt>Mã nhân viên</dt><dd>{app.actor.code}</dd><dt>Tài khoản</dt><dd>{app.actor.username}</dd><dt>Số điện thoại</dt><dd>{phone?.masked || "Chưa liên kết"}</dd></dl>
    <button disabled={app.busy} className="primary" onClick={() => setConsent(true)}>{phone ? "Chia sẻ lại số điện thoại Zalo" : "Chia sẻ số điện thoại Zalo"}</button>
    <button className="account-logout" disabled={app.busy} onClick={app.logout}>Đăng xuất</button>
  </section><section className="card"><p className="eyebrow">Thông tin tài khoản</p><h2>Liên kết và hỗ trợ</h2><p>Số điện thoại giúp đối chiếu tài khoản với hồ sơ nhân viên. Chỉ lấy thông tin sau khi bạn đồng ý.</p><div className="account-info"><strong>Thông tin nhân sự cần thay đổi?</strong><p>Liên hệ quản lý để kiểm tra mã nhân viên, phân công chi nhánh và quyền sử dụng.</p></div><div className="account-info"><strong>Giờ công chưa chính xác?</strong><p>Gửi yêu cầu trong mục Điều chỉnh để quản lý xem xét.</p></div></section>
    <section className="card full-width"><h2>Truy cập nhanh</h2><div className="button-row"><button onClick={() => navigation.navigate("branch", DEMO_BRANCH.id)}>Thông tin chi nhánh</button><button onClick={() => navigation.navigate("training")}>Tài liệu đào tạo</button></div><ContactActions branchId={DEMO_BRANCH.id}/></section>
    <details className="card full-width"><summary>Thử luồng chia sẻ số điện thoại</summary><p className="small">Chỉ dùng để thử kết quả đối chiếu sau khi cho phép. Từ chối được thử trực tiếp trong bảng chia sẻ. Không thay đổi liên kết đã có.</p><label>Kết quả đối chiếu mẫu<select value={scenario} disabled={consent || app.busy} onChange={(event) => setScenario(event.target.value)}><option value="match">Khớp hồ sơ</option><option value="mismatch">Không khớp hồ sơ</option></select></label><button disabled={app.busy} onClick={() => setConsent(true)}>Mở bảng chia sẻ để thử</button></details>
    {consent && <PhoneLinkDialog app={app} scenario={scenario} onClose={() => setConsent(false)}/>}
    {tools && <section className="card full-width"><h2>Công cụ phát triển</h2><label className="switch"><input type="checkbox" checked={app.simulated} disabled readOnly/>Sử dụng GPS và QR mẫu</label><p>Supabase Auth và kho dữ liệu Testing riêng.</p></section>}
  </div>;
}
