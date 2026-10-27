import Register from "./Register.jsx";
import { useState } from "react";
import Brand from "./Brand.jsx";
import PrivacyNotice from "./PrivacyNotice.jsx";

function Symbol({ kind }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === "user" ? <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></> : kind === "shield" ? <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></> : <><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/></>}</svg>;
}
export default function Login({ app }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [register, setRegister] = useState(false);
  const [support, setSupport] = useState(false);
  return <main className="login-page reference-login">
    <div className="login-brand"><Brand showSubtitle={false}/>{!register && <h1 id="login-title">Tích điểm thành viên</h1>}</div>
    {register ? <Register onBack={() => setRegister(false)}/> : <section className="login-panel" aria-labelledby="login-title">
      <form onSubmit={(event) => { event.preventDefault(); app.login(username, password); }}>
        <label htmlFor="attendance-username">Tài khoản</label>
        <div className="login-input"><Symbol kind="user"/><input id="attendance-username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Nhập tài khoản" required/></div>
        <label htmlFor="attendance-password">Mật khẩu</label>
        <div className="login-input"><Symbol kind="lock"/><input id="attendance-password" autoComplete="current-password" type={visible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Nhập mật khẩu" required/>
          <button type="button" className="password-toggle" aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={visible} onClick={() => setVisible(!visible)}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="m3 3 18 18"/>}</svg></button>
        </div>
        <button type="button" className="login-help" onClick={() => setSupport(!support)}>Quên mật khẩu?</button>
        {support && <p role="status" className="login-support">Liên hệ quản lý cửa hàng để kiểm tra tài khoản và cấp lại mật khẩu.</p>}
        {app.error && <p role="alert" className="notice error">{app.error}</p>}
        <button className="primary login-submit" disabled={app.busy}>{app.busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
      </form>
    </section>}
    {!register && <p className="login-assistance">Chưa có tài khoản? <button onClick={() => { app.clearNotices(); setRegister(true); }}>Đăng ký tài khoản</button></p>}
    <button className="privacy-link" onClick={() => setPrivacy(true)}><Symbol kind="shield"/>Quyền riêng tư</button>
    {privacy && <PrivacyNotice onClose={() => setPrivacy(false)}/>}
  </main>;
}
