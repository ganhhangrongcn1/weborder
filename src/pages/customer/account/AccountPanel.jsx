import { CustomerButton, CustomerCard } from "../../../components/customer/CustomerUI.jsx";

export default function AccountPanel({
  title,
  action,
  onAction,
  children
}) {
  return (
    <CustomerCard>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-brown">{title}</h2>
        {action && (
          <CustomerButton variant="soft" size="sm" onClick={onAction}>
            {action}
          </CustomerButton>
        )}
      </div>
      {children}
    </CustomerCard>
  );
}
