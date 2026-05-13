import {
  AdminBadge as UIAdminBadge,
  AdminButton as UIAdminButton,
  AdminCard as UIAdminCard,
  AdminInput as UIAdminInput,
  AdminPanel as UIAdminPanel,
  AdminStatCard as UIAdminStatCard
} from "./index.js";

export function AdminButton({ children, variant = "primary", className = "", ...props }) {
  return (
    <UIAdminButton variant={variant} className={className} {...props}>
      {children}
    </UIAdminButton>
  );
}

export function AdminBadge({ children, tone = "neutral" }) {
  const normalizedTone = tone === "default" ? "neutral" : tone;
  return <UIAdminBadge tone={normalizedTone}>{children}</UIAdminBadge>;
}

export function AdminCard({ children, className = "" }) {
  return <UIAdminCard className={className}>{children}</UIAdminCard>;
}

export function AdminSectionTitle({ title, description, action }) {
  return (
    <div className="admin-section-title">
      <div>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="admin-section-title-action">{action}</div> : null}
    </div>
  );
}

export function AdminPageHeader({ title, description, action }) {
  return (
    <header className="admin-page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="admin-page-header-action">{action}</div> : null}
    </header>
  );
}

export function AdminToolbar({ left, right }) {
  return (
    <div className="admin-toolbar">
      <div className="admin-toolbar-left">{left}</div>
      <div className="admin-toolbar-right">{right}</div>
    </div>
  );
}

export function AdminSearchInput({ value, onChange, placeholder = "Tìm kiếm..." }) {
  return (
    <label className="admin-search-input">
      <span className="admin-search-icon">⌕</span>
      <UIAdminInput value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function AdminStatusSelect({ value, onChange, options = [] }) {
  return (
    <select className="admin-status-select" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </select>
  );
}

export function AdminStatCard({ title, value, subtitle = "", icon = "•", tone = "default" }) {
  return <UIAdminStatCard title={title} value={value} subtitle={subtitle} icon={icon} tone={tone} />;
}

export function AdminEmptyState({ message = "Chưa có dữ liệu.", action }) {
  return (
    <div className="admin-empty-state">
      <p>{message}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function AdminInput({ value, onChange, type = "text" }) {
  return <UIAdminInput type={type} value={value} onChange={(event) => onChange(event.target.value)} />;
}

export function AdminSwitch({ checked, onChange }) {
  return (
    <label className="admin-switch">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span />
    </label>
  );
}

export function AdminStat({ title, value }) {
  return <AdminStatCard title={title} value={value} />;
}

export function AdminPanel({ title, action, onAction, children }) {
  return (
    <UIAdminPanel
      title={title}
      action={action ? <UIAdminButton onClick={onAction}>{action}</UIAdminButton> : null}
    >
      {children ? <div className="admin-ui-panel-body">{children}</div> : null}
    </UIAdminPanel>
  );
}

export function AdminPlaceholder({ text = "Đang phát triển" }) {
  return (
    <UIAdminPanel>
      <div className="admin-ui-panel-body">
        <p className="text-sm font-bold text-brown/60">{text}</p>
      </div>
    </UIAdminPanel>
  );
}

export function AdminEditableCard({ item, fields, onChange, onDelete }) {
  return (
    <div className="admin-edit-card">
      <div className="admin-edit-fields">
        {fields.map((field) => (
          <AdminInput
            key={field}
            type={typeof item[field] === "number" ? "number" : "text"}
            value={item[field] ?? ""}
            onChange={(value) => onChange({ [field]: typeof item[field] === "number" ? Number(value) : value })}
          />
        ))}
      </div>
      <AdminSwitch checked={item.active ?? item.open ?? true} onChange={(checked) => onChange({ active: checked, open: checked })} />
      <UIAdminButton variant="danger" onClick={onDelete}>
        Xóa
      </UIAdminButton>
    </div>
  );
}
