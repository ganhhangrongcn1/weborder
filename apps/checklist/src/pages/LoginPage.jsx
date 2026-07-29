import { ClipboardText, LockKey, User } from "@phosphor-icons/react";
import { useState } from "react";

export default function LoginPage({ message, onLogin, loading }) {
  const [form, setForm] = useState({ email: "", password: "" });

  async function handleSubmit(event) {
    event.preventDefault();
    await onLogin(form);
  }

  return (
    <main className="login-page">
      <section className="login-intro">
        <div className="login-brand"><ClipboardText weight="fill" /> GHR Vận hành</div>
        <div>
          <p className="eyebrow">Vận hành cửa hàng</p>
          <h1>Đúng người.<br />Đúng tiêu chuẩn.</h1>
          <p className="login-description">Quản lý nhân sự và kiểm tra vận hành cho mô hình takeaway Gánh Hàng Rong.</p>
        </div>
        <p className="login-footnote">Nhân sự & giám sát · Phase 2</p>
      </section>
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-form-wrap">
          <h2 id="login-title">Đăng nhập quản trị</h2>
          <p>Dùng tài khoản admin hiện tại của Gánh Hàng Rong.</p>
          <form onSubmit={handleSubmit}>
            <label><span>Email</span><span className="input-wrap"><User weight="bold" /><input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></span></label>
            <label><span>Mật khẩu</span><span className="input-wrap"><LockKey weight="bold" /><input type="password" autoComplete="current-password" required value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></span></label>
            {message ? <p className="form-message" role="alert">{message}</p> : null}
            <button className="primary-button" type="submit" disabled={loading}>{loading ? "Đang đăng nhập…" : "Đăng nhập"}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
