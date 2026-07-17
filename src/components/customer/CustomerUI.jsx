import Icon from "../Icon.jsx";

function joinClassNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function CustomerCard({
  as: Component = "div",
  tone = "default",
  padding = "md",
  interactive = false,
  className = "",
  children,
  ...props
}) {
  return (
    <Component
      className={joinClassNames(
        "customer-card",
        `customer-card--${tone}`,
        `customer-card--pad-${padding}`,
        interactive ? "customer-card--interactive" : "",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CustomerButton({
  as: Component = "button",
  variant = "primary",
  size = "md",
  full = false,
  icon,
  className = "",
  children,
  type,
  ...props
}) {
  const buttonType = Component === "button" ? type || "button" : undefined;

  return (
    <Component
      type={buttonType}
      className={joinClassNames(
        "customer-button",
        `customer-button--${variant}`,
        `customer-button--${size}`,
        full ? "customer-button--full" : "",
        className
      )}
      {...props}
    >
      {icon ? <Icon name={icon} size={size === "sm" ? 15 : 17} /> : null}
      <span>{children}</span>
    </Component>
  );
}

export function CustomerSectionTitle({
  eyebrow,
  title,
  description,
  action,
  className = ""
}) {
  return (
    <div className={joinClassNames("customer-section-title", className)}>
      <div className="customer-section-title__text">
        {eyebrow ? <p>{eyebrow}</p> : null}
        {title ? <h2>{title}</h2> : null}
        {description ? <span>{description}</span> : null}
      </div>
      {action ? <div className="customer-section-title__action">{action}</div> : null}
    </div>
  );
}

export function CustomerEmptyState({
  icon = "bag",
  title,
  message,
  actionText,
  onAction,
  className = ""
}) {
  return (
    <CustomerCard className={joinClassNames("customer-empty-state", className)} padding="lg">
      {icon ? (
        <span className="customer-empty-state__icon">
          <Icon name={icon} size={24} />
        </span>
      ) : null}
      {title ? <h2>{title}</h2> : null}
      {message ? <p>{message}</p> : null}
      {actionText && onAction ? (
        <CustomerButton full onClick={onAction}>
          {actionText}
        </CustomerButton>
      ) : null}
    </CustomerCard>
  );
}

export function CustomerLoadingState({
  title = "Đang tải dữ liệu",
  message = "Vui lòng chờ trong giây lát...",
  className = ""
}) {
  return (
    <CustomerCard className={joinClassNames("customer-loading-state", className)} padding="lg">
      <span className="customer-loading-state__icon">
        <Icon name="star" size={20} />
      </span>
      <h2>{title}</h2>
      {message ? <p>{message}</p> : null}
    </CustomerCard>
  );
}

export function CustomerModalFrame({
  children,
  className = "",
  ariaLabel = "Hộp thoại",
  onBackdropClick
}) {
  return (
    <div className="customer-modal-frame" onClick={onBackdropClick}>
      <CustomerCard
        as="section"
        className={joinClassNames("customer-modal-frame__panel", className)}
        padding="lg"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </CustomerCard>
    </div>
  );
}

export default {
  CustomerButton,
  CustomerCard,
  CustomerEmptyState,
  CustomerLoadingState,
  CustomerModalFrame,
  CustomerSectionTitle
};
