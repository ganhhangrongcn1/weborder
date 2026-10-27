import assert from "node:assert/strict";
import { normalizeCheckoutPaymentMethod, resolveCheckoutPaymentMethod } from "../src/services/checkoutPaymentPolicy.js";
import { buildCreateOrderPayload } from "../src/services/checkoutOrderService.js";
import fs from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as jsxRuntime from "react/jsx-runtime";

const options = { total: 0, fulfillmentType: "pickup", paymentMethod: "momo", webMomoEnabled: false, webBankQrEnabled: false, webCounterPaymentEnabled: true };
assert.equal(resolveCheckoutPaymentMethod(options), "counter", "a stale MoMo selection cannot override a zero total");
assert.equal(resolveCheckoutPaymentMethod({ ...options, paymentMethod: "bank_qr" }), "counter");
assert.equal(resolveCheckoutPaymentMethod({ ...options, webCounterPaymentEnabled: false }), "counter", "zero orders do not depend on paid counter settings");
assert.equal(normalizeCheckoutPaymentMethod("momo", "0"), "counter");
assert.equal(normalizeCheckoutPaymentMethod("bank_qr", 0), "counter");
const paid = { ...options, total: 30000, webMomoEnabled: true, webBankQrEnabled: true };
assert.equal(resolveCheckoutPaymentMethod(paid), "momo", "adding a paid item restores MoMo availability");
assert.equal(resolveCheckoutPaymentMethod({ ...paid, paymentMethod: "bank_qr" }), "bank_qr");
assert.equal(resolveCheckoutPaymentMethod({ ...paid, paymentMethod: "counter" }), "counter");
assert.equal(resolveCheckoutPaymentMethod({ ...paid, fulfillmentType: "delivery" }), "COD");
assert.equal(normalizeCheckoutPaymentMethod("momo", 30000), "momo");
for (const method of ["momo", "bank_qr", "counter"]) {
  const payload = buildCreateOrderPayload({ checkoutTotal: 0, subtotal: 0, fulfillmentType: "pickup", paymentMethod: method, deliveryInfo: { name: "Test", phone: "0901234567" } });
  assert.equal(payload.paymentMethod, "counter", "the submitted payload must agree with the displayed zero-total method");
  assert.equal(payload.totalAmount, 0);
}
const source = fs.readFileSync(new URL("../src/features/checkout/components/CheckoutPricingSection.jsx", import.meta.url), "utf8");
const compiled = transformSync(source, { loader: "jsx", format: "cjs", jsx: "automatic" }).code;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, require(name) {
  if (name === "react/jsx-runtime") return jsxRuntime;
  if (name.endsWith("/format.js")) return { formatMoney: (value) => `${value}đ` };
  if (name === "./CheckoutCard.jsx") return { __esModule: true, default: ({ children }) => React.createElement("section", null, children) };
  if (name.endsWith(".jsx")) return { __esModule: true, default: () => null };
  throw new Error(`Unexpected import: ${name}`);
} });
const props = { cart: [{ stampGift: true, quantity: 1 }], fulfillmentType: "pickup", shippingConfig: {}, checkoutTotal: 0, paymentMethod: "counter", webMomoEnabled: false, webBankQrEnabled: false, webCounterPaymentEnabled: true };
const html = renderToStaticMarkup(React.createElement(module.exports.default, props));
assert.equal((html.match(/Phương thức thanh toán:/g) || []).length, 1, "gift-only checkout has exactly one payment choice");
assert.match(html, /Đơn 0đ · Không cần thanh toán/);
assert.doesNotMatch(html, /Thanh toán ví MoMo|QR ngân hàng/);
const paidHtml = renderToStaticMarkup(React.createElement(module.exports.default, { ...props, checkoutTotal: 30000, webMomoEnabled: true, webBankQrEnabled: true }));
assert.match(paidHtml, /Thanh toán ví MoMo/);
assert.match(paidHtml, /QR ngân hàng/);
// Execute the real order creation function with isolated adapters; no server writes.
const orderSource = fs.readFileSync(new URL("../src/services/orderService.js", import.meta.url), "utf8");
const createSource = orderSource.slice(orderSource.indexOf("export async function createOrderAsync"), orderSource.indexOf('export { buildReorderItems'));
let proofCalls = 0;
const noop = () => {};
const context = {
  normalizeCheckoutPaymentMethod, console: { warn: noop },
  getCustomerKey: (phone) => phone,
  getCustomerOrderCatalogAsync: async () => [], getUnavailableOrderItems: () => [],
  getOrCreateCheckoutOrderAttempt: () => ({ orderCode: "TEST-ONLY", displayOrderCode: "TEST-ONLY", createdAt: new Date().toISOString() }),
  withCheckoutStepTimeout: (run) => run(), CHECKOUT_PRECHECK_TIMEOUT_MS: 8000, CHECKOUT_PROOF_TIMEOUT_MS: 5000,
  validateCheckoutVoucherBeforeOrder: async () => ({ promoDiscount: 0 }),
  getLoyaltyRuleConfigAsync: async () => ({}),
  createCustomerOrderActionProof: async () => { proofCalls++; return { tokenHash: "test-hash", token: "test" }; },
  calculateOrderPoints: () => 0, resolveBranchIdentifiers: () => ({}),
  orderStorage: { addOrderAsync: async (order) => order },
  saveCustomerOrderActionToken: noop, clearCheckoutOrderAttempt: noop,
  notifyWebOrderWebhook: async () => {}, saveCreatedOrderCustomerMarker: noop,
  finalizeCreatedOrderUi: noop, saveCreatedOrderAddress: noop,
  syncCreatedOrderListAsync: async () => {}, applyCreatedOrderLoyaltyAsync: async () => ({}),
  updateCreatedOrderProfile: noop
};
vm.createContext(context);
vm.runInContext(createSource.replace("export async function", "async function") + "\nthis.createTestOrder = createOrderAsync;", context);
const giftOrder = { cart: [{ id: "gift", stampGift: true, stampPhone: "0901234567", lineTotal: 0 }], totalAmount: 0, subtotal: 0, paymentMethod: "momo", fulfillmentType: "pickup", deliveryInfo: { phone: "0901234567" }, userProfile: {} };
const zeroOrder = await context.createTestOrder(giftOrder);
assert.equal(zeroOrder.paymentMethod, "counter");
assert.equal(zeroOrder.status, "preparing");
assert.equal(zeroOrder.kitchenStatus, "pending");
assert.equal(proofCalls, 0, "zero orders cannot start the prepaid proof/payment flow");
const mixedOrder = await context.createTestOrder({ ...giftOrder, totalAmount: 30000, subtotal: 30000 });
assert.equal(mixedOrder.paymentMethod, "momo");
assert.equal(mixedOrder.status, "pending_payment");
assert.equal(proofCalls, 1, "positive totals retain the prepaid flow");
console.log("Zero-total checkout policy, payload and rendered payment choices passed");
