import assert from "node:assert/strict";
import test from "node:test";
import { calculateCheckoutPricing } from "../src/features/checkout/checkoutPricing.js";
import { getCheckoutPointsErrorMessage } from "../src/services/checkoutOrderService.js";

const price = (overrides = {}) => calculateCheckoutPricing({
  fulfillmentType: "pickup", baseShippingByConfig: 0, smartPromotions: [],
  subtotal: 70000, shippingConfig: {}, selectedPromo: { discount: 21000 },
  availablePoints: 100000, usePoints: true,
  loyaltyRule: { maxRedemptionPercent: 30, redeemPointUnit: 1, redeemValue: 1 },
  ...overrides
});

test("reported 70k order uses at most 7k points and pays 42k", () => {
  const result = price();
  assert.equal(result.pointsSpent, 7000);
  assert.equal(result.pointsDiscount, 7000);
  assert.equal(result.checkoutTotal, 42000);
});

test("point balance and existing redemption rate may lower the cap", () => {
  assert.equal(price({ availablePoints: 3000 }).pointsDiscount, 3000);
  assert.equal(price({ selectedPromo: null }).pointsDiscount, 21000);
  assert.equal(price({ usePoints: false }).checkoutTotal, 49000);
});

test("voucher exhausting allowance permits no further points; shipping is excluded", () => {
  assert.equal(price({ selectedPromo: { discount: 28000 } }).pointsDiscount, 0);
  assert.equal(price({ selectedPromo: { discount: 35000 } }).pointsDiscount, 0);
  const delivery = price({ fulfillmentType: "delivery", baseShippingByConfig: 15000 });
  assert.equal(delivery.pointsDiscount, 7000);
  assert.equal(delivery.checkoutTotal, 57000);
});

test("cap rejection explains recovery without exposing a percentage", () => {
  for (const error of [{ code: "P4001" }, { message: "LOYALTY_COMBINED_BENEFIT_LIMIT" }]) {
    const message = getCheckoutPointsErrorMessage(error);
    assert.ok(message.includes("Giỏ hàng vẫn được giữ nguyên"));
    assert.ok(!message.includes("%"));
  }
  assert.equal(getCheckoutPointsErrorMessage({ code: "P0001", message: "Network failure" }), "");
});
