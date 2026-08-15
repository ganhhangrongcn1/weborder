import { useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon.jsx";

function getGroupId(group, index) {
  return group.id || `admin-nav-group-${index}`;
}

export default function AdminSidebar({
  navGroups,
  navIconMap,
  activeAdminNav,
  onActivateNav,
  notificationCounts = {},
  isMobileOpen = false,
  onMobileClose
}) {
  const activeGroupId = useMemo(() => {
    const activeIndex = navGroups.findIndex((group) => (
      group.items.some((item) => item.id === activeAdminNav)
    ));
    return activeIndex >= 0 ? getGroupId(navGroups[activeIndex], activeIndex) : "";
  }, [activeAdminNav, navGroups]);
  const [openGroupIds, setOpenGroupIds] = useState(() => new Set(activeGroupId ? [activeGroupId] : []));

  useEffect(() => {
    if (!activeGroupId) return;
    setOpenGroupIds((current) => {
      if (current.has(activeGroupId)) return current;
      const next = new Set(current);
      next.add(activeGroupId);
      return next;
    });
  }, [activeGroupId]);

  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onMobileClose?.();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileOpen, onMobileClose]);

  const toggleGroup = (groupId) => {
    setOpenGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <>
      <button
        type="button"
        className={`admin-sidebar-backdrop${isMobileOpen ? " is-visible" : ""}`}
        onClick={onMobileClose}
        aria-label="Đóng menu quản trị"
        tabIndex={isMobileOpen ? 0 : -1}
      />
      <aside className={`admin-sidebar${isMobileOpen ? " is-mobile-open" : ""}`}>
      <div className="admin-mobile-sidebar-head">
        <div className="admin-mobile-brand">
          <span>GHR</span>
          <div>
            <strong>Gánh Hàng Rong</strong>
            <small>Quản trị cửa hàng</small>
          </div>
        </div>
        <button type="button" className="admin-mobile-sidebar-close" onClick={onMobileClose} aria-label="Đóng menu quản trị">
          <Icon name="close" size={19} />
        </button>
      </div>
      <div className="admin-brand">
        <span>GHR</span>
        <div>
          <strong>Gánh Hàng Rong</strong>
          <small>Quản trị cửa hàng</small>
        </div>
      </div>

      <nav className="admin-nav" aria-label="Điều hướng quản trị">
        {navGroups.map((group, groupIndex) => {
          const groupId = getGroupId(group, groupIndex);
          const panelId = `${groupId}-items`;
          const isOpen = openGroupIds.has(groupId);
          const isActiveGroup = groupId === activeGroupId;
          const groupNotificationCount = group.items.reduce(
            (total, item) => total + Number(notificationCounts[item.id] || 0),
            0
          );

          return (
            <section
              key={groupId}
              className={`admin-nav-group${isOpen ? " is-open" : ""}${isActiveGroup ? " is-active" : ""}`}
            >
              <button
                type="button"
                className="admin-nav-group-toggle"
                aria-expanded={isOpen}
                aria-controls={panelId}
                title={group.title}
                onClick={() => toggleGroup(groupId)}
              >
                <span className="admin-nav-group-icon">
                  <Icon name={group.icon || "star"} size={17} />
                </span>
                <span className="admin-nav-group-copy">
                  <strong>{group.title}</strong>
                </span>
                {groupNotificationCount > 0 ? (
                  <span className="admin-nav-group-badge" aria-label={`${groupNotificationCount} thông báo`}>
                    {groupNotificationCount > 99 ? "99+" : groupNotificationCount}
                  </span>
                ) : null}
                <span className="admin-nav-group-chevron" aria-hidden="true" />
              </button>

              <div id={panelId} className="admin-nav-items" hidden={!isOpen}>
            {group.items.map((item) => {
              const notificationCount = Number(notificationCounts[item.id] || 0);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-xl px-3 py-2 text-left text-sm font-semibold ${activeAdminNav === item.id ? "active " : ""}${notificationCount > 0 ? "has-notification" : ""}`.trim()}
                  onClick={() => onActivateNav(item)}
                  aria-current={activeAdminNav === item.id ? "page" : undefined}
                  title={item.label}
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
            </section>
          );
        })}
      </nav>
      </aside>
    </>
  );
}
