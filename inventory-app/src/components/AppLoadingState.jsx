export default function AppLoadingState() {
  return (
    <div className="app-loading-state" aria-live="polite" aria-label="Đang tải dữ liệu">
      <div className="loading-heading">
        <span className="loading-block loading-title" />
        <span className="loading-block loading-subtitle" />
      </div>
      <div className="loading-metrics">
        {[1, 2, 3, 4].map((item) => <span className="loading-block" key={item} />)}
      </div>
      <div className="loading-surface">
        <span className="loading-block loading-toolbar" />
        {[1, 2, 3, 4, 5].map((item) => <span className="loading-block loading-row" key={item} />)}
      </div>
    </div>
  );
}
