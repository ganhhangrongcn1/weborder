import { useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  CircleNotch,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  LockKey,
  ShieldCheck,
  SignOut
} from "@phosphor-icons/react";
import { AdminButton } from "../ui/AdminCommon.jsx";
import { AdminInput } from "../ui/index.js";

const ACCESS_POINTS = [
  "Theo dõi đơn hàng theo thời gian thực",
  "Phân quyền rõ ràng theo vai trò và chi nhánh",
  "Dữ liệu vận hành được đồng bộ trên Supabase"
];

function AdminAuthBrandPanel() {
  return (
    <aside className="admin-auth-brand" aria-label="Giới thiệu trung tâm vận hành">
      <div className="admin-auth-brand-glow admin-auth-brand-glow--top" aria-hidden="true" />
      <div className="admin-auth-brand-glow admin-auth-brand-glow--bottom" aria-hidden="true" />

      <div className="admin-auth-brand-header">
        <span className="admin-auth-logo-frame">
          <img src="/pwa-icon-192.png" alt="Gánh Hàng Rong" />
        </span>
        <div>
          <strong>Gánh Hàng Rong</strong>
          <span>Trung tâm vận hành</span>
        </div>
      </div>

      <div className="admin-auth-brand-copy">
        <p className="admin-auth-eyebrow">Không gian quản trị nội bộ</p>
        <h2>Mọi hoạt động cửa hàng, trong một màn hình.</h2>
        <p>
          Quản lý đơn hàng, khách hàng và cấu hình vận hành với dữ liệu được cập nhật
          xuyên suốt giữa các chi nhánh.
        </p>
      </div>

      <ul className="admin-auth-access-list">
        {ACCESS_POINTS.map((item) => (
          <li key={item}>
            <CheckCircle size={20} weight="fill" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <p className="admin-auth-brand-footnote">
        Hệ thống dành riêng cho nhân sự đã được cấp quyền.
      </p>
    </aside>
  );
}

function AdminAuthLoadingPanel() {
  return (
    <section className="admin-auth-panel admin-auth-panel--loading" aria-live="polite">
      <div className="admin-auth-state-icon admin-auth-state-icon--loading" aria-hidden="true">
        <CircleNotch size={34} weight="bold" />
      </div>
      <p className="admin-auth-panel-kicker">Đang kết nối an toàn</p>
      <h1>Đang xác minh quyền truy cập</h1>
      <p className="admin-auth-panel-description">
        Hệ thống đang kiểm tra phiên đăng nhập và phạm vi quản lý của tài khoản.
      </p>

      <div className="admin-auth-progress" aria-hidden="true">
        <span />
      </div>

      <div className="admin-auth-status-note">
        <ShieldCheck size={20} weight="duotone" aria-hidden="true" />
        <span>Thông thường quá trình này chỉ mất vài giây.</span>
      </div>
    </section>
  );
}

function AdminAuthBlockedPanel({ blockedEmail, message, onLogout }) {
  return (
    <section className="admin-auth-panel" aria-labelledby="admin-auth-blocked-title">
      <div className="admin-auth-state-icon admin-auth-state-icon--blocked" aria-hidden="true">
        <LockKey size={32} weight="duotone" />
      </div>
      <p className="admin-auth-panel-kicker">Quyền truy cập bị giới hạn</p>
      <h1 id="admin-auth-blocked-title">Tài khoản chưa được cấp quyền</h1>
      <p className="admin-auth-panel-description">
        Phiên đăng nhập hợp lệ, nhưng tài khoản này chưa có vai trò phù hợp để mở
        khu vực quản trị.
      </p>

      <div className="admin-auth-account-card">
        <span>Tài khoản đang sử dụng</span>
        <strong>{blockedEmail || "Không xác định"}</strong>
      </div>

      {message ? (
        <p className="admin-auth-message" role="alert">
          {message}
        </p>
      ) : null}

      <AdminButton
        variant="secondary"
        className="admin-auth-submit admin-auth-submit--secondary"
        onClick={onLogout}
      >
        <SignOut size={19} weight="bold" aria-hidden="true" />
        Đăng xuất và dùng tài khoản khác
      </AdminButton>
    </section>
  );
}

function AdminAuthLoginPanel({
  email,
  password,
  message,
  submitting,
  onEmailChange,
  onPasswordChange,
  onSubmit
}) {
  const [showPassword, setShowPassword] = useState(false);
  const messageId = message ? "admin-auth-form-message" : undefined;

  return (
    <section className="admin-auth-panel" aria-labelledby="admin-auth-login-title">
      <div className="admin-auth-panel-heading">
        <span className="admin-auth-secure-badge">
          <ShieldCheck size={17} weight="fill" aria-hidden="true" />
          Supabase Auth
        </span>
        <p className="admin-auth-panel-kicker">Khu vực quản trị</p>
        <h1 id="admin-auth-login-title">Đăng nhập trung tâm vận hành</h1>
        <p className="admin-auth-panel-description">
          Sử dụng tài khoản đã được cấp quyền admin, nhân viên hoặc bếp.
        </p>
      </div>

      <form className="admin-auth-form" onSubmit={onSubmit}>
        <label className="admin-auth-field">
          <span>Email</span>
          <div className="admin-auth-control">
            <EnvelopeSimple size={20} weight="duotone" aria-hidden="true" />
            <AdminInput
              type="email"
              name="email"
              value={email}
              onValueChange={onEmailChange}
              placeholder="ten@ganhhangrong.vn"
              autoComplete="username"
              inputMode="email"
              aria-describedby={messageId}
              required
            />
          </div>
        </label>

        <label className="admin-auth-field">
          <span>Mật khẩu</span>
          <div className="admin-auth-control admin-auth-control--password">
            <LockKey size={20} weight="duotone" aria-hidden="true" />
            <AdminInput
              type={showPassword ? "text" : "password"}
              name="password"
              value={password}
              onValueChange={onPasswordChange}
              placeholder="Nhập mật khẩu"
              autoComplete="current-password"
              aria-describedby={messageId}
              required
            />
            <button
              type="button"
              className="admin-auth-password-toggle"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword
                ? <EyeSlash size={20} weight="duotone" aria-hidden="true" />
                : <Eye size={20} weight="duotone" aria-hidden="true" />}
            </button>
          </div>
        </label>

        {message ? (
          <p id={messageId} className="admin-auth-message" role="alert">
            {message}
          </p>
        ) : null}

        <AdminButton
          type="submit"
          className="admin-auth-submit"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? (
            <>
              <CircleNotch className="admin-auth-button-spinner" size={20} weight="bold" aria-hidden="true" />
              Đang đăng nhập
            </>
          ) : (
            <>
              Tiếp tục
              <ArrowRight size={19} weight="bold" aria-hidden="true" />
            </>
          )}
        </AdminButton>
      </form>

      <p className="admin-auth-security-note">
        <ShieldCheck size={18} weight="duotone" aria-hidden="true" />
        Phiên đăng nhập được bảo vệ và tự động duy trì trên thiết bị này.
      </p>
    </section>
  );
}

export default function AdminAuthGate({
  mode = "loading",
  email = "",
  password = "",
  message = "",
  submitting = false,
  blockedEmail = "",
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onLogout
}) {
  return (
    <div className="admin-app admin-shell admin-shell--auth admin-auth-shell">
      <main className="admin-auth-layout">
        <AdminAuthBrandPanel />
        <div className="admin-auth-panel-wrap">
          {mode === "loading" ? <AdminAuthLoadingPanel /> : null}
          {mode === "blocked" ? (
            <AdminAuthBlockedPanel
              blockedEmail={blockedEmail}
              message={message}
              onLogout={onLogout}
            />
          ) : null}
          {mode === "login" ? (
            <AdminAuthLoginPanel
              email={email}
              password={password}
              message={message}
              submitting={submitting}
              onEmailChange={onEmailChange}
              onPasswordChange={onPasswordChange}
              onSubmit={onSubmit}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}
