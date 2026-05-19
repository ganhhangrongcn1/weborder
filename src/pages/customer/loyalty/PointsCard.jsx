import Icon from "../../../components/Icon.jsx";
import { CustomerCard } from "../../../components/customer/CustomerUI.jsx";

export default function PointsCard({
  title = "Quy định điểm thưởng",
  rows = []
}) {
  return (
    <CustomerCard className="checkin-card">
      <div className="flex items-center gap-2">
        <span className="reward-icon green">
          <Icon name="star" size={17} />
        </span>
        <h2>{title}</h2>
      </div>
      <div className="reward-rules">
        {rows.map((row, index) => (
          <div key={`${row.label}-${index}`}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </CustomerCard>
  );
}
