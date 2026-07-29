import { ClipboardText, SignOut, UsersThree } from "@phosphor-icons/react";

const MODULES = [
  { id: "people", label: "Quản lý nhân sự", icon: UsersThree },
  { id: "supervision", label: "Quản lý giám sát", icon: ClipboardText }
];

export default function AppShell({ profile, onLogout, activeModule, onModuleChange, children }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-icon"><ClipboardText weight="fill" /></span>
          <div><strong>GHR Vận hành</strong><small>Nhân sự & giám sát</small></div>
        </div>
        <nav className="module-nav" aria-label="Khu vực quản trị">
          {MODULES.map(({ id, label, icon: Icon }) => (
            <button type="button" key={id} className={activeModule === id ? "is-active" : ""} onClick={() => onModuleChange(id)}>
              <Icon weight={activeModule === id ? "fill" : "regular"} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="account-actions">
          <span>{profile?.name || "Admin"}</span>
          <button type="button" className="icon-button" onClick={onLogout} aria-label="Đăng xuất"><SignOut weight="bold" /></button>
        </div>
      </header>
      <main className="app-content">{children}</main>
      <nav className="mobile-module-nav" aria-label="Khu vực quản trị trên điện thoại">
        {MODULES.map(({ id, label, icon: Icon }) => (
          <button type="button" key={id} className={activeModule === id ? "is-active" : ""} onClick={() => onModuleChange(id)}>
            <Icon weight={activeModule === id ? "fill" : "regular"} /><span>{label.replace("Quản lý ", "")}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
