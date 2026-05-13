import Icon from "../Icon.jsx";

export default function EmptyState({
  icon = "bag",
  title,
  message,
  actionText,
  onAction,
  className = "rounded-2xl bg-white px-4 py-3 text-sm text-brown/55 shadow-soft",
  center = false
}) {
  return (
    <div className={className}>
      {icon && (
        <span className={`grid h-14 w-14 place-items-center rounded-3xl bg-orange-50 text-orange-600 ${center ? "mx-auto" : ""}`}>
          <Icon name={icon} size={24} />
        </span>
      )}
      {title && <h2 className={`${icon ? "mt-4" : ""} text-lg font-black text-brown ${center ? "text-center" : ""}`}>{title}</h2>}
      {message && <p className={`${title ? "mt-2" : icon ? "mt-3" : ""} text-sm text-brown/60 ${center ? "text-center" : ""}`}>{message}</p>}
      {actionText && onAction && (
        <button onClick={onAction} className={`mt-5 rounded-2xl bg-gradient-main py-3 text-sm font-black text-white shadow-orange ${center ? "w-full" : ""}`}>
          {actionText}
        </button>
      )}
    </div>
  );
}
