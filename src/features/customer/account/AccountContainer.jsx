export default function AccountContainer({ accountRender: AccountRender, ...props }) {
  if (!AccountRender) return null;
  return <AccountRender {...props} />;
}

