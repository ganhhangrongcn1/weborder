import { jsx as _jsx } from "react/jsx-runtime";
export default function CheckoutContainer({
  checkoutRender: CheckoutRender,
  ...props
}) {
  if (!CheckoutRender) return null;
  return /*#__PURE__*/_jsx(CheckoutRender, {
    ...props
  });
}