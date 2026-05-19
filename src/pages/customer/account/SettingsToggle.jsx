import { CustomerCard } from "../../../components/customer/CustomerUI.jsx";

export default function SettingsToggle({
  label,
  checked = false
}) {
  return (
    <CustomerCard as="label" tone="soft" padding="sm" className="flex items-center justify-between">
      <span className="text-sm font-bold text-brown/75">{label}</span>
      <input type="checkbox" defaultChecked={checked} className="toggle-input" />
    </CustomerCard>
  );
}
