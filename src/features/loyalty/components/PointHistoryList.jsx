import AppEmptyState from "../../../components/app/EmptyState.jsx";
import { CustomerCard } from "../../../components/customer/CustomerUI.jsx";
import { getLoyaltyText } from "../../../services/loyaltyConfigService.js";
import { formatSignedLoyaltyPoints } from "../../../services/loyaltyLedgerUtils.js";
import { getOrderSourceBadge } from "../../../services/partnerOrderService.js";

export function getPointEntryTitle(entry = {}) {
  const type = String(entry.type || "").toUpperCase();

  if (type === "PARTNER_ORDER_EARN") {
    const source = entry.source || entry.metadata?.partnerSource || "";
    const sourceBadge = getOrderSourceBadge(source);
    const orderCode =
      entry.displayOrderCode ||
      entry.metadata?.displayOrderCode ||
      entry.metadata?.partnerDisplayOrderCode ||
      entry.partnerOrderCode ||
      entry.metadata?.partnerOrderCode ||
      entry.orderId ||
      "";

    return orderCode
      ? `Cộng điểm từ đơn ${sourceBadge.label} ${orderCode}`
      : "Cộng điểm từ đơn đối tác";
  }

  return entry.title || "Lịch sử điểm";
}

export default function PointHistoryList({ entries, limit = 5 }) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const visibleEntries = safeEntries.slice(0, limit);
  const loyaltyText = getLoyaltyText();

  return (
    <div className="space-y-2">
      {visibleEntries.map((entry) => (
        <CustomerCard key={entry.id} padding="sm" className="text-sm">
          <span className="block text-brown">{getPointEntryTitle(entry)}</span>
          <strong className="text-orange-600">{formatSignedLoyaltyPoints(entry.points)} điểm</strong>
        </CustomerCard>
      ))}
      {!safeEntries.length ? <AppEmptyState icon={null} message={loyaltyText.noPointHistory} /> : null}
    </div>
  );
}
