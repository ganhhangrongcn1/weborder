export default function SectionTitle({ title, action, onAction }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-black uppercase tracking-wide text-brown">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-xs font-bold text-orange-600">
          {action}
        </button>
      )}
    </div>
  );
}
