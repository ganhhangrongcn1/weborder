import { AdminBadge as UIAdminBadge, AdminButton as UIAdminButton, AdminCard as UIAdminCard, AdminInput as UIAdminInput, AdminPanel as UIAdminPanel, AdminStatCard as UIAdminStatCard } from "./index.js";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function AdminButton({
  children,
  variant = "primary",
  className = "",
  ...props
}) {
  return /*#__PURE__*/_jsx(UIAdminButton, {
    variant: variant,
    className: className,
    ...props,
    children: children
  });
}
export function AdminBadge({
  children,
  tone = "neutral"
}) {
  const normalizedTone = tone === "default" ? "neutral" : tone;
  return /*#__PURE__*/_jsx(UIAdminBadge, {
    tone: normalizedTone,
    children: children
  });
}
export function AdminCard({
  children,
  className = ""
}) {
  return /*#__PURE__*/_jsx(UIAdminCard, {
    className: className,
    children: children
  });
}
export function AdminSectionTitle({
  title,
  description,
  action
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-section-title",
    children: [/*#__PURE__*/_jsxs("div", {
      children: [/*#__PURE__*/_jsx("h2", {
        children: title
      }), description ? /*#__PURE__*/_jsx("p", {
        children: description
      }) : null]
    }), action ? /*#__PURE__*/_jsx("div", {
      className: "admin-section-title-action",
      children: action
    }) : null]
  });
}
export function AdminPageHeader({
  title,
  description,
  action
}) {
  return /*#__PURE__*/_jsxs("header", {
    className: "admin-page-header",
    children: [/*#__PURE__*/_jsxs("div", {
      children: [/*#__PURE__*/_jsx("h1", {
        children: title
      }), description ? /*#__PURE__*/_jsx("p", {
        children: description
      }) : null]
    }), action ? /*#__PURE__*/_jsx("div", {
      className: "admin-page-header-action",
      children: action
    }) : null]
  });
}
export function AdminToolbar({
  left,
  right
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-toolbar",
    children: [/*#__PURE__*/_jsx("div", {
      className: "admin-toolbar-left",
      children: left
    }), /*#__PURE__*/_jsx("div", {
      className: "admin-toolbar-right",
      children: right
    })]
  });
}
export function AdminSearchInput({
  value,
  onChange,
  placeholder = "Tìm kiếm..."
}) {
  return /*#__PURE__*/_jsxs("label", {
    className: "admin-search-input",
    children: [/*#__PURE__*/_jsx("span", {
      className: "admin-search-icon",
      children: "\u2315"
    }), /*#__PURE__*/_jsx(UIAdminInput, {
      value: value,
      onChange: event => onChange(event.target.value),
      placeholder: placeholder
    })]
  });
}
export function AdminStatusSelect({
  value,
  onChange,
  options = []
}) {
  return /*#__PURE__*/_jsx("select", {
    className: "admin-status-select",
    value: value,
    onChange: event => onChange(event.target.value),
    children: options.map(item => /*#__PURE__*/_jsx("option", {
      value: item.value,
      children: item.label
    }, item.value))
  });
}
export function AdminStatCard({
  title,
  value,
  subtitle = "",
  icon = "•",
  tone = "default"
}) {
  return /*#__PURE__*/_jsx(UIAdminStatCard, {
    title: title,
    value: value,
    subtitle: subtitle,
    icon: icon,
    tone: tone
  });
}
export function AdminEmptyState({
  message = "Chưa có dữ liệu.",
  action
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-empty-state",
    children: [/*#__PURE__*/_jsx("p", {
      children: message
    }), action ? /*#__PURE__*/_jsx("div", {
      children: action
    }) : null]
  });
}
export function AdminInput({
  value,
  onChange,
  type = "text"
}) {
  return /*#__PURE__*/_jsx(UIAdminInput, {
    type: type,
    value: value,
    onChange: event => onChange(event.target.value)
  });
}
export function AdminSwitch({
  checked,
  onChange
}) {
  return /*#__PURE__*/_jsxs("label", {
    className: "admin-switch",
    children: [/*#__PURE__*/_jsx("input", {
      type: "checkbox",
      checked: checked,
      onChange: event => onChange(event.target.checked)
    }), /*#__PURE__*/_jsx("span", {})]
  });
}
export function AdminStat({
  title,
  value
}) {
  return /*#__PURE__*/_jsx(AdminStatCard, {
    title: title,
    value: value
  });
}
export function AdminPanel({
  title,
  action,
  onAction,
  children
}) {
  return /*#__PURE__*/_jsx(UIAdminPanel, {
    title: title,
    action: action ? /*#__PURE__*/_jsx(UIAdminButton, {
      onClick: onAction,
      children: action
    }) : null,
    children: children ? /*#__PURE__*/_jsx("div", {
      className: "admin-ui-panel-body",
      children: children
    }) : null
  });
}
export function AdminPlaceholder({
  text = "Đang phát triển"
}) {
  return /*#__PURE__*/_jsx(UIAdminPanel, {
    children: /*#__PURE__*/_jsx("div", {
      className: "admin-ui-panel-body",
      children: /*#__PURE__*/_jsx("p", {
        className: "text-sm font-bold text-brown/60",
        children: text
      })
    })
  });
}
export function AdminEditableCard({
  item,
  fields,
  onChange,
  onDelete
}) {
  return /*#__PURE__*/_jsxs("div", {
    className: "admin-edit-card",
    children: [/*#__PURE__*/_jsx("div", {
      className: "admin-edit-fields",
      children: fields.map(field => /*#__PURE__*/_jsx(AdminInput, {
        type: typeof item[field] === "number" ? "number" : "text",
        value: item[field] ?? "",
        onChange: value => onChange({
          [field]: typeof item[field] === "number" ? Number(value) : value
        })
      }, field))
    }), /*#__PURE__*/_jsx(AdminSwitch, {
      checked: item.active ?? item.open ?? true,
      onChange: checked => onChange({
        active: checked,
        open: checked
      })
    }), /*#__PURE__*/_jsx(UIAdminButton, {
      variant: "danger",
      onClick: onDelete,
      children: "X\xF3a"
    })]
  });
}