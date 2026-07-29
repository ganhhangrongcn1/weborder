import { useState } from "react";

export default function ChecklistLoginPage({ onLogin, loading, message }) {
  const [form, setForm] = useState({ email: "", password: "" });

  function submit(event) {
    event.preventDefault();
    onLogin(form);
  }

  return <main className="checklist-login">
    <section className="checklist-login-intro"><div className="checklist-login-brand"><span><img src="/pwa-icon-192.png" alt="Logo Gánh Hàng Rong" /></span><div><strong>Gánh Hàng Rong</strong><small>Checklist cửa hàng</small></div></div><div><p>Vận hành takeaway</p><h1>Kiểm tra chuẩn.<br />Khắc phục nhanh.</h1><span>Dành cho Admin và Giám sát được phân quyền.</span></div><small>Gánh Hàng Rong · Hệ thống nội bộ</small></section>
    <section className="checklist-login-panel"><form onSubmit={submit}><p>Đăng nhập hệ thống</p><h2>Bắt đầu kiểm tra</h2><span>Sử dụng tài khoản Admin hoặc Giám sát đã được cấp quyền.</span><label><b>Email</b><input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="ten@ganhhangrong.vn" /></label><label><b>Mật khẩu</b><input required type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Nhập mật khẩu" /></label>{message ? <div className="supervision-error">{message}</div> : null}<button type="submit" disabled={loading}>{loading ? "Đang đăng nhập…" : "Đăng nhập"}</button></form></section>
  </main>;
}
