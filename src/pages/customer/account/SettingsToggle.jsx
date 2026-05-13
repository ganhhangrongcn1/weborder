export default function SettingsToggle({
  label,
  checked = false
}) {
  return (
    <label className="flex items-center justify-between rounded-[20px] bg-cream/50 px-4 py-3">
      <span className="text-sm font-bold text-brown/75">{label}</span>
      <input type="checkbox" defaultChecked={checked} className="toggle-input" />
    </label>
  );
}
