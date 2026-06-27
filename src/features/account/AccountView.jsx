import Icon from "../../components/Icon.jsx";
import ProfileModal from "../../pages/customer/account/ProfileModal.jsx";
import AccountAddressModal from "../../pages/customer/account/AccountAddressModal.jsx";
import AppHeader from "../../components/app/Header.jsx";
import useAccountViewModel from "./hooks/useAccountViewModel.js";
import AccountDashboard from "./components/AccountDashboard.jsx";

function AuthField({ label, helper = "", ...inputProps }) {
  return (
    <label className="account-auth-field">
      <span>{label}</span>
      <input
        {...inputProps}
        className="w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-200"
      />
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}

function AccountPageLoading() {
  return (
    <section>
      <AppHeader title="Tài khoản" subtitle="Đang khôi phục phiên đăng nhập" />
      <div className="account-page-content space-y-4 px-4" aria-busy="true">
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
  branches = [],
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

  if (isProtectedSessionPending) {
    return <AccountPageLoading />;
  }

  if (!canAccessAccount) {
    return (
      <section>
        <AppHeader title="Tài khoản" subtitle="Đăng nhập để xem dữ liệu thành viên" />
        <div className="account-page-content space-y-4 px-4">
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
                <p className="mt-1 text-sm text-brown/60">Nhập số điện thoại và mật khẩu để xem hồ sơ và dữ liệu khách hàng.</p>
                <div className="mt-3 space-y-3">
                  <AuthField
                    label="Số điện thoại"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={vm.loginDraft.phone}
                    onChange={(event) => vm.setLoginDraft((draft) => ({ ...draft, phone: event.target.value }))}
                    placeholder="Ví dụ: 0901234567"
                  />
                  <AuthField
                    label="Mật khẩu"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={vm.loginDraft.password}
                    onChange={(event) => vm.setLoginDraft((draft) => ({ ...draft, password: event.target.value }))}
                    placeholder="Nhập mật khẩu"
                  />
                  <button onClick={vm.handleDirectLogin} className="w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange">Đăng nhập</button>
                </div>
                <button
                  onClick={() => {
                    vm.setAccountEntryTab("register");
                    vm.setAuthMode("register");
                    vm.setLookupPhone("");
                    vm.setLookupOrders([]);
                    vm.setAuthNotice("");
                    vm.setAuthPhone(vm.loginDraft.phone);
                  }}
                  className="mt-3 w-full rounded-2xl bg-orange-50 px-4 py-3 text-xs font-black text-orange-600"
                >
                  Chưa có tài khoản? Tạo tài khoản
                </button>
                <button
                  onClick={() => vm.navigateToTab("orders")}
                  className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-brown/55"
                >
                  Tra cứu đơn không cần đăng nhập
                </button>
                <button
                  onClick={() => {
                    vm.setAccountEntryTab("forgot");
                    vm.setForgotEmail("");
                    vm.setAuthNotice("");
                  }}
                  className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-brown/55"
                >
                  Quên mật khẩu?
                </button>
              </div>
            ) : vm.accountEntryTab === "register" ? (
              <div className="mt-4">
                <h2 className="text-base font-black text-brown">Tạo tài khoản</h2>
                <p className="mt-1 text-sm text-brown/60">Nhập số điện thoại để tạo tài khoản và liên kết lịch sử đơn hàng theo số này.</p>
                <div className="mt-3 space-y-3">
                  <AuthField
                    label="Số điện thoại"
                    name="register-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={vm.authPhone}
                    onChange={(event) => vm.setAuthPhone(event.target.value)}
                    placeholder="Ví dụ: 0901234567"
                  />
                  <AuthField
                    label="Tên hiển thị"
                    name="name"
                    autoComplete="name"
                    value={vm.registerDraft.name}
                    onChange={(event) => vm.setRegisterDraft((draft) => ({ ...draft, name: event.target.value }))}
                    placeholder="Nhập họ và tên"
                  />
                  <AuthField
                    label="Email"
                    helper="Email dùng để lấy lại mật khẩu khi cần."
                    name="email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    value={vm.registerDraft.email}
                    onChange={(event) => vm.setRegisterDraft((draft) => ({ ...draft, email: event.target.value }))}
                    placeholder="Ví dụ: ban@gmail.com"
                  />
                  <AuthField
                    label="Mật khẩu"
                    name="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={vm.registerDraft.password}
                    onChange={(event) => vm.setRegisterDraft((draft) => ({ ...draft, password: event.target.value }))}
                    placeholder="Tối thiểu 6 ký tự"
                  />
                  <AuthField
                    label="Nhập lại mật khẩu"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={vm.registerDraft.confirmPassword}
                    onChange={(event) => vm.setRegisterDraft((draft) => ({ ...draft, confirmPassword: event.target.value }))}
                    placeholder="Nhập lại mật khẩu"
                  />
                  <button onClick={vm.handleRegister} className="w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange">Tạo tài khoản</button>
                  <button onClick={() => vm.setAccountEntryTab("login")} className="w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-brown/55">Đã có tài khoản? Đăng nhập</button>
                </div>
              </div>
            ) : vm.accountEntryTab === "forgot" ? (
              <div className="mt-4">
                <h2 className="text-base font-black text-brown">Quên mật khẩu</h2>
                <p className="mt-1 text-sm text-brown/60">Nhập email đã đăng ký. Supabase sẽ gửi link đặt lại mật khẩu vào email này.</p>
                <div className="mt-3 space-y-3">
                  <AuthField
                    label="Email đã đăng ký"
                    name="recovery-email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    value={vm.forgotEmail}
                    onChange={(event) => vm.setForgotEmail(event.target.value)}
                    placeholder="Ví dụ: ban@gmail.com"
                  />
                  <button onClick={vm.handleForgotPassword} className="w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange">Gửi link đặt lại mật khẩu</button>
                  <button onClick={() => vm.setAccountEntryTab("login")} className="w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-brown/55">Quay lại đăng nhập</button>
                </div>
              </div>
            ) : vm.accountEntryTab === "resetPassword" ? (
              <div className="mt-4">
                <h2 className="text-base font-black text-brown">Đặt mật khẩu mới</h2>
                <p className="mt-1 text-sm text-brown/60">Nhập mật khẩu mới cho tài khoản của bạn.</p>
                <div className="mt-3 space-y-3">
                  <AuthField
                    label="Mật khẩu mới"
                    name="recovery-password"
                    type="password"
                    autoComplete="new-password"
                    value={vm.resetPasswordDraft.password}
                    onChange={(event) => vm.setResetPasswordDraft((draft) => ({ ...draft, password: event.target.value }))}
                    placeholder="Tối thiểu 6 ký tự"
                  />
                  <AuthField
                    label="Nhập lại mật khẩu mới"
                    name="recovery-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={vm.resetPasswordDraft.confirmPassword}
                    onChange={(event) => vm.setResetPasswordDraft((draft) => ({ ...draft, confirmPassword: event.target.value }))}
                    placeholder="Nhập lại mật khẩu"
                  />
                  <button onClick={vm.handleRecoveryPasswordUpdate} className="w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange">Cập nhật mật khẩu</button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <h2 className="text-base font-black text-brown">Đặt lại mật khẩu</h2>
                <p className="mt-1 text-sm text-brown/60">Mật khẩu tài khoản được quản lý bằng Supabase Auth. Vui lòng liên hệ cửa hàng để đặt lại mật khẩu.</p>
                <button onClick={() => vm.setAccountEntryTab("login")} className="mt-3 w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange">Quay lại đăng nhập</button>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <AppHeader title="Tài khoản" subtitle="Hồ sơ, đơn hàng và điểm thưởng" />
      <AccountDashboard
        vm={vm}
        branches={branches}
        logoutDemoUser={logoutDemoUser}
      />
      {vm.profileOpen ? <ProfileModal user={vm.accountUser} onClose={() => vm.setProfileOpen(false)} onSave={vm.handleSaveUser} onChangePassword={vm.handleChangePassword} /> : null}
      {vm.addressModal ? <AccountAddressModal address={vm.addressModal} onClose={() => vm.setAddressModal(null)} onSave={vm.handleSaveAddress} /> : null}
    </section>
  );
}
