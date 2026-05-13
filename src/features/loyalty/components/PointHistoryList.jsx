import AppEmptyState from "../../../components/app/EmptyState.jsx";
import { getLoyaltyText } from "../../../services/loyaltyConfigService.js";

export default function PointHistoryList({ entries, limit = 5 }) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const visibleEntries = safeEntries.slice(0, limit);
  const loyaltyText = getLoyaltyText();

  return (
    <div className="space-y-2">
      {visibleEntries.map((entry) => (
        <div key={entry.id} className="rounded-2xl bg-white px-4 py-3 text-sm shadow-soft">
          <span className="block text-brown">{entry.title}</span>
          <strong className="text-orange-600">+{entry.points} điểm</strong>
        </div>
      ))}
      {!safeEntries.length && <AppEmptyState icon={null} message={loyaltyText.noPointHistory} />}
    </div>
  );
}
