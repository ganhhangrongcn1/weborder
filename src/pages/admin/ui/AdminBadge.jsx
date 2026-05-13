export default function AdminBadge({
  children,
  tone = "neutral",
  className = ""
}) {
  return (
    <span className={`admin-ui-badge admin-ui-badge--${tone} ${className}`.trim()}>
      {children}
    </span>
  );
}
