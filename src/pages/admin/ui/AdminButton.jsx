export default function AdminButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`admin-ui-button admin-ui-button--${variant} admin-ui-button--${size} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
