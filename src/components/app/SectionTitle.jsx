import { CustomerButton, CustomerSectionTitle } from "../customer/CustomerUI.jsx";

export default function SectionTitle({ title, action, onAction }) {
  return (
    <CustomerSectionTitle
      title={title}
      action={
        action ? (
          <CustomerButton variant="ghost" size="sm" onClick={onAction}>
            {action}
          </CustomerButton>
        ) : null
      }
    />
  );
}
