const SKELETON_ROWS = ["first", "second", "third"];

export default function MenuLoadingState() {
  return (
    <div className="menu-loading-state" role="status" aria-live="polite" aria-label="Đang tải menu">
      <span className="sr-only">Đang tải menu…</span>
      {SKELETON_ROWS.map((row) => (
        <div className="menu-loading-row" key={row} aria-hidden="true">
          <span className="menu-loading-row__image" />
          <span className="menu-loading-row__copy">
            <i />
            <i />
            <i />
          </span>
          <span className="menu-loading-row__action" />
        </div>
      ))}
    </div>
  );
}
