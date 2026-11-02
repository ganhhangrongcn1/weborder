import { buildVoucherSelectionKey } from "../../shared/pos/posLoyalty";

// A durable payment snapshot, not a second copy of the customer's CRM record.
// Keep the selected voucher intact for the existing recovery/benefit rules.
export function compactPosPaymentCustomer(customer, selectedVoucherKey = "") {
  if (!customer || typeof customer !== "object") return null;
  return {
    ok: customer.ok, phone: customer.phone, customerName: customer.customerName,
    registeredCustomer: customer.registeredCustomer,
    customerStatusKey: customer.customerStatusKey, customerStatusLabel: customer.customerStatusLabel,
    loyalty: { phone: customer.loyalty?.phone, totalPoints: customer.loyalty?.totalPoints },
    loyaltyRule: customer.loyaltyRule,
    availableVouchers: (customer.availableVouchers || []).filter(voucher =>
      buildVoucherSelectionKey(voucher) === selectedVoucherKey)
  };
}

export function compactPosQrCheckout(input) {
  const checkout = input.checkout || {};
  const customer = compactPosPaymentCustomer(checkout.customerLookup, checkout.selectedVoucherKey);
  const pending = input.pendingOrder;
  return {
    checkout: { ...checkout, customerLookup: customer },
    pendingOrder: { ...pending, order: { ...pending.order,
      metadata: { ...pending.order.metadata, customerLookup: customer } } }
  };
}
