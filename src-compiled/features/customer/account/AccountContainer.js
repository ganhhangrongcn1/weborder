import { jsx as _jsx } from "react/jsx-runtime";
export default function AccountContainer({
  accountRender: AccountRender,
  ...props
}) {
  if (!AccountRender) return null;
  return /*#__PURE__*/_jsx(AccountRender, {
    ...props
  });
}