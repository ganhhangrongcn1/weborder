import assert from "node:assert/strict";
import test from "node:test";
import { calculateLoyaltyEarnAmount } from "../src/services/loyaltyEarnAmountService.js";
import { calculateCheckoutPricing } from "../src/features/checkout/checkoutPricing.js";
import { buildCreateOrderPayload } from "../src/services/checkoutOrderService.js";

const price = (overrides = {}) => calculateCheckoutPricing({
  fulfillmentType: "pickup", baseShippingByConfig: 0, smartPromotions: [],
  subtotal: 40000, shippingConfig: {}, selectedPromo: null,
  availablePoints: 9000, usePoints: true,
  loyaltyRule: { maxRedemptionPercent: 30, currencyPerPoint: 100, pointPerUnit: 10 },
  ...overrides
});

test("reported 40k order spends 9k, pays 31k and earns 3100", () => {
  const result = price();
  assert.equal(result.pointsDiscount, 9000);
  assert.equal(result.checkoutTotal, 31000);
  assert.equal(result.earnedPreviewPoints, 3100);
});

test("voucher and points both reduce accrual without lowering redemption caps", () => {
  const result = price({ subtotal: 70000, selectedPromo: { discount: 21000 }, availablePoints: 100000 });
  assert.equal(result.pointsDiscount, 7000);
  assert.equal(result.checkoutTotal, 42000);
  assert.equal(result.earnedPreviewPoints, 4200);
  assert.equal(price({ usePoints: false }).earnedPreviewPoints, 4000);
});

test("shipping and shipping support do not earn points", () => {
  const delivery = price({ fulfillmentType: "delivery", baseShippingByConfig: 15000 });
  assert.equal(delivery.checkoutTotal, 46000);
  assert.equal(delivery.earnedPreviewPoints, 3100);
});

test("zero, rounding and extra reductions are capped by actual payment", () => {
  for (const [totalAmount, expected] of [[0, 0], [30000, 30000], [31000, 31000], [50000, 31000]]) {
    assert.equal(calculateLoyaltyEarnAmount({ subtotal: 40000, pointsDiscount: 9000, totalAmount }), expected);
  }
  assert.equal(calculateLoyaltyEarnAmount({ subtotal: 40000, promoDiscount: 40000, totalAmount: 0 }), 0);
  assert.equal(calculateLoyaltyEarnAmount({ subtotal: 40000, promoDiscount: 50000 }), 0);
});

test("checkout persists exactly the net amount shown in the preview", () => {
  const result = price();
  const payload = buildCreateOrderPayload({
    ...result, subtotal: 40000, deliveryInfo: {}, fulfillmentType: "pickup"
  });
  assert.equal(payload.pointsBaseAmount, 31000);
  assert.equal(payload.totalAmount, 31000);
  assert.equal(payload.pointsSpent, 9000);
});
