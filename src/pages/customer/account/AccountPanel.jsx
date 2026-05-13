export default function AccountPanel({
  title,
  action,
  onAction,
  children
}) {
  return (
    <div className="rounded-[28px] bg-white p-4 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-brown">{title}</h2>
        {action && (
          <button onClick={onAction} className="rounded-2xl bg-orange-50 px-3 py-2 text-xs font-black text-orange-600">
            {action}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
