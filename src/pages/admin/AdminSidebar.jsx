import { useEffect, useMemo, useState } from "react";
import Icon from "../../components/Icon.jsx";

function getGroupId(group, index) {
  return group.id || `admin-nav-group-${index}`;
}

function AdminNavItem({ item, navIconMap, activeAdminNav, notificationCounts, onActivateNav }) {
  const notificationCount = Number(notificationCounts[item.id] || 0);
  const isDisabled = item.disabled === true;

  return (
    <button
      type="button"
      className={`rounded-xl px-3 py-2 text-left text-sm font-semibold ${activeAdminNav === item.id ? "active " : ""}${notificationCount > 0 ? "has-notification " : ""}${isDisabled ? "is-planned" : ""}`.trim()}
      onClick={isDisabled ? undefined : () => onActivateNav(item)}
      aria-current={activeAdminNav === item.id ? "page" : undefined}
      aria-disabled={isDisabled || undefined}
      disabled={isDisabled}
      title={isDisabled ? `${item.label} — ${item.statusLabel || "Sắp ra mắt"}` : item.label}
    >
      <Icon name={navIconMap[item.id] || item.icon || "star"} size={16} />
      <span className="admin-nav-label">{item.label}</span>
      {isDisabled ? <span className="admin-nav-planned-badge">{item.statusLabel || "Sắp ra mắt"}</span> : null}
      {notificationCount > 0 ? (
        <span className="admin-nav-badge" aria-label={`${notificationCount} việc cần xử lý`}>
          {notificationCount > 99 ? "99+" : notificationCount}
        </span>
      ) : null}
    </button>
  );
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
  const activeSubgroupId = useMemo(() => {
    for (const group of navGroups) {
      const activeSubgroup = group.subgroups?.find((subgroup) => (
        subgroup.items.some((item) => item.id === activeAdminNav)
      ));
      if (activeSubgroup) return activeSubgroup.id;
    }
    return "";
  }, [activeAdminNav, navGroups]);
  const [openGroupIds, setOpenGroupIds] = useState(() => new Set(activeGroupId ? [activeGroupId] : []));
  const [openSubgroupIds, setOpenSubgroupIds] = useState(() => new Set(activeSubgroupId ? [activeSubgroupId] : []));

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
    if (!activeSubgroupId) return;
    setOpenSubgroupIds((current) => {
      if (current.has(activeSubgroupId)) return current;
      const next = new Set(current);
      next.add(activeSubgroupId);
      return next;
    });
  }, [activeSubgroupId]);

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

  const toggleSubgroup = (subgroupId) => {
    setOpenSubgroupIds((current) => {
      const next = new Set(current);
      if (next.has(subgroupId)) next.delete(subgroupId);
      else next.add(subgroupId);
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

              <div
                id={panelId}
                className={`admin-nav-items${group.subgroups?.length ? " admin-nav-items--nested" : ""}`}
                hidden={!isOpen}
              >
                {group.subgroups?.length ? (
                  <>
                    {(group.standaloneItems || []).map((item) => (
                      <AdminNavItem
                        key={item.id}
                        item={item}
                        navIconMap={navIconMap}
                        activeAdminNav={activeAdminNav}
                        notificationCounts={notificationCounts}
                        onActivateNav={onActivateNav}
                      />
                    ))}
                    {group.subgroups.map((subgroup) => {
                      const subgroupPanelId = `${subgroup.id}-items`;
                      const isSubgroupOpen = openSubgroupIds.has(subgroup.id);
                      const isActiveSubgroup = subgroup.items.some((item) => item.id === activeAdminNav);
                      const subgroupNotificationCount = subgroup.items.reduce(
                        (total, item) => total + Number(notificationCounts[item.id] || 0),
                        0
                      );

                      return (
                        <section
                          key={subgroup.id}
                          className={`admin-nav-subgroup${isSubgroupOpen ? " is-open" : ""}${isActiveSubgroup ? " is-active" : ""}`}
                        >
                          <button
                            type="button"
                            className="admin-nav-subgroup-toggle"
                            aria-expanded={isSubgroupOpen}
                            aria-controls={subgroupPanelId}
                            onClick={() => toggleSubgroup(subgroup.id)}
                          >
                            <Icon name={subgroup.icon || "folder"} size={16} />
                            <span>{subgroup.title}</span>
                            {subgroupNotificationCount > 0 ? (
                              <small className="admin-nav-subgroup-badge is-notification" aria-label={`${subgroupNotificationCount} thông báo`}>
                                {subgroupNotificationCount > 99 ? "99+" : subgroupNotificationCount}
                              </small>
                            ) : subgroup.badge ? <small className="admin-nav-subgroup-badge">{subgroup.badge}</small> : null}
                            <span className="admin-nav-subgroup-chevron" aria-hidden="true" />
                          </button>
                          <div id={subgroupPanelId} className="admin-nav-subgroup-items" hidden={!isSubgroupOpen}>
                            {subgroup.items.map((item) => (
                              <AdminNavItem
                                key={item.id}
                                item={item}
                                navIconMap={navIconMap}
                                activeAdminNav={activeAdminNav}
                                notificationCounts={notificationCounts}
                                onActivateNav={onActivateNav}
                              />
                            ))}
                          </div>
                        </section>
                      );
                    })}
                  </>
                ) : group.items.map((item) => (
                  <AdminNavItem
                    key={item.id}
                    item={item}
                    navIconMap={navIconMap}
                    activeAdminNav={activeAdminNav}
                    notificationCounts={notificationCounts}
                    onActivateNav={onActivateNav}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </nav>
      </aside>
    </>
  );
}
