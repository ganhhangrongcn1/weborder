import { CustomerButton } from "../../../components/customer/CustomerUI.jsx";

export default function LoyaltySummary({
  title,
  pointsValue,
  subtitle,
  ratioText,
  actionLabel,
  onAction,
  ctaLabel,
  onCta
}) {
  return (
    <div className="reward-hero">
      <div className="flex items-center justify-between gap-3">
        <h1>{title}</h1>
        {actionLabel && onAction ? (
          <CustomerButton variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </CustomerButton>
        ) : null}
      </div>
      <strong>{pointsValue}</strong>
      <p>{subtitle}</p>
      <span>{ratioText}</span>
      {ctaLabel && onCta ? (
        <CustomerButton full variant="secondary" className="mt-5" onClick={onCta}>
          {ctaLabel}
        </CustomerButton>
      ) : null}
    </div>
  );
}
