import { CustomerButton } from "../../../components/customer/CustomerUI.jsx";
import Icon from "../../../components/Icon.jsx";
import { getLoyaltyTierIconSymbol } from "../../../services/loyaltyProgramConfigService.js";

export default function LoyaltySummary({
  title,
  pointsValue,
  subtitle,
  ratioText,
  tierName,
  tierIconKey,
  tierMessage,
  tierRateText,
  expiryText,
  progressPercent = 0,
  progressMessage = "",
  onOpenTierDetails,
  actionLabel,
  onAction,
  ctaLabel,
  onCta
}) {
  if (tierName) {
    const safeProgress = Math.min(100, Math.max(0, Number(progressPercent || 0)));
    return (
      <section className="loyalty-overview" aria-labelledby="loyalty-overview-title">
        <div className="loyalty-overview__head">
          <div className="loyalty-overview__tier">
            <span className="loyalty-overview__tier-icon" aria-hidden="true">
              {getLoyaltyTierIconSymbol(tierIconKey)}
            </span>
            <div>
              <p>{title}</p>
              <h1 id="loyalty-overview-title">{tierName}</h1>
            </div>
          </div>
          {onOpenTierDetails ? (
            <button type="button" className="loyalty-overview__details" onClick={onOpenTierDetails}>
              Lộ trình <Icon name="back" size={15} />
            </button>
          ) : null}
        </div>

        <p className="loyalty-overview__food-note">
          <Icon name="dish" size={16} /> {tierMessage}
        </p>

        <div className="loyalty-overview__points">
          <strong>{pointsValue}</strong>
          <span>{subtitle}</span>
        </div>

        <div className="loyalty-overview__progress-copy">
          <span>{progressMessage}</span>
          <strong>{Math.round(safeProgress)}%</strong>
        </div>
        <div
          className="loyalty-overview__progress"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(safeProgress)}
        >
          <span style={{ width: `${safeProgress}%` }} />
        </div>

        <div className="loyalty-overview__meta">
          <span><b>{tierRateText}</b></span>
          <span><b>{expiryText}</b></span>
        </div>
      </section>
    );
  }

  return (
    <div className="reward-hero">
      <div className="flex items-center justify-between gap-3">
        <div>
          {tierName ? <p className="reward-hero__eyebrow">{title}</p> : null}
          <h1>{tierName || title}</h1>
        </div>
        {actionLabel && onAction ? (
          <CustomerButton variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </CustomerButton>
        ) : null}
      </div>
      <strong>{pointsValue}</strong>
      <p>{subtitle}</p>
      <div className="reward-hero__meta">
        {tierRateText ? <span><b>{tierRateText}</b><small>theo hạng hiện tại</small></span> : null}
        {expiryText ? <span><b>{expiryText}</b><small>{ratioText}</small></span> : <span>{ratioText}</span>}
      </div>
      {ctaLabel && onCta ? (
        <CustomerButton full variant="secondary" className="mt-5" onClick={onCta}>
          {ctaLabel}
        </CustomerButton>
      ) : null}
    </div>
  );
}
