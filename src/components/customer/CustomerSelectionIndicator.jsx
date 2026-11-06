export default function CustomerSelectionIndicator({ selected = false, className = "" }) {
  return <span className={`customer-selection-indicator${selected ? " is-selected" : ""} ${className}`.trim()} aria-hidden="true">
    <span className="customer-selection-indicator__dot" />
  </span>;
}
