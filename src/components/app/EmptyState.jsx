import { CustomerButton, CustomerCard } from "../customer/CustomerUI.jsx";
import Icon from "../Icon.jsx";

export default function EmptyState({
  icon = "bag",
  title,
  message,
  actionText,
  onAction,
  className = "",
  center = false
}) {
  return (
    <CustomerCard className={`customer-empty-state ${className}`.trim()} padding="lg">
      {icon && (
        <span className={`customer-empty-state__icon ${center ? "mx-auto" : ""}`.trim()}>
          <Icon name={icon} size={24} />
        </span>
      )}
      {title && <h2 className={center ? "text-center" : ""}>{title}</h2>}
      {message && <p className={center ? "text-center" : ""}>{message}</p>}
      {actionText && onAction && (
        <CustomerButton full={center} onClick={onAction}>
          {actionText}
        </CustomerButton>
      )}
    </CustomerCard>
  );
}
