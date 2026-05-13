export default function AdminStatCard({
  title,
  value,
  subtitle = "",
  icon = "•",
  tone = "brand",
  className = ""
}) {
  return (
    <article className={`admin-ui-stat-card admin-ui-stat-card--${tone} ${className}`.trim()}>
      <span className="admin-ui-stat-icon">{icon}</span>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
    </article>
  );
}
