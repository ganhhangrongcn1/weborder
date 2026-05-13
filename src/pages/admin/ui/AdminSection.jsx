export default function AdminSection({
  eyebrow,
  title,
  description,
  action,
  children,
  className = ""
}) {
  return (
    <section className={`admin-ui-section ${className}`.trim()}>
      {(eyebrow || title || description || action) ? (
        <header className="admin-ui-section-head">
          <div>
            {eyebrow ? <p>{eyebrow}</p> : null}
            {title ? <h1>{title}</h1> : null}
            {description ? <span>{description}</span> : null}
          </div>
          {action ? <div className="admin-ui-section-action">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
