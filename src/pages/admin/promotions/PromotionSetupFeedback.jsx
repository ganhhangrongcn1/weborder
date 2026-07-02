import {
  PROMOTION_SALES_CHANNELS,
  getPromotionSalesChannels
} from "../../../services/promotionChannelService.js";

const channelLabelByValue = PROMOTION_SALES_CHANNELS.reduce(
  (map, channel) => ({ ...map, [channel.value]: channel.label }),
  {}
);

export function formatSalesChannelSummary(promotion = {}) {
  return getPromotionSalesChannels(promotion)
    .map((channel) => channelLabelByValue[channel] || channel)
    .join(" + ");
}

export function PromotionSummaryPills({ items = [] }) {
  const visibleItems = items.map((item) => String(item || "").trim()).filter(Boolean);
  if (!visibleItems.length) return null;

  return (
    <div className="admin-promo-summary-pills" aria-label="Tóm tắt cấu hình">
      {visibleItems.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export function PromotionSetupWarnings({ warnings = [] }) {
  const visibleWarnings = warnings.map((item) => String(item || "").trim()).filter(Boolean);
  if (!visibleWarnings.length) return null;

  return (
    <div className="admin-promo-warning-box" role="note" aria-label="Cảnh báo cấu hình">
      <strong>Cần kiểm tra</strong>
      <ul>
        {visibleWarnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}
