import Icon from "../../../components/Icon.jsx";

export default function InfoLine({
  icon,
  label,
  value
}) {
  return (
    <div className="info-line">
      <Icon name={icon} size={16} />
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  );
}
