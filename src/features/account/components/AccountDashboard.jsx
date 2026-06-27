import Icon from "../../../components/Icon.jsx";
import AppEmptyState from "../../../components/app/EmptyState.jsx";
import { formatMoney } from "../../../utils/format.js";
import {
  getCustomerOrderDisplayStatus,
  getCustomerOrderStatusToneClass
} from "../../../services/customerOrderStatusService.js";
import {
  getCanonicalOrderBranchName,
  getOrderSourceBadge
} from "../../../services/partnerOrderService.js";
import AccountPanel from "../../../pages/customer/account/AccountPanel.jsx";
import AddressCard from "../../../pages/customer/account/AddressCard.jsx";

const accountDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short"
});

function getAccountOrderCode(order = {}) {
  if (order.sourceType === "partner") {
    return order.displayOrderCode || order.orderCode || "FoodApp";
  }
  return order.orderCode || "GHR-****";
}

function formatOrderDate(value = "") {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa cập nhật thời gian" : accountDateTimeFormatter.format(date);
}

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

function ShortcutButton({ icon, label, description, onClick }) {
  return (
    <button type="button" onClick={onClick} className="account-shortcut">
      <span className="account-shortcut__icon">
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </button>
  );
}

function RecentOrderCard({ order, branches, onOpenOrders }) {
  if (!order) {
    return (
      <AppEmptyState
        icon={null}
        message="Bạn chưa có đơn hàng nào."
        className="rounded-[22px] border border-orange-100 bg-cream/50 p-3 text-sm text-brown/55"
      />
    );
  }

  const sourceBadge = getOrderSourceBadge(order);
  const statusMeta = getCustomerOrderDisplayStatus(order);
  const branchName = getCanonicalOrderBranchName(order, branches);

  return (
    <article className="account-recent-order">
      <div className="account-recent-order__top">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong>{getAccountOrderCode(order)}</strong>
            <span className={`account-order-source ${sourceBadge.className}`}>
              {sourceBadge.label}
            </span>
          </div>
          <p>{formatOrderDate(order.createdAt || order.orderTime)}</p>
        </div>
        <span className={`account-order-status ${getCustomerOrderStatusToneClass(statusMeta)}`}>
          {statusMeta.label}
        </span>
      </div>

      <div className="account-recent-order__summary">
        <span>{branchName || "Đang cập nhật chi nhánh"}</span>
        <strong>{formatMoney(order.totalAmount || order.total || 0)}</strong>
      </div>

      <button type="button" onClick={onOpenOrders} className="account-inline-action">
        Xem chi tiết đơn
        <Icon name="back" size={15} className="account-inline-action__arrow" />
      </button>
    </article>
  );
}

export default function AccountDashboard({
  vm,
  branches = [],
  logoutDemoUser
}) {
  const points = Number(vm.accountOverview.loyalty?.totalPoints || 0);
  const showOverviewSkeleton = vm.accountOverview.isLoading && !vm.accountOverview.hasSummary;

  return (
    <div className="account-page-content space-y-4 px-4">
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
            <Icon name="gear" size={18} />
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
              label="Tổng chi"
              value={formatMoney(vm.stats.totalSpent || 0)}
            />
          </div>
        )}
      </section>

      <section className="account-shortcuts" aria-label="Thao tác nhanh">
        <ShortcutButton
          icon="bag"
          label="Đơn hàng"
          description="Theo dõi và mua lại"
          onClick={() => vm.navigateToTab("orders")}
        />
        <ShortcutButton
          icon="gift"
          label="Điểm & ưu đãi"
          description="Xem quà đang có"
          onClick={() => vm.navigateToTab("rewards")}
        />
        <ShortcutButton
          icon="home"
          label="Thêm địa chỉ"
          description="Lưu nơi giao mới"
          onClick={() => vm.setAddressModal({
            receiverName: vm.displayName,
            phone: vm.accountUser.phone,
            isDefault: vm.addresses.length === 0
          })}
        />
      </section>

      <AccountPanel title="Đơn gần nhất">
        {vm.accountOverview.isLoading && !vm.stats.latestOrder ? (
          <div className="account-recent-order account-recent-order--loading">
            <span className="account-skeleton account-skeleton--wide" />
            <span className="account-skeleton account-skeleton--medium" />
            <span className="account-skeleton account-skeleton--wide" />
          </div>
        ) : (
          <RecentOrderCard
            order={vm.stats.latestOrder}
            branches={branches}
            onOpenOrders={() => vm.navigateToTab("orders")}
          />
        )}
      </AccountPanel>

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
