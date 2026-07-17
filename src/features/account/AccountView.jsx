import Icon from "../../components/Icon.jsx";
import { useEffect, useState } from "react";
import ProfileModal from "../../pages/customer/account/ProfileModal.jsx";
import AccountAddressModal from "../../pages/customer/account/AccountAddressModal.jsx";
import useAccountViewModel from "./hooks/useAccountViewModel.js";
import AccountDashboard from "./components/AccountDashboard.jsx";

const AUTH_ERROR_INPUT_NAMES = {
  loginPhone: "phone",
  loginPassword: "password",
  registerPhone: "register-phone",
  registerName: "name",
  registerEmail: "email",
  registerPassword: "new-password",
  registerConfirmPassword: "confirm-password",
  forgotEmail: "recovery-email",
  resetPassword: "recovery-password",
  resetConfirmPassword: "recovery-confirm-password"
};

function AuthField({ label, helper = "", error = "", suffix = null, ...inputProps }) {
  const fieldId = `account-${String(inputProps.name || "field").replace(/[^a-z0-9-]/gi, "-")}`;
  const helperId = helper ? `${fieldId}-helper` : "";
  const errorId = error ? `${fieldId}-error` : "";
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="account-auth-field">
      <label htmlFor={fieldId}>{label}</label>
      <div className="account-auth-input-wrap">
        <input
          {...inputProps}
          id={fieldId}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={`w-full rounded-2xl border bg-cream px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-200${suffix ? " pr-12" : ""}${error ? " account-auth-input--error" : " border-orange-100"}`}
        />
        {suffix}
      </div>
      {helper ? <small id={helperId}>{helper}</small> : null}
      {error ? <small id={errorId} className="account-auth-field__error" role="alert">{error}</small> : null}
    </div>
  );
}

function PasswordField(props) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <AuthField
      {...props}
      type={isVisible ? "text" : "password"}
      suffix={(
        <button
          type="button"
          className={`account-auth-password-toggle${isVisible ? " is-visible" : ""}`}
          onClick={() => setIsVisible((current) => !current)}
          aria-label={isVisible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={isVisible}
          disabled={props.disabled}
        >
          <Icon name="eye" size={18} />
        </button>
      )}
    />
  );
}

function AuthFormError({ message = "" }) {
  return message ? (
    <p className="account-auth-form-error" role="alert" aria-live="polite">
      <Icon name="warning" size={16} />
      <span>{message}</span>
    </p>
  ) : null;
}

function AuthSubmitButton({ busy = false, busyLabel, children }) {
  return (
    <button
      type="submit"
      className="account-auth-submit w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange"
      disabled={busy}
      aria-busy={busy ? "true" : undefined}
    >
      {busy ? <span className="account-auth-spinner" aria-hidden="true" /> : null}
      <span>{busy ? busyLabel : children}</span>
    </button>
  );
}

