import Icon from "../../../components/Icon.jsx";

export default function CheckoutDisclosure({ title, summary, children, className = "", disabled = false }) {
  if (disabled) return children;
  return (
    <details className={`checkout-disclosure ${className}`}>
      <summary><span>{title}</span><strong>{summary}</strong><Icon name="back" size={15} /></summary>
      <div className="checkout-disclosure__content">{children}</div>
    </details>
  );
}
