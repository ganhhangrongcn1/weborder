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
  metaSecondaryNote = "",
  onOpenTierDetails,
  actionLabel,
  onAction,
  ctaLabel,
  onCta,
  isGuest = false
}) {
  const safeProgress = Math.min(100, Math.max(0, Number(progressPercent || 0)));
  const primaryAction = onOpenTierDetails
    ? {
        label: "Lộ trình",
        onClick: onOpenTierDetails
      }
    : actionLabel && onAction
      ? {
          label: actionLabel,
          onClick: onAction
        }
      : null;

  return (
    <section className={`loyalty-summary${isGuest ? " is-guest" : ""}`}>
      <div className="loyalty-summary__head">
        <div className="loyalty-summary__identity">
          <span className="loyalty-summary__tier-icon" aria-hidden="true">
            {tierIconKey ? getLoyaltyTierIconSymbol(tierIconKey) : "🔥"}
          </span>
          <div className="min-w-0">
            <p className="loyalty-summary__eyebrow">{title}</p>
            <h1>{tierName || title}</h1>
          </div>
        </div>
        {primaryAction ? (
          <button type="button" className="loyalty-summary__route" onClick={primaryAction.onClick}>
            {primaryAction.label}
            <Icon name="back" size={15} />
          </button>
        ) : null}
      </div>

      {tierMessage ? (
        <p className="loyalty-summary__message">
          <Icon name="dish" size={14} />
          <span>{tierMessage}</span>
        </p>
      ) : null}

      <div className="loyalty-summary__points">
        <strong>{pointsValue}</strong>
        <span>{subtitle}</span>
      </div>

      {progressMessage ? (
        <div className="loyalty-summary__journey">
          <div className="loyalty-summary__journey-copy">
            <span>{progressMessage}</span>
            <b>{Math.round(safeProgress)}%</b>
          </div>
          <div
            className="loyalty-summary__progress"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={Math.round(safeProgress)}
          >
            <span style={{ width: `${safeProgress}%` }} />
          </div>
        </div>
      ) : null}

      {(tierRateText || expiryText || ratioText) ? (
        <div className="loyalty-summary__meta">
          {tierRateText ? (
            <div>
              <b>{tierRateText}</b>
              <small>{ratioText}</small>
            </div>
          ) : (
            <div>
              <b>{ratioText}</b>
            </div>
          )}
          {expiryText ? (
            <div>
              <b>{expiryText}</b>
              <small>{metaSecondaryNote}</small>
            </div>
          ) : null}
        </div>
      ) : null}

      {ctaLabel && onCta ? (
        <CustomerButton full className="loyalty-summary__cta" onClick={onCta}>
          {ctaLabel}
        </CustomerButton>
      ) : null}
    </section>
  );
}
