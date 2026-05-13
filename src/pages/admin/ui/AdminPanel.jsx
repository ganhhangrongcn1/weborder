export default function AdminPanel({
  title,
  description,
  action,
  children,
  className = ""
}) {
  return (
    <section className={`admin-ui-panel ${className}`.trim()}>
      {(title || description || action) ? (
        <div className="admin-ui-panel-head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action ? <div className="admin-ui-panel-action">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
