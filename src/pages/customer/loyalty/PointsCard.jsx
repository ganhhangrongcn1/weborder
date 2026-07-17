import Icon from "../../../components/Icon.jsx";
import { CustomerCard } from "../../../components/customer/CustomerUI.jsx";

export default function PointsCard({
  title = "Quy tắc sử dụng điểm",
  rows = [],
  example = "",
  showTitle = true
}) {
  return (
    <CustomerCard className="checkin-card">
      {showTitle ? (
        <div className="flex items-center gap-2">
          <span className="reward-icon green">
            <Icon name="star" size={17} />
          </span>
          <h2>{title}</h2>
        </div>
      ) : null}
      <div className="reward-rules">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
      {example ? (
        <p className="reward-rules-example">
          <Icon name="tag" size={15} />
          <span>{example}</span>
        </p>
      ) : null}
    </CustomerCard>
  );
}
