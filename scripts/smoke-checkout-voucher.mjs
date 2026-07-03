import assert from "node:assert/strict";
import { buildCheckoutPromoCodes } from "../src/features/checkout/checkoutPricing.js";

const formatMoney = (value) => `${Number(value || 0)}đ`;
const coupon = {
  id: "coupon-once",
  code: "ONCE10",
  name: "Giảm một lần",
  active: true,
  voucherType: "checkout",
  discountType: "fixed",
  value: 10000,
  maxDiscount: 0,
  minOrder: 50000,
  usageLimit: 0,
  perUserLimit: 1,
  totalUsed: 0,
  startAt: "",
  endAt: ""
};

const available = buildCheckoutPromoCodes(
  [coupon],
  [],
  60000,
  formatMoney,
  [],
  []
);
assert.equal(available.length, 1);
assert.equal(available[0].discount, 10000);

const hiddenAfterUse = buildCheckoutPromoCodes(
  [coupon],
  [],
  60000,
  formatMoney,
  [],
  [{ promoCode: "ONCE10", status: "completed" }]
);
assert.equal(hiddenAfterUse.length, 0);

const restoredAfterCancel = buildCheckoutPromoCodes(
  [coupon],
  [],
  60000,
  formatMoney,
  [],
  [{ promoCode: "ONCE10", status: "cancelled" }]
);
assert.equal(restoredAfterCancel.length, 1);

console.log("Checkout voucher smoke test passed.");
