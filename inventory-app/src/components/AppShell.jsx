import {
  Archive,
  ArrowsLeftRight,
  Buildings,
  ChartDonut,
  ClipboardText,
  House,
  Package,
  SignOut,
  Truck,
  Users
} from "@phosphor-icons/react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Tổng quan", icon: House },
  { id: "inventory", label: "Tồn kho", icon: Package },
  { id: "transfers", label: "Giao nhận", icon: Truck },
  { id: "receipts", label: "Nhập hàng", icon: Archive },
  { id: "counts", label: "Kiểm kê", icon: ClipboardText },
  { id: "catalog", label: "Danh mục", icon: Buildings, adminOnly: true },
  { id: "staff", label: "Nhân viên", icon: Users, adminOnly: true },
  { id: "reports", label: "Báo cáo", icon: ChartDonut }
];

export default function AppShell({
  activePage,
  onNavigate,
  role,
  warehouses,
  selectedWarehouseId,
  onSelectWarehouse,
  onSignOut,
  children
}) {
  const isAdmin = role === "owner" || role === "admin";
  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark small"><ArrowsLeftRight weight="bold" /></span>
          <div><strong>Kho Gánh Hàng Rong</strong><small>Vận hành mỗi ngày</small></div>
        </div>
        <nav>
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={activePage === item.id ? "nav-item active" : "nav-item"}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={21} weight={activePage === item.id ? "fill" : "regular"} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <button className="nav-item sign-out" onClick={onSignOut}>
          <SignOut size={21} /> Đăng xuất
        </button>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Không gian làm việc</p>
            <select value={selectedWarehouseId} onChange={(event) => onSelectWarehouse(event.target.value)}>
              {isAdmin ? <option value="">Tất cả kho</option> : null}
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </div>
          <div className="user-chip">
            <span>{role === "owner" ? "Chủ doanh nghiệp" : role === "admin" ? "Quản trị viên" : "Nhân viên"}</span>
            <div className="avatar">GH</div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      <nav className="mobile-nav">
        {visibleNav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} className={activePage === item.id ? "active" : ""} onClick={() => onNavigate(item.id)}>
              <Icon size={22} weight={activePage === item.id ? "fill" : "regular"} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}



