import Icon from "../../components/Icon.jsx";
import AccountPanel from "../../pages/customer/account/AccountPanel.jsx";
import AddressCard from "../../pages/customer/account/AddressCard.jsx";
import SettingsToggle from "../../pages/customer/account/SettingsToggle.jsx";
import ProfileModal from "../../pages/customer/account/ProfileModal.jsx";
import AccountAddressModal from "../../pages/customer/account/AccountAddressModal.jsx";
import AppHeader from "../../components/app/Header.jsx";
import AppEmptyState from "../../components/app/EmptyState.jsx";
import { formatMoney } from "../../utils/format.js";
import { getOrderStats } from "../../utils/pureHelpers.js";
import useAccountViewModel from "./hooks/useAccountViewModel.js";
import FlaticonCredit from "./components/FlaticonCredit.jsx";
import AccountNoticeModal from "./components/AccountNoticeModal.jsx";

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
  demoOrders
}) {
  const vm = useAccountViewModel({
    navigate,
    demoUser,
    setDemoUser,
    currentPhone,
    loginOrRegisterByPhone,
    demoAddresses,
    setDemoAddresses,
    demoOrders
  });

  if (!currentPhone) {
    const lookupStats = getOrderStats(vm.lookupOrders);
    return (
      <section>
        <AppHeader title="Tài khoản" right={<button className="top-icon"><Icon name="bell" size={18} /></button>} />
        <div className="space-y-4 px-4">
          <div className="rounded-[28px] bg-white p-4 shadow-soft">
            <div className="grid grid-cols-2 rounded-2xl bg-cream p-1">
              <button onClick={() => vm.setAccountEntryTab("lookup")} className={`rounded-xl px-3 py-2 text-sm font-black ${vm.accountEntryTab === "lookup" ? "bg-white text-orange-600 shadow-sm" : "text-brown/55"}`}>Tra cứu đơn</button>
              <button onClick={() => vm.setAccountEntryTab("login")} className={`rounded-xl px-3 py-2 text-sm font-black ${vm.accountEntryTab === "login" ? "bg-white text-orange-600 shadow-sm" : "text-brown/55"}`}>Đăng nhập</button>
            </div>

            {vm.accountEntryTab === "lookup" ? (
              <div className="mt-4">
                <h2 className="text-base font-black text-brown">Tra cứu bằng số điện thoại</h2>
                <p className="mt-1 text-sm text-brown/60">Nhập số điện thoại để xem lịch sử đơn. Điểm, địa chỉ và voucher cần đăng nhập để xem đầy đủ.</p>
                <div className="mt-3 flex gap-2">
                  <input value={vm.authPhone} onChange={(event) => vm.setAuthPhone(event.target.value)} placeholder="Nhập số điện thoại" className="min-w-0 flex-1 rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none" />
                  <button onClick={vm.handlePhoneLookup} className="rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange">Tiếp tục</button>
                </div>
              </div>
            ) : vm.accountEntryTab === "login" ? (
              <div className="mt-4">
                <h2 className="text-base font-black text-brown">Đăng nhập tài khoản</h2>
                <p className="mt-1 text-sm text-brown/60">Nhập số điện thoại và mật khẩu để xem hồ sơ và dữ liệu khách hàng.</p>
                <div className="mt-3 space-y-3">
                  <input value={vm.loginDraft.phone} onChange={(event) => vm.setLoginDraft((draft) => ({ ...draft, phone: event.target.value }))} placeholder="Số điện thoại" className="w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none" />
                  <input type="password" value={vm.loginDraft.password} onChange={(event) => vm.setLoginDraft((draft) => ({ ...draft, password: event.target.value }))} placeholder="Mật khẩu" className="w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none" />
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
                <button onClick={() => { vm.setAccountEntryTab("forgot"); vm.setResetDraft((draft) => ({ ...draft, phone: vm.loginDraft.phone })); vm.setResetStep("verify"); }} className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-brown/55">Quên mật khẩu?</button>
              </div>
            ) : vm.accountEntryTab === "register" ? (
              <div className="mt-4">
                <h2 className="text-base font-black text-brown">Tạo tài khoản</h2>
                <p className="mt-1 text-sm text-brown/60">Nhập số điện thoại để tạo tài khoản. Nếu số này đã từng có đơn, app sẽ yêu cầu mã đơn gần nhất để xác minh.</p>
                <div className="mt-3 space-y-3">
                  <input value={vm.authPhone} onChange={(event) => vm.setAuthPhone(event.target.value)} placeholder="Số điện thoại" className="w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none" />
                  {vm.authMode === "claimBlocked" ? (
                    <>
                      <p className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">Số này đã từng đặt hàng. Bạn nhập mã đơn gần nhất để xác minh đúng chủ số điện thoại trước khi tạo tài khoản.</p>
                      <div className="flex overflow-hidden rounded-2xl border border-orange-100 bg-cream">
                        <span className="grid place-items-center bg-white px-4 text-sm font-black text-orange-600">GHR-</span>
                        <input value={vm.claimCode} onChange={(event) => vm.setClaimCode(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} placeholder="1028" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-black tracking-[0.25em] outline-none" />
                      </div>
                      <button onClick={vm.handleVerifyRecentOrder} className="w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange">Xác minh mã đơn</button>
                    </>
                  ) : null}
                  <input value={vm.registerDraft.name} onChange={(event) => vm.setRegisterDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Tên hiển thị" className="w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none" />
                  <input type="password" value={vm.registerDraft.password} onChange={(event) => vm.setRegisterDraft((draft) => ({ ...draft, password: event.target.value }))} placeholder="Mật khẩu (ít nhất 6 ký tự)" className="w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none" />
                  <input type="password" value={vm.registerDraft.confirmPassword} onChange={(event) => vm.setRegisterDraft((draft) => ({ ...draft, confirmPassword: event.target.value }))} placeholder="Nhập lại mật khẩu" className="w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none" />
                  <button onClick={vm.handleRegister} className="w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange">Tạo tài khoản</button>
                  <button onClick={() => vm.setAccountEntryTab("login")} className="w-full rounded-2xl bg-white px-4 py-3 text-xs font-black text-brown/55">Đã có tài khoản? Đăng nhập</button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <h2 className="text-base font-black text-brown">Đặt lại mật khẩu</h2>
                <p className="mt-1 text-sm text-brown/60">Xác minh bằng mã đơn gần nhất để đặt mật khẩu mới.</p>
                {vm.resetStep === "verify" ? (
                  <div className="mt-3 space-y-3">
                    <input value={vm.resetDraft.phone} onChange={(event) => vm.setResetDraft((draft) => ({ ...draft, phone: event.target.value }))} placeholder="Số điện thoại" className="w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none" />
                    <div className="flex overflow-hidden rounded-2xl border border-orange-100 bg-cream">
                      <span className="grid place-items-center bg-white px-4 text-sm font-black text-orange-600">GHR-</span>
                      <input value={vm.resetDraft.code} onChange={(event) => vm.setResetDraft((draft) => ({ ...draft, code: event.target.value.replace(/\D/g, "").slice(0, 4) }))} inputMode="numeric" maxLength={4} placeholder="1028" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-black tracking-[0.25em] outline-none" />
                    </div>
                    <button onClick={vm.handleVerifyResetPassword} className="w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange">Xác minh mã đơn</button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    <input type="password" value={vm.resetDraft.password} onChange={(event) => vm.setResetDraft((draft) => ({ ...draft, password: event.target.value }))} placeholder="Mật khẩu mới" className="w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none" />
                    <input type="password" value={vm.resetDraft.confirmPassword} onChange={(event) => vm.setResetDraft((draft) => ({ ...draft, confirmPassword: event.target.value }))} placeholder="Nhập lại mật khẩu mới" className="w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none" />
                    <button onClick={vm.handleUpdatePasswordFromOrder} className="w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange">Cập nhật mật khẩu</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {vm.accountEntryTab === "lookup" && (
            <>
              {vm.authNotice ? <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700">{vm.authNotice}</div> : null}
              {vm.lookupPhone ? (
                <AccountPanel title="Lịch sử đơn theo số điện thoại">
                  <div className="space-y-3">
                    <div className="rounded-[22px] bg-cream/60 p-3 text-sm font-bold text-brown/65">
                      {vm.lookupPhone} · {vm.isLookupLoading ? "Đang tra cứu..." : lookupStats.totalOrders ? `${lookupStats.totalOrders} đơn · ${formatMoney(lookupStats.totalSpent)}` : "Chưa có đơn hàng"}
                    </div>
                    {vm.lookupOrders.slice(0, 5).map((order) => (
                      <div key={order.id || order.orderCode} className="rounded-[22px] border border-orange-100 bg-cream/50 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <strong>{String(order.orderCode || "GHR-****").replace(/GHR-\d{4}/, "GHR-****")}</strong>
                            <p className="mt-1 text-brown/55">{new Date(order.createdAt).toLocaleString("vi-VN")}</p>
                          </div>
                          <strong className="text-orange-600">{formatMoney(order.totalAmount || order.total || 0)}</strong>
                        </div>
                        <p className="mt-2 text-xs text-brown/45">{(order.items || []).length} món · Địa chỉ đã được ẩn</p>
                      </div>
                    ))}
                  </div>
                </AccountPanel>
              ) : null}

              {vm.lookupPhone && vm.authMode === "login" ? (
                <AccountPanel title="Đăng nhập tài khoản">
                  <div className="space-y-3">
                    <input type="password" value={vm.authPassword} onChange={(event) => vm.setAuthPassword(event.target.value)} placeholder="Nhập mật khẩu" className="w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none" />
                    <button onClick={vm.handlePasswordLogin} className="w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange">Đăng nhập</button>
                  </div>
                </AccountPanel>
              ) : null}

              {vm.lookupPhone && vm.authMode === "claimBlocked" ? (
                <AccountPanel title="Xác minh để tạo tài khoản">
                  <div className="space-y-3">
                    <p className="text-sm text-brown/60">Số này đã từng đặt hàng, bạn cần mã đơn gần nhất để mở đăng ký.</p>
                    <div className="flex overflow-hidden rounded-2xl border border-orange-100 bg-cream">
                      <span className="grid place-items-center bg-white px-4 text-sm font-black text-orange-600">GHR-</span>
                      <input value={vm.claimCode} onChange={(event) => vm.setClaimCode(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} placeholder="1028" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-black tracking-[0.25em] outline-none" />
                    </div>
                    <button onClick={vm.handleVerifyRecentOrder} className="w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange">Xác minh mã đơn</button>
                  </div>
                </AccountPanel>
              ) : null}

              {vm.lookupPhone && vm.authMode === "register" ? (
                <AccountPanel title="Tạo tài khoản">
                  <div className="space-y-3">
                    <input value={vm.registerDraft.name} onChange={(event) => vm.setRegisterDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Tên hiển thị" className="w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none" />
                    <input type="password" value={vm.registerDraft.password} onChange={(event) => vm.setRegisterDraft((draft) => ({ ...draft, password: event.target.value }))} placeholder="Mật khẩu (ít nhất 6 ký tự)" className="w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none" />
                    <input type="password" value={vm.registerDraft.confirmPassword} onChange={(event) => vm.setRegisterDraft((draft) => ({ ...draft, confirmPassword: event.target.value }))} placeholder="Nhập lại mật khẩu" className="w-full rounded-2xl border border-orange-100 bg-cream px-4 py-3 text-sm outline-none" />
                    <button onClick={vm.handleRegister} className="w-full rounded-2xl bg-gradient-main px-4 py-3 text-sm font-black text-white shadow-orange">Tạo tài khoản</button>
                  </div>
                </AccountPanel>
              ) : null}
            </>
          )}
        </div>
        <FlaticonCredit />
        <AccountNoticeModal notice={vm.accountNotice} onClose={() => vm.setAccountNotice(null)} />
      </section>
    );
  }

  return (
    <section>
      <AppHeader title="Tài khoản" right={<button className="top-icon"><Icon name="bell" size={18} /></button>} />
      <div className="space-y-4 px-4">
        {vm.authNotice ? <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-bold text-green-700">{vm.authNotice}</div> : null}
        <div className="account-hero">
          <div className="flex items-center gap-4">
            {vm.accountUser.avatarUrl ? (
              <img src={vm.accountUser.avatarUrl} alt={vm.displayName} className="h-20 w-20 rounded-full border-4 border-white/70 object-cover shadow-soft" />
            ) : (
              <span className="grid h-20 w-20 place-items-center rounded-full border-4 border-white/70 bg-white text-orange-600 shadow-soft"><Icon name="star" size={28} /></span>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black text-white">{vm.displayName}</h2>
              <p className="mt-1 text-sm font-bold text-white/82">{vm.accountUser.phone}</p>
              {vm.showCustomerTier ? <p className="mt-1 text-sm font-bold text-white/82">{vm.rank}</p> : null}
            </div>
          </div>
          <button onClick={() => vm.setProfileOpen(true)} className="mt-5 w-full rounded-[20px] bg-white px-4 py-4 text-sm font-black text-orange-600 shadow-soft">Chỉnh sửa hồ sơ</button>
        </div>

        <AccountPanel
          title="Địa chỉ giao hàng"
          action="Thêm địa chỉ mới"
          onAction={() => vm.setAddressModal({ receiverName: vm.displayName, phone: currentPhone, isDefault: vm.addresses.length === 0 })}
        >
          <div className="space-y-3">
            {vm.visibleAddresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                onEdit={() => vm.setAddressModal(address)}
                onDelete={() => vm.handleDeleteAddress(address.id)}
                onSetDefault={() => vm.handleSetDefaultAddress(address.id)}
              />
            ))}
            {!vm.addresses.length ? <AppEmptyState icon={null} message="Bạn chưa có địa chỉ giao hàng" className="rounded-[22px] border border-orange-100 bg-cream/50 p-3 text-sm text-brown/55" /> : null}
          </div>
        </AccountPanel>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => vm.navigateToTab("orders")} className="account-metric">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-50 text-orange-600"><Icon name="bag" size={19} /></span>
            <strong>Lịch sử đơn hàng</strong>
            <small>{vm.stats.totalOrders ? `${vm.stats.totalOrders} đơn · ${formatMoney(vm.stats.totalSpent)}` : "Chưa có đơn hàng"}</small>
          </button>
          <button onClick={() => vm.navigateToTab("rewards")} className="account-metric">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-50 text-orange-600"><Icon name="star" size={19} /></span>
            <strong>{vm.showCustomerTier ? "Điểm thưởng & Hạng" : "Điểm thưởng"}</strong>
            <small>{demoLoyalty.totalPoints || 0} điểm{vm.showCustomerTier ? ` · ${vm.rank}` : ""}</small>
          </button>
        </div>

        <AccountPanel title="Đơn gần nhất">
          {vm.stats.latestOrder ? (
            <div className="rounded-[22px] border border-orange-100 bg-cream/50 p-3 text-sm">
              <strong>{vm.stats.latestOrder.orderCode}</strong>
              <p className="mt-1 text-brown/60">{new Date(vm.stats.latestOrder.createdAt).toLocaleString("vi-VN")} · {formatMoney(vm.stats.latestOrder.totalAmount)}</p>
              <button onClick={() => vm.navigateToTab("orders")} className="mt-3 rounded-2xl bg-orange-50 px-4 py-2 text-xs font-black text-orange-600">Xem lịch sử đơn</button>
            </div>
          ) : (
            <AppEmptyState icon={null} message="Chưa có đơn hàng" className="rounded-[22px] border border-orange-100 bg-cream/50 p-3 text-sm text-brown/55" />
          )}
        </AccountPanel>

        <AccountPanel title="Cài đặt thông báo">
          <div className="space-y-3">
            <SettingsToggle label="Cập nhật đơn hàng" checked />
            <SettingsToggle label="Khuyến mãi & Ưu đãi" checked />
            <SettingsToggle label="Tin tức mới" />
          </div>
        </AccountPanel>

        <button onClick={logoutDemoUser} className="w-full rounded-[24px] bg-red-50 py-4 text-sm font-black text-red-600 shadow-soft">Đăng xuất</button>
      </div>
      <FlaticonCredit />

      {vm.profileOpen ? <ProfileModal user={vm.accountUser} onClose={() => vm.setProfileOpen(false)} onSave={vm.handleSaveUser} /> : null}
      {vm.addressModal ? <AccountAddressModal address={vm.addressModal} onClose={() => vm.setAddressModal(null)} onSave={vm.handleSaveAddress} /> : null}
      <AccountNoticeModal notice={vm.accountNotice} onClose={() => vm.setAccountNotice(null)} />
    </section>
  );
}
