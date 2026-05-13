export default function AdminTabs({
  tabs = [],
  value,
  onChange,
  className = ""
}) {
  return (
    <div className={`admin-ui-tabs ${className}`.trim()}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            className={active ? "active" : ""}
            onClick={() => onChange?.(tab.value)}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined ? <em>{tab.count}</em> : null}
          </button>
        );
      })}
    </div>
  );
}
