import { useState } from "react";
import { ArrowRight, LockKey, Warehouse } from "@phosphor-icons/react";

export default function LoginPage({ configured, onSignIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (!configured) return;
    setSubmitting(true);
    setMessage("");
    const { error } = await onSignIn(email.trim(), password);
    if (error) setMessage("Thông tin đăng nhập chưa đúng hoặc tài khoản chưa được kích hoạt.");
    setSubmitting(false);
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="brand-mark"><Warehouse weight="fill" /></div>
        <p className="eyebrow">Gánh Hàng Rong · Vận hành nội bộ</p>
        <h1>Mỗi món hàng đều có một hành trình rõ ràng.</h1>
        <p className="login-lead">
          Nhập hàng, giao chi nhánh và kiểm kê trong một nơi — đơn giản cho nhân viên,
          đủ chặt chẽ để anh kiểm soát.
        </p>
        <div className="login-facts">
          <span>Kho tổng</span><span>3 chi nhánh</span><span>Xe đẩy mini</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand"><Warehouse weight="fill" /> Kho Gánh Hàng Rong</div>
          <p className="eyebrow">Đăng nhập nhân viên</p>
          <h2>Chào mừng trở lại</h2>
          <p>Hệ thống sẽ tự mở đúng kho và quyền được giao.</p>

          {!configured ? (
            <div className="setup-notice">
              <LockKey size={22} />
              <div>
                <strong>Chưa kết nối Supabase</strong>
                <span>Điền hai biến môi trường trong file .env để bật đăng nhập thật.</span>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <label>
              Email nhân viên
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ten@ganhhangrong.vn"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Mật khẩu
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                required
              />
            </label>
            {message ? <p className="form-error">{message}</p> : null}
            <button className="primary-button" type="submit" disabled={!configured || submitting}>
              {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
              <ArrowRight weight="bold" />
            </button>
          </form>
          <small>Không dùng chung tài khoản. Mọi thao tác kho đều được ghi nhận theo người thực hiện.</small>
        </div>
      </section>
    </main>
  );
}
