import Icon from "../../components/Icon.jsx";
import { buildBranchFilterOptions } from "../../services/branchIdentityService.js";

export default function AdminTopHeader({
  adminGlobalSearch,
  setAdminGlobalSearch,
  selectedBranchFilter,
  setSelectedBranchFilter,
  branches,
  branchOptions = null,
  branchSelectorLocked = false,
  syncStatusLabel,
  adminEmail = "",
  onLogout = null,
  compact = false,
  onOpenMobileNav
}) {
  const resolvedBranchOptions = Array.isArray(branchOptions)
    ? branchOptions
    : buildBranchFilterOptions(branches);

  return (
    <header className={`admin-top-header ${compact ? "is-dashboard-compact" : ""}`.trim()}>
      <button
        type="button"
        className="admin-mobile-menu-trigger"
        onClick={onOpenMobileNav}
        aria-label="Mở menu quản trị"
      >
        <Icon name="menu" size={20} />
      </button>
      {!compact ? (
        <div className="admin-top-header-left">
          <label className="admin-top-search">
            <Icon name="search" size={16} />
            <input
              value={adminGlobalSearch}
              onChange={(event) => setAdminGlobalSearch(event.target.value)}
              placeholder={"Tìm nhanh đơn hàng, khách hàng, món..."}
            />
          </label>
        </div>
      ) : null}

      <div className="admin-top-header-right">
        {!compact ? <span className="admin-top-sync-badge">{syncStatusLabel}</span> : null}
        {!compact ? (
          <select
            className="admin-top-branch"
            value={selectedBranchFilter}
            onChange={(event) => setSelectedBranchFilter(event.target.value)}
            disabled={branchSelectorLocked}
            aria-label={branchSelectorLocked ? "Chi nhánh được giới hạn theo tài khoản" : "Lọc theo chi nhánh"}
            title={branchSelectorLocked ? "Phạm vi chi nhánh được khóa theo tài khoản đăng nhập" : undefined}
          >
            {branchSelectorLocked && resolvedBranchOptions.length === 0
              ? <option value="">Chưa được cấp phạm vi chi nhánh</option>
              : null}
            {!branchSelectorLocked ? <option value="all">{"Tất cả chi nhánh"}</option> : null}
            {resolvedBranchOptions.map((branch) => (
              <option key={branch.value} value={branch.value}>{branch.label}</option>
            ))}
          </select>
        ) : null}

        <button type="button" className="admin-top-icon-btn" aria-label={"Thông báo"}>
          <Icon name="bell" size={17} />
        </button>

        {onLogout ? (
          <>
            <button type="button" className="admin-top-logout-btn" onClick={onLogout}>
              Đăng xuất
            </button>
            <button type="button" className="admin-top-avatar" aria-label={"Tài khoản admin"}>
              {String(adminEmail || "Admin").slice(0, 2).toUpperCase()}
            </button>
          </>
        ) : (
          <button type="button" className="admin-top-avatar" aria-label={"Tài khoản admin"}>QA</button>
        )}
      </div>
    </header>
  );
}
