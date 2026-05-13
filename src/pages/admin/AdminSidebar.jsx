import Icon from "../../components/Icon.jsx";

export default function AdminSidebar({ navGroups, navIconMap, activeAdminNav, onActivateNav }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <span>GHR</span>
        <div>
          <strong>Gánh Hàng Rong</strong>
          <small>Admin Console</small>
        </div>
      </div>

      {navGroups.map((group) => (
        <div key={group.title} className="admin-nav-group">
          <p className="admin-nav-group-title">{group.title}</p>
          <div className="grid gap-1">
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rounded-xl px-3 py-2 text-left text-sm font-semibold ${activeAdminNav === item.id ? "active" : ""}`}
                onClick={() => onActivateNav(item)}
              >
                <Icon name={navIconMap[item.id] || "star"} size={16} />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}