function AccountPageLoading() {
  return (
    <section>
      <div className="account-page-content space-y-4 px-4 pt-4" aria-busy="true">
        <div className="account-hero account-hero--loading">
          <span className="account-skeleton account-skeleton--avatar" />
          <div className="flex-1 space-y-3">
            <span className="account-skeleton account-skeleton--medium" />
            <span className="account-skeleton account-skeleton--wide" />
          </div>
        </div>
        <div className="account-overview">
          <span className="account-skeleton account-skeleton--medium" />
          <div className="account-overview-grid mt-5">
            {[0, 1, 2].map((item) => (
              <div key={item} className="account-overview-metric">
                <span className="account-skeleton account-skeleton--label" />
                <span className="account-skeleton account-skeleton--value" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Account({
  navigate,
  demoUser,
  setDemoUser,
  currentPhone,
  loginOrRegisterByPhone,
  logoutDemoUser,
  demoAddresses,
  setDemoAddresses,
  demoLoyalty,
  demoOrders,
  hasCustomerAuthSession = false,
  requiresCustomerAuthSession = false,
  isSessionRestoring = false,
  isSessionBootstrapping = false
}) {
  const isProtectedSessionPending = Boolean(
    requiresCustomerAuthSession &&
    (isSessionRestoring || isSessionBootstrapping)
  );
  const canAccessAccount = Boolean(
    currentPhone &&
    (!requiresCustomerAuthSession || hasCustomerAuthSession)
  );
  const vm = useAccountViewModel({
    navigate,
    demoUser,
    setDemoUser,
    currentPhone: canAccessAccount ? currentPhone : "",
    loginOrRegisterByPhone,
    demoAddresses,
    setDemoAddresses,
    demoOrders,
    demoLoyalty
  });

  useEffect(() => {
    const fieldName = AUTH_ERROR_INPUT_NAMES[vm.authErrorFocus?.field];
    if (!fieldName || typeof document === "undefined") return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector(`.account-page-content [name="${fieldName}"]`)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [vm.authErrorFocus?.field, vm.authErrorFocus?.nonce]);

  if (isProtectedSessionPending) {
    return <AccountPageLoading />;
  }

  if (!canAccessAccount) {
    return (
      <section>
        <div className="account-page-content space-y-4 px-4 pt-4">
          {vm.authNotice ? (
            <div className="account-auth-notice" role="status" aria-live="polite">
              {vm.authNotice}
            </div>
          ) : null}
          <div className="rounded-[28px] bg-white p-4 shadow-soft">
            {vm.accountEntryTab === "login" || vm.accountEntryTab === "lookup" ? (
              <div>
                <span className="account-auth-icon"><Icon name="user" size={21} /></span>
                <h2 className="text-base font-black text-brown">Đăng nhập tài khoản</h2>
                <p className="mt-1 text-sm text-brown/60">Đăng nhập để xem đơn hàng, địa chỉ, ưu đãi và điểm Gánh của bạn.</p>
                <form
                  className="mt-3 space-y-3"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    void vm.handleDirectLogin();
                  }}
                >
                  <AuthField
                    label="Số điện thoại"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    spellCheck={false}
                    required
                    disabled={vm.authBusy === "login"}
                    value={vm.loginDraft.phone}
                    error={vm.authErrors.loginPhone}
                    onChange={(event) => {
                      vm.clearAuthError("loginPhone");
                      vm.setLoginDraft((draft) => ({ ...draft, phone: event.target.value }));
                    }}
                    placeholder="Ví dụ: 0901234567"
                  />
                  <PasswordField
                    label="Mật khẩu"
                    name="password"
                    autoComplete="current-password"
                    required
                    disabled={vm.authBusy === "login"}
                    value={vm.loginDraft.password}
                    error={vm.authErrors.loginPassword}
                    onChange={(event) => {
                      vm.clearAuthError("loginPassword");
                      vm.setLoginDraft((draft) => ({ ...draft, password: event.target.value }));
                    }}
                    placeholder="Nhập mật khẩu"
                  />
                  <AuthFormError message={vm.authErrors.form} />
                  <AuthSubmitButton busy={vm.authBusy === "login"} busyLabel="Đang đăng nhập…">
                    Đăng nhập
                  </AuthSubmitButton>
                </form>
                <button
                  type="button"
                  onClick={() => {
                    vm.setAccountEntryTab("register");
                    vm.setAuthMode("register");
                    vm.setLookupPhone("");
                    vm.setLookupOrders([]);
                    vm.setAuthNotice("");
                    vm.clearAuthErrors();
                    vm.setAuthPhone(vm.loginDraft.phone);
                  }}
                  className="mt-3 w-full rounded-2xl bg-orange-50 px-4 py-3 text-xs font-black text-orange-600"
                >
                  Chưa có tài khoản? Tạo tài khoản
                </button>
                <button
                  type="button"
                  onClick={() => vm.navigateToTab("orders")}
                  className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-brown/55"
                >
                  Tra cứu đơn không cần đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => {
                    vm.setAccountEntryTab("forgot");
                    vm.setForgotEmail("");
                    vm.setAuthNotice("");
                    vm.clearAuthErrors();
                  }}
                  className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-brown/55"
                >
                  Quên mật khẩu?
                </button>
              </div>
            ) : vm.accountEntryTab === "register" ? (
              <div className="mt-4">
                <h2 className="text-base font-black text-brown">Tạo tài khoản</h2>
                <p className="mt-1 text-sm text-brown/60">Tạo tài khoản để giữ đơn hàng, điểm Gánh và voucher theo số điện thoại của bạn.</p>
                <form
                  className="mt-3 space-y-3"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    void vm.handleRegister();
                  }}
                >
                  <AuthField
                    label="Số điện thoại"
                    name="register-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    spellCheck={false}
                    required
                    disabled={vm.authBusy === "register"}
                    value={vm.authPhone}
                    error={vm.authErrors.registerPhone}
                    onChange={(event) => {
                      vm.clearAuthError("registerPhone");
                      vm.setAuthPhone(event.target.value);
                    }}
                    placeholder="Ví dụ: 0901234567"
                  />
                  <AuthField
                    label="Tên hiển thị"
                    name="name"
                    autoComplete="name"
                    required
                    disabled={vm.authBusy === "register"}
                    value={vm.registerDraft.name}
                    error={vm.authErrors.registerName}
                    onChange={(event) => {
                      vm.clearAuthError("registerName");
                      vm.setRegisterDraft((draft) => ({ ...draft, name: event.target.value }));
                    }}
                    placeholder="Nhập họ và tên"
                  />
                  <AuthField
                    label="Email"
                    helper="Email dùng để lấy lại mật khẩu khi cần."
                    name="email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    required
                    disabled={vm.authBusy === "register"}
                    value={vm.registerDraft.email}
                    error={vm.authErrors.registerEmail}
                    onChange={(event) => {
                      vm.clearAuthError("registerEmail");
                      vm.setRegisterDraft((draft) => ({ ...draft, email: event.target.value }));
                    }}
                    placeholder="Ví dụ: ban@gmail.com"
                  />
                  <PasswordField
                    label="Mật khẩu"
                    name="new-password"
                    autoComplete="new-password"
                    required
                    disabled={vm.authBusy === "register"}
                    value={vm.registerDraft.password}
                    error={vm.authErrors.registerPassword}
                    onChange={(event) => {
                      vm.clearAuthError("registerPassword");
                      vm.setRegisterDraft((draft) => ({ ...draft, password: event.target.value }));
                    }}
                    placeholder="Tối thiểu 6 ký tự"
                  />
                  <PasswordField
                    label="Nhập lại mật khẩu"
                    name="confirm-password"
                    autoComplete="new-password"
                    required
                    disabled={vm.authBusy === "register"}
                    value={vm.registerDraft.confirmPassword}
                    error={vm.authErrors.registerConfirmPassword}
                    onChange={(event) => {
                      vm.clearAuthError("registerConfirmPassword");
                      vm.setRegisterDraft((draft) => ({ ...draft, confirmPassword: event.target.value }));
                    }}
                    placeholder="Nhập lại mật khẩu"
                  />
                  <AuthFormError message={vm.authErrors.form} />
                  <AuthSubmitButton busy={vm.authBusy === "register"} busyLabel="Đang tạo tài khoản…">
                    Tạo tài khoản
                  </AuthSubmitButton>
                  <button
                    type="button"
                    disabled={vm.authBusy === "register"}
                    onClick={() => {
                      vm.clearAuthErrors();
                      vm.setAccountEntryTab("login");
                    }}
                    className="w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-brown/55"
                  >
                    Đã có tài khoản? Đăng nhập
                  </button>
                </form>
              </div>
            ) : vm.accountEntryTab === "forgot" ? (
              <div className="mt-4">
                <h2 className="text-base font-black text-brown">Quên mật khẩu</h2>
                <p className="mt-1 text-sm text-brown/60">Nhập email đã đăng ký. Gánh sẽ gửi link đặt lại mật khẩu vào email này.</p>
                <form
                  className="mt-3 space-y-3"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    void vm.handleForgotPassword();
                  }}
                >
                  <AuthField
                    label="Email đã đăng ký"
                    name="recovery-email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    required
                    disabled={vm.authBusy === "forgot"}
                    value={vm.forgotEmail}
                    error={vm.authErrors.forgotEmail}
                    onChange={(event) => {
                      vm.clearAuthError("forgotEmail");
                      vm.setForgotEmail(event.target.value);
                    }}
                    placeholder="Ví dụ: ban@gmail.com"
                  />
                  <AuthFormError message={vm.authErrors.form} />
                  <AuthSubmitButton busy={vm.authBusy === "forgot"} busyLabel="Đang gửi email…">
                    Gửi link đặt lại mật khẩu
                  </AuthSubmitButton>
                  <button
                    type="button"
                    disabled={vm.authBusy === "forgot"}
                    onClick={() => {
                      vm.clearAuthErrors();
                      vm.setAccountEntryTab("login");
                    }}
                    className="w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-brown/55"
                  >
                    Quay lại đăng nhập
                  </button>
                </form>
              </div>
            ) : vm.accountEntryTab === "resetPassword" ? (
              <div className="mt-4">
                <h2 className="text-base font-black text-brown">Đặt mật khẩu mới</h2>
                <p className="mt-1 text-sm text-brown/60">Nhập mật khẩu mới cho tài khoản của bạn.</p>
                <form
                  className="mt-3 space-y-3"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    void vm.handleRecoveryPasswordUpdate();
                  }}
                >
                  <PasswordField
                    label="Mật khẩu mới"
                    name="recovery-password"
                    autoComplete="new-password"
                    required
                    disabled={vm.authBusy === "reset"}
                    value={vm.resetPasswordDraft.password}
                    error={vm.authErrors.resetPassword}
                    onChange={(event) => {
                      vm.clearAuthError("resetPassword");
                      vm.setResetPasswordDraft((draft) => ({ ...draft, password: event.target.value }));
                    }}
                    placeholder="Tối thiểu 6 ký tự"
                  />
                  <PasswordField
                    label="Nhập lại mật khẩu mới"
                    name="recovery-confirm-password"
                    autoComplete="new-password"
                    required
                    disabled={vm.authBusy === "reset"}
                    value={vm.resetPasswordDraft.confirmPassword}
                    error={vm.authErrors.resetConfirmPassword}
                    onChange={(event) => {
                      vm.clearAuthError("resetConfirmPassword");
                      vm.setResetPasswordDraft((draft) => ({ ...draft, confirmPassword: event.target.value }));
                    }}
                    placeholder="Nhập lại mật khẩu"
                  />
                  <AuthFormError message={vm.authErrors.form} />
                  <AuthSubmitButton busy={vm.authBusy === "reset"} busyLabel="Đang cập nhật…">
                    Cập nhật mật khẩu
                  </AuthSubmitButton>
                </form>
              </div>
            ) : (
              <div className="mt-4">
                <h2 className="text-base font-black text-brown">Đặt lại mật khẩu</h2>
                <p className="mt-1 text-sm text-brown/60">Mật khẩu của bạn đang được bảo vệ. Vui lòng liên hệ cửa hàng để được hỗ trợ đặt lại.</p>
                <button type="button" onClick={() => vm.setAccountEntryTab("login")} className="mt-3 w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange">Quay lại đăng nhập</button>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <AccountDashboard
        vm={vm}
        logoutDemoUser={logoutDemoUser}
      />
      {vm.profileOpen ? <ProfileModal user={vm.accountUser} onClose={() => vm.setProfileOpen(false)} onSave={vm.handleSaveUser} onChangePassword={vm.handleChangePassword} /> : null}
      {vm.addressModal ? (
        <AccountAddressModal
          address={vm.addressModal}
          fallbackReceiverName={vm.displayName}
          onClose={() => vm.setAddressModal(null)}
          onSave={vm.handleSaveAddress}
        />
      ) : null}
    </section>
  );
}
