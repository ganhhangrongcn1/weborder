export default function PromotionFormSection({
  step,
  title,
  note = "",
  children,
  className = ""
}) {
  return (
    <div className={["admin-promo-form-card", className].filter(Boolean).join(" ")}>
      <div className="admin-promo-section-head">
        {step ? <span>{step}</span> : null}
        <div>
          <h4>{title}</h4>
          {note ? <p>{note}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}
