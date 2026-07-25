import { useId } from "react";

export default function OptionGroup({ title, badge, children }) {
  const headingId = useId();

  return (
    <section className="customer-option-group" aria-labelledby={headingId}>
      <div className="customer-option-group__head">
        <h3 id={headingId} className="label">{title}</h3>
        {badge ? <span className="customer-option-group__badge">{badge}</span> : null}
      </div>
      <div className="customer-option-group__content">{children}</div>
    </section>
  );
}
