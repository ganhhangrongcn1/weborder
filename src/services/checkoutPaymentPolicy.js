export function normalizeCheckoutPaymentMethod(method, total) {
  return Number(total) === 0 ? "counter" : String(method || "").trim().toLowerCase();
}

export function resolveCheckoutPaymentMethod({ total, fulfillmentType, paymentMethod, webMomoEnabled, webBankQrEnabled, webCounterPaymentEnabled }) {
  if (Number(total) === 0) return "counter";
  if (fulfillmentType !== "pickup") return "COD";
  const enabled = { momo: webMomoEnabled, bank_qr: webBankQrEnabled, counter: webCounterPaymentEnabled };
  if (enabled[paymentMethod]) return paymentMethod;
  return Object.keys(enabled).find((method) => enabled[method]) || "";
}

export default resolveCheckoutPaymentMethod;
