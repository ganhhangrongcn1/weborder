import { useState } from "react";
import Brand from "./Brand.jsx";

export default function Login({ app }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return <main className="login-page"><section className="login-story"><Brand/>
    <div><p className="eyebrow">Gánh Hàng Rong · Nhân sự</p><h1>Ghi nhận ca làm.<br/>Rõ ràng giờ công.</h1><p>Chấm công, theo dõi ca làm và gửi yêu cầu điều chỉnh công của bạn.</p></div>
    <p className="small">Gánh Hàng Rong · Hệ thống nội bộ</p></section>
    <section className="login-form"><p className="eyebrow">Đăng nhập hệ thống</p><h2>Chào mừng trở lại</h2><p>Sử dụng tài khoản nhân viên hoặc quản lý được cấp.</p>
      <form onSubmit={(event) => { event.preventDefault(); app.login(username, password); }}>
        <label>Tài khoản<input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nhập tài khoản của bạn" required/></label>
        <label>Mật khẩu<input autoComplete="current-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu" required/></label>
        <button className="primary" disabled={app.busy || !app.state}>{app.busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
      </form>
      <p className="small">Cần hỗ trợ tài khoản? Liên hệ quản lý cửa hàng.</p>
      {app.error && <p role="alert" className="notice error">{app.error}</p>}
    </section></main>;
}
