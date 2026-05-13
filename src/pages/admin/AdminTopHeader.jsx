import Icon from "../../components/Icon.jsx";

export default function AdminTopHeader({
  adminGlobalSearch,
  setAdminGlobalSearch,
  selectedBranchFilter,
  setSelectedBranchFilter,
  branches,
  syncStatusLabel,
  adminEmail = "",
  onLogout = null
}) {
  return (
    <header className="admin-top-header">
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

      <div className="admin-top-header-right">
        <span className="admin-top-sync-badge">{syncStatusLabel}</span>
        <select
          className="admin-top-branch"
          value={selectedBranchFilter}
          onChange={(event) => setSelectedBranchFilter(event.target.value)}
        >
          <option value="all">{"Tất cả chi nhánh"}</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </select>

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
