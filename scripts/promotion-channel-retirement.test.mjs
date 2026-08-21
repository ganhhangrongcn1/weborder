import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefaultSalesChannels,
  getPromotionSalesChannels,
  isPromotionAllowedForChannel
} from "../src/services/promotionChannelService.js";

test("new flash sales default to Website and POS", () => {
  assert.deepEqual(getDefaultSalesChannels("flash_sale"), ["web", "pos"]);
});

test("legacy Website + QR flash sales move to Website + POS", () => {
  const promotion = { type: "flash_sale", salesChannels: ["web", "qr"] };
  assert.deepEqual(getPromotionSalesChannels(promotion), ["web", "pos"]);
  assert.equal(isPromotionAllowedForChannel(promotion, "web"), true);
  assert.equal(isPromotionAllowedForChannel(promotion, "pos"), true);
  assert.equal(isPromotionAllowedForChannel(promotion, "qr"), false);
});

test("website vouchers do not leak into POS", () => {
  const voucher = { type: "checkout", salesChannels: ["web", "qr"] };
  assert.deepEqual(getPromotionSalesChannels(voucher), ["web"]);
  assert.equal(isPromotionAllowedForChannel(voucher, "pos"), false);
});
