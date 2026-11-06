import { forwardRef } from "react";

function resolveAppearance(className, role) {
  if (/(?:^|\s)(?:product-add-btn|qty-btn|addon-plus)(?:\s|$)/.test(className)) return "quantity";
  if (/(?:^|\s)(?:cta|cta-small|bg-gradient-main|customer-primary-action|customer-button--primary|review-reward-submit|review-reward-login|order-journey-sheet__primary|stamp-rewards-sheet__login|account-auth-submit|home-review-reward__cta)(?:\s|$)/.test(className)) return "primary";
  if (/(?:^|\s)(?:secondary-cta|customer-button--secondary|customer-button--soft|order-journey-sheet__secondary)(?:\s|$)/.test(className)) return "secondary";
  if (/(?:^|\s)(?:customer-sheet-close|customer-icon-button|customer-button--icon|float-btn)(?:\s|$)/.test(className)) return "icon";
  if (/(?:^|\s)(?:customer-button--ghost|customer-button--text)(?:\s|$)/.test(className)) return "text";
  if (role === "tab" || /(?:^|\s)(?:orders-filter-tab|chip)(?:\s|$)/.test(className)) return "tab";
  return "plain";
}

// One native button, no extra wrappers: existing refs, forms and handlers stay intact.
const CustomerControl = forwardRef(function CustomerControl({ appearance, className = "", children, ...props }, ref) {
  return <button
    {...props}
    ref={ref}
    className={`customer-control ${className}`.trim()}
    data-customer-control={appearance || resolveAppearance(className, props.role)}
  >{children}</button>;
});

export default CustomerControl;
