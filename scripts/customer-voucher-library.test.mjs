import assert from "node:assert/strict";
import test from "node:test";

import { buildCustomerVoucherLibrary } from "../src/services/customerVoucherLibraryService.js";

const NOW = new Date("2026-08-21T10:00:00+07:00");

function buildLibrary(overrides = {}) {
  return buildCustomerVoucherLibrary({
    walletVouchers: [],
    coupons: [],
    orders: [],
    channel: "web",
    now: NOW,
    ...overrides
  });
}

test("active public website voucher appears in the customer voucher library", () => {
  const vouchers = buildLibrary({
    coupons: [{
      id: 4234,
      code: "SALE30",
      name: "Giảm 30% Đơn Hàng",
      discountType: "percent",
      value: 30,
      maxDiscount: 50000,
      active: true,
      startAt: "2026-08-21",
      endAt: "2026-08-31",
      salesChannels: ["web", "qr"]
    }]
  });

  assert.deepEqual(vouchers.map((voucher) => voucher.code), ["SALE30"]);
});

test("POS-only, inactive and expired public vouchers stay hidden", () => {
  const vouchers = buildLibrary({
    coupons: [
      { code: "POSONLY", active: true, salesChannels: ["pos"] },
      { code: "INACTIVE", active: false, salesChannels: ["web"] },
      { code: "EXPIRED", active: true, endAt: "2026-08-20", salesChannels: ["web"] }
    ]
  });

  assert.deepEqual(vouchers, []);
});

test("exhausted and already-used public vouchers stay hidden", () => {
  const vouchers = buildLibrary({
    coupons: [
      { code: "GLOBALDONE", active: true, usageLimit: 10, totalUsed: 10, salesChannels: ["web"] },
      { code: "USEDONCE", active: true, perUserLimit: 1, salesChannels: ["web"] }
    ],
    orders: [{ promoCode: "USEDONCE", status: "completed" }]
  });

  assert.deepEqual(vouchers, []);
});

test("wallet voucher is preferred when its code matches a public voucher", () => {
  const walletVoucher = { id: "wallet-sale30", code: "SALE30", title: "Voucher đã nhận" };
  const vouchers = buildLibrary({
    walletVouchers: [walletVoucher],
    coupons: [{ id: 4234, code: "SALE30", active: true, salesChannels: ["web"] }]
  });

  assert.equal(vouchers.length, 1);
  assert.equal(vouchers[0], walletVoucher);
});

test("wallet voucher history is preserved while expired public vouchers are omitted", () => {
  const usedWalletVoucher = { id: "used-loyalty", code: "LOYAL10", used: true };
  const vouchers = buildLibrary({
    walletVouchers: [usedWalletVoucher],
    coupons: [{ code: "OLDPUBLIC", active: true, endAt: "2026-08-01", salesChannels: ["web"] }]
  });

  assert.deepEqual(vouchers, [usedWalletVoucher]);
});
