export default function AdminCard({
  children,
  variant = "default",
  className = "",
  as: Component = "section"
}) {
  return (
    <Component className={`admin-ui-card admin-ui-card--${variant} ${className}`.trim()}>
      {children}
    </Component>
  );
}
