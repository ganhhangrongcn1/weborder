import Icon from "../Icon.jsx";

export default function CustomerOfferCard({
  eyebrow = "Ưu đãi",
  icon = "gift",
  value,
  title,
  status,
  details = [],
  codeLabel,
  actionLabel,
  actionIcon = "cart",
  onAction,
  inactive = false,
  selected = false,
  disabled = false,
  className = ""
}) {
  const safeDetails = details.filter((item) => item?.text);
  const classes = [
    "customer-offer-card",
    inactive ? "is-inactive" : "",
    selected ? "is-selected" : "",
    className
  ].filter(Boolean).join(" ");

  return (
    <article className={classes}>
      <div className="customer-offer-card__mark" aria-hidden="true">
        <Icon name={icon} size={21} />
        <span>{eyebrow}</span>
      </div>

      <div className="customer-offer-card__body">
        <div className="customer-offer-card__heading">
          <div className="min-w-0">
            <strong className="customer-offer-card__value">{value || "Quà tặng"}</strong>
            <h3>{title}</h3>
          </div>
          {status ? (
            <span className={`customer-offer-card__status${inactive ? " is-muted" : ""}`}>
              {status}
            </span>
          ) : null}
        </div>

        {safeDetails.length ? (
          <div className="customer-offer-card__details">
            {safeDetails.map((item, index) => (
              <span key={`${item.icon || "detail"}-${index}`}>
                <Icon name={item.icon || "tag"} size={14} />
                {item.text}
              </span>
            ))}
          </div>
        ) : null}

        <div className="customer-offer-card__footer">
          <span className="customer-offer-card__code">{codeLabel}</span>
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              disabled={disabled}
            >
              {actionLabel}
              <Icon name={selected ? "check" : actionIcon} size={15} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
