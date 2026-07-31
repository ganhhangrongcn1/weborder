import Icon from "../../components/Icon.jsx";

export default function AdminSidebar({
  navGroups,
  navIconMap,
  activeAdminNav,
  onActivateNav,
  notificationCounts = {}
}) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <span>GHR</span>
        <div>
          <strong>Gánh Hàng Rong</strong>
          <small>Quản trị cửa hàng</small>
        </div>
      </div>

      {navGroups.map((group) => (
        <div key={group.title} className="admin-nav-group">
          <p className="admin-nav-group-title">{group.title}</p>
          <div className="grid gap-1">
            {group.items.map((item) => {
              const notificationCount = Number(notificationCounts[item.id] || 0);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-xl px-3 py-2 text-left text-sm font-semibold ${activeAdminNav === item.id ? "active " : ""}${notificationCount > 0 ? "has-notification" : ""}`.trim()}
                  onClick={() => onActivateNav(item)}
                >
                  <Icon name={navIconMap[item.id] || "star"} size={16} />
                  <span className="admin-nav-label">{item.label}</span>
                  {notificationCount > 0 ? (
                    <span className="admin-nav-badge" aria-label={`${notificationCount} yêu cầu chờ duyệt`}>
                      {notificationCount > 99 ? "99+" : notificationCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}
