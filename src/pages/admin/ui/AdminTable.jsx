export function AdminTable({
  children,
  className = ""
}) {
  return <div className={`admin-ui-table ${className}`.trim()}>{children}</div>;
}

export function AdminTableHead({
  children,
  className = ""
}) {
  return <div className={`admin-ui-table-head ${className}`.trim()}>{children}</div>;
}

export function AdminTableBody({
  children,
  className = ""
}) {
  return <div className={`admin-ui-table-body ${className}`.trim()}>{children}</div>;
}

export function AdminTableRow({
  children,
  selected = false,
  className = "",
  as: Component = "div",
  ...props
}) {
  return (
    <Component className={`admin-ui-table-row ${selected ? "is-selected" : ""} ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}
