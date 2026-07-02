import {
  PROMOTION_SALES_CHANNELS,
  getPromotionSalesChannels,
  toggleSalesChannel
} from "../../../services/promotionChannelService.js";

export default function PromotionSalesChannelField({ value = [], onChange }) {
  const selectedChannels = getPromotionSalesChannels({ salesChannels: value });

  return (
    <div className="admin-promo-channel-options">
      {PROMOTION_SALES_CHANNELS.map((channel) => {
        const checked = selectedChannels.includes(channel.value);
        return (
          <label
            key={channel.value}
            className={`admin-promo-channel-option ${checked ? "is-active" : ""}`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange?.(toggleSalesChannel(selectedChannels, channel.value))}
            />
            <span>{channel.label}</span>
          </label>
        );
      })}
    </div>
  );
}
