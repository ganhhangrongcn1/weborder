export default function CustomerBadge({ children, compact = false, className = "", ...props }) {
  return <span {...props} className={`customer-badge${compact ? " customer-badge--compact" : ""} ${className}`.trim()}>{children}</span>;
}
