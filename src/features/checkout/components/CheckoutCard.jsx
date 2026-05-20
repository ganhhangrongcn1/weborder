import { CustomerButton, CustomerCard } from "../../../components/customer/CustomerUI.jsx";

export default function CheckoutCard({
  title,
  action,
  onAction,
  className = "",
  children
}) {
  return (
    <CustomerCard as="section" className={`checkout-card ${className}`.trim()}>
      <div className="checkout-card-head">
        <h2>{title}</h2>
        {action ? (
          <CustomerButton variant="ghost" size="sm" onClick={onAction}>
            {action}
          </CustomerButton>
        ) : null}
      </div>
      {children}
    </CustomerCard>
  );
}
