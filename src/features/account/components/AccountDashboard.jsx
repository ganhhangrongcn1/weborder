import Icon from "../../../components/Icon.jsx";
import AppEmptyState from "../../../components/app/EmptyState.jsx";
import AccountPanel from "../../../pages/customer/account/AccountPanel.jsx";
import AddressCard from "../../../pages/customer/account/AddressCard.jsx";

function OverviewSkeleton() {
  return (
    <div className="account-overview-grid" aria-label="Đang tải tổng quan tài khoản">
      {[0, 1, 2].map((item) => (
        <div key={item} className="account-overview-metric">
          <span className="account-skeleton account-skeleton--label" />
          <span className="account-skeleton account-skeleton--value" />
        </div>
      ))}
    </div>
  );
}

function OverviewMetric({ label, value, suffix = "" }) {
  return (
    <div className="account-overview-metric">
      <span>{label}</span>
      <strong>
        {value}
        {suffix ? <small>{suffix}</small> : null}
      </strong>
    </div>
  );
}

function getTierProgressMetric(tierJourney = {}) {
  const nextTier = tierJourney.nextTier;
  const estimatedOrders = tierJourney.estimatedOrdersToNext;

  if (!nextTier) {
    return {
      label: "Hạng hiện tại",
      value: tierJourney.currentTier?.name || "Đang cập nhật",
      suffix: "hạng cao nhất"
    };
  }

  if (Number.isFinite(estimatedOrders) && estimatedOrders > 0) {
    return {
      label: `Lên ${nextTier.name}`,
      value: `Khoảng ${estimatedOrders.toLocaleString("vi-VN")}`,
      suffix: "đơn nữa"
    };
  }

  return {
    label: `Lên ${nextTier.name}`,
    value: "Tiếp tục",
    suffix: "tích hạng"
  };
}

export default function AccountDashboard({
  vm,
  logoutDemoUser
}) {
  const points = Number(vm.accountOverview.loyalty?.totalPoints || 0);
  const showOverviewSkeleton = vm.accountOverview.isLoading && !vm.accountOverview.hasSummary;
  const tierProgressMetric = getTierProgressMetric(vm.tierJourney);

  return (
    <div className="account-page-content space-y-4 px-4 pt-4">
      {vm.authNotice ? (
        <div className="account-success-notice" role="status" aria-live="polite">
          {vm.authNotice}
        </div>
      ) : null}

      {vm.accountOverview.error ? (
        <div className="account-sync-notice" role="status">
          <div>
            <strong>Dữ liệu chưa đồng bộ đầy đủ</strong>
            <p>{vm.accountOverview.error}</p>
          </div>
          <button type="button" onClick={() => vm.accountOverview.refresh()}>
            Thử lại
          </button>
        </div>
      ) : null}

      <section className="account-hero" aria-labelledby="account-profile-name">
        <div className="account-profile-row">
          {vm.accountUser.avatarUrl ? (
            <img
              src={vm.accountUser.avatarUrl}
              alt={`Ảnh đại diện của ${vm.displayName}`}
              width="72"
              height="72"
              className="account-profile-avatar"
            />
          ) : (
            <span className="account-profile-avatar account-profile-avatar--fallback">
              <Icon name="user" size={27} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="account-profile-kicker">Tài khoản thành viên</p>
            <h2 id="account-profile-name">{vm.displayName}</h2>
            <p className="account-profile-phone">{vm.accountUser.phone}</p>
          </div>
          <button
            type="button"
            onClick={() => vm.setProfileOpen(true)}
            className="account-profile-edit"
            aria-label="Chỉnh sửa hồ sơ và mật khẩu"
          >
            <Icon name="edit" size={18} />
          </button>
        </div>
      </section>

      <section className="account-overview" aria-labelledby="account-overview-title">
        <div className="account-overview__header">
          <div>
            <h2 id="account-overview-title">Tổng quan thành viên</h2>
            <p>Tính từ đơn hợp lệ trên mọi kênh.</p>
          </div>
          {vm.accountOverview.isLoading ? <span>Đang cập nhật…</span> : null}
        </div>

        {showOverviewSkeleton ? (
          <OverviewSkeleton />
        ) : (
          <div className="account-overview-grid">
            <OverviewMetric
              label="Điểm hiện có"
              value={points.toLocaleString("vi-VN")}
              suffix="điểm"
            />
            <OverviewMetric
              label="Tổng đơn"
              value={Number(vm.stats.totalOrders || 0).toLocaleString("vi-VN")}
              suffix="đơn"
            />
            <OverviewMetric
              label={tierProgressMetric.label}
              value={tierProgressMetric.value}
              suffix={tierProgressMetric.suffix}
            />
          </div>
        )}
      </section>

      <AccountPanel
        title="Địa chỉ giao hàng"
        action="Thêm địa chỉ"
        onAction={() => vm.setAddressModal({
          receiverName: vm.displayName,
          phone: vm.accountUser.phone,
          isDefault: vm.addresses.length === 0
        })}
      >
        <div className="space-y-3">
          {vm.visibleAddresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={() => vm.setAddressModal(address)}
              onDelete={() => vm.handleDeleteAddress(address.id)}
              onSetDefault={() => vm.handleSetDefaultAddress(address.id)}
              canDelete={vm.addresses.length > 1}
              fallbackReceiverName={vm.displayName}
            />
          ))}
          {!vm.addresses.length ? (
            <AppEmptyState
              icon={null}
              message="Bạn chưa có địa chỉ giao hàng."
              className="rounded-[22px] border border-orange-100 bg-cream/50 p-3 text-sm text-brown/55"
            />
          ) : null}
          {vm.addresses.length > 1 ? (
            <button
              type="button"
              onClick={() => vm.setShowAllAddresses((current) => !current)}
              className="account-address-toggle"
            >
              {vm.showAllAddresses
                ? "Thu gọn danh sách"
                : `Xem tất cả ${vm.addresses.length} địa chỉ`}
            </button>
          ) : null}
        </div>
      </AccountPanel>

      <button type="button" onClick={logoutDemoUser} className="account-logout">
        Đăng xuất
      </button>
    </div>
  );
}
