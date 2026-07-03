import {
  AdminBadge as UIAdminBadge,
  AdminButton as UIAdminButton,
  AdminCard as UIAdminCard,
  AdminInput as UIAdminInput,
  AdminPanel as UIAdminPanel,
  AdminSelect as UIAdminSelect,
  AdminStatCard as UIAdminStatCard
} from "./index.js";

export function AdminButton({ children, variant = "primary", className = "", ...props }) {
  return (
    <UIAdminButton variant={variant} className={className} {...props}>
      {children}
    </UIAdminButton>
  );
}

export function AdminBadge({ children, tone = "neutral", className = "" }) {
  const normalizedTone = tone === "default" ? "neutral" : tone;
  return (
    <UIAdminBadge tone={normalizedTone} className={className}>
      {children}
    </UIAdminBadge>
  );
}

export function AdminCard({ children, className = "", variant = "default", as = "section" }) {
  return (
    <UIAdminCard className={className} variant={variant} as={as}>
      {children}
    </UIAdminCard>
  );
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

export function AdminSearchInput({
  value,
  onChange,
  onValueChange,
  placeholder = "Tìm kiếm...",
  className = "",
  inputClassName = "",
  ...props
}) {
  const handleChange = (event) => {
    if (onValueChange) {
      onValueChange(event.target.value, event);
      return;
    }
    if (onChange) onChange(event);
  };

  return (
    <label className={`admin-search-input ${className}`.trim()}>
      <span className="admin-search-icon" aria-hidden="true">
        ⌕
      </span>
      <UIAdminInput
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={inputClassName}
        {...props}
      />
    </label>
  );
}

export function AdminStatusSelect({
  value,
  onChange,
  onValueChange,
  options = [],
  className = "",
  ...props
}) {
  const handleChange = (event) => {
    if (onValueChange) {
      onValueChange(event.target.value, event);
      return;
    }
    if (onChange) onChange(event);
  };

  return (
    <UIAdminSelect
      className={`admin-status-select ${className}`.trim()}
      value={value}
      onChange={handleChange}
      options={options}
      {...props}
    />
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

export function AdminInput({
  value,
  onChange,
  onValueChange,
  type = "text",
  className = "",
  ...props
}) {
  const handleChange = (event) => {
    if (onValueChange) {
      onValueChange(event.target.value, event);
      return;
    }
    if (onChange) onChange(event);
  };

  return (
    <UIAdminInput
      type={type}
      value={value}
      onChange={handleChange}
      className={className}
      {...props}
    />
  );
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

export function AdminPanel({
  title,
  description,
  action,
  onAction,
  children,
  className = "",
  bodyClassName = ""
}) {
  const resolvedAction =
    typeof action === "string" && onAction
      ? <UIAdminButton onClick={onAction}>{action}</UIAdminButton>
      : action;

  return (
    <UIAdminPanel
      title={title}
      description={description}
      action={resolvedAction}
      className={className}
    >
      {children ? <div className={`admin-ui-panel-body ${bodyClassName}`.trim()}>{children}</div> : null}
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
            onValueChange={(value) =>
              onChange({ [field]: typeof item[field] === "number" ? Number(value) : value })
            }
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
