export default function CheckoutContainer({ checkoutRender: CheckoutRender, ...props }) {
  if (!CheckoutRender) return null;
  return <CheckoutRender {...props} />;
}

