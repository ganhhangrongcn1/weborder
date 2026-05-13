export default function LoadingState({ label = "Đang tải...", className = "rounded-2xl bg-white px-4 py-3 text-sm text-brown/55 shadow-soft" }) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-orange-500" />
        <span>{label}</span>
      </div>
    </div>
  );
}
