import assert from "node:assert/strict";
import test from "node:test";

import { buildHomeVoucherCards } from "../src/services/homeVoucherService.js";

const NOW = new Date("2026-08-21T10:00:00+07:00");

test("website vouchers are ordered by the largest discount instead of loyalty type", () => {
  const cards = buildHomeVoucherCards({
    coupons: [
      {
        id: "loyal-10",
        code: "LOYAL10",
        voucherType: "loyalty",
        discountType: "fixed",
        value: 10000,
        active: true,
        salesChannels: ["web"]
      },
      {
        id: "public-30",
        code: "GIAM30",
        voucherType: "checkout",
        discountType: "fixed",
        value: 30000,
        active: true,
        salesChannels: ["web"]
      }
    ],
    loyalty: {
      voucherHistory: [
        { id: "wallet-loyal-10", couponId: "loyal-10", code: "LOYAL10", value: 10000 }
      ]
    },
    currentPhone: "0909000000",
    isRegisteredCustomer: true,
    now: NOW
  });

  assert.deepEqual(cards.map((card) => card.code), ["GIAM30", "LOYAL10"]);
});

test("percentage vouchers respect their maximum discount when sorting", () => {
  const cards = buildHomeVoucherCards({
    coupons: [
      {
        id: "percent-30",
        code: "GIAM30PT",
        discountType: "percent",
        value: 30,
        maxDiscount: 25000,
        active: true,
        salesChannels: ["web"]
      },
      {
        id: "fixed-20",
        code: "GIAM20K",
        discountType: "fixed",
        value: 20000,
        active: true,
        salesChannels: ["web"]
      }
    ],
    now: NOW
  });

  assert.deepEqual(cards.map((card) => card.code), ["GIAM30PT", "GIAM20K"]);
});

test("POS-only vouchers are excluded from the website banner", () => {
  const cards = buildHomeVoucherCards({
    coupons: [
      {
        id: "pos-only",
        code: "POSONLY",
        discountType: "fixed",
        value: 50000,
        active: true,
        salesChannels: ["pos"]
      },
      {
        id: "web-only",
        code: "WEBONLY",
        discountType: "fixed",
        value: 10000,
        active: true,
        salesChannels: ["web"]
      }
    ],
    now: NOW
  });

  assert.deepEqual(cards.map((card) => card.code), ["WEBONLY"]);
});

test("POS-only loyalty vouchers are excluded even when wallet data has no channel field", () => {
  const cards = buildHomeVoucherCards({
    coupons: [
      {
        id: "pos-loyalty",
        code: "POSLOYAL",
        voucherType: "loyalty",
        discountType: "fixed",
        value: 50000,
        active: true,
        salesChannels: ["pos"]
      }
    ],
    loyalty: {
      voucherHistory: [
        { id: "wallet-pos-loyalty", couponId: "pos-loyalty", code: "POSLOYAL", value: 50000 }
      ]
    },
    currentPhone: "0909000000",
    isRegisteredCustomer: true,
    now: NOW
  });

  assert.deepEqual(cards, []);
});
