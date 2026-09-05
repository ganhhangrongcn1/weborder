import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { buildSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { grantWelcomeVoucherToNewMemberIfEligible } from "../src/services/loyaltyWelcomeVoucherService.js";
import { loyaltyRepository } from "../src/services/repositories/loyaltyRepository.js";
import { catalogConfigRepository } from "../src/services/repositories/catalogConfigRepository.js";
import { normalizeLoyaltyProgramConfig } from "../src/services/loyaltyProgramConfigService.js";
import { buildCustomerVoucherLibrary } from "../src/services/customerVoucherLibraryService.js";
import { buildCheckoutPromoCodes, calculateCheckoutPricing } from "../src/features/checkout/checkoutPricing.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".tmp-loyalty-pause-"));
let views;
try {
  const bundled = buildSync({
    stdin: {
      contents: 'export { default as Guest } from "./src/features/loyalty/components/GuestLoyaltyView.jsx"; export { default as Member } from "./src/features/loyalty/components/MemberLoyaltyView.jsx";',
      resolveDir: root,
      loader: "jsx"
    },
    bundle: true, platform: "node", format: "cjs", jsx: "automatic", write: false,
    external: ["react", "react/*", "react-dom", "react-dom/*"], mainFields: ["module", "main"],
    logLevel: "silent"
  });
  const output = join(temporary, "views.cjs");
  writeFileSync(output, bundled.outputFiles[0].contents);
  views = createRequire(import.meta.url)(output);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

const voucher = {
  id: "welcome-existing", type: "WELCOME_REGISTER", code: "OLDWELCOME",
  title: "Voucher đã nhận", discountType: "fixed", value: 15000,
  minOrder: 0, expiredAt: "2099-12-31", used: false, canceled: false
};

test("welcome grants respect the configured off switch", async () => {
  const original = loyaltyRepository.getCrmConfigAsync;
  loyaltyRepository.getCrmConfigAsync = async () => ({ welcomeVoucherEnabled: false });
  try {
    const result = await grantWelcomeVoucherToNewMemberIfEligible("0900000000");
    assert.equal(result.granted, false);
    assert.equal(result.reason, "welcome_voucher_disabled");
  } finally {
    loyaltyRepository.getCrmConfigAsync = original;
  }
});

test("welcome config remains enabled while preserving points and tier voucher references", () => {
  const config = normalizeLoyaltyProgramConfig({
    welcomeVoucherEnabled: true, welcomeVoucherId: "keep-welcome", maxRedemptionPercent: 30,
    tiers: [{ milestoneVoucherId: "keep-tier" }]
  });
  assert.equal(config.welcomeVoucherEnabled, true);
  assert.equal(config.welcomeVoucherId, "keep-welcome");
  assert.equal(config.tiers[0].milestoneVoucherId, "keep-tier");
  assert.equal(config.maxRedemptionPercent, 30);
});

test("new member receives welcome voucher once without a monthly tier voucher", async () => {
  const originals = [loyaltyRepository.getCrmConfigAsync, loyaltyRepository.getByPhoneAsync,
    loyaltyRepository.saveByPhoneAsync, catalogConfigRepository.getAsync];
  let account = { voucherHistory: [], totalPoints: 1200 };
  let writes = 0;
  loyaltyRepository.getCrmConfigAsync = async () => ({ welcomeVoucherEnabled: true, welcomeVoucherId: "welcome" });
  catalogConfigRepository.getAsync = async () => [{ id: "welcome", code: "HELLO", voucherType: "loyalty", value: 15000, validDaysAfterGrant: 7 }];
  loyaltyRepository.getByPhoneAsync = async () => account;
  loyaltyRepository.saveByPhoneAsync = async (_phone, next) => { writes += 1; account = next; return next; };
  try {
    assert.equal((await grantWelcomeVoucherToNewMemberIfEligible("0900000000")).granted, true);
    assert.equal((await grantWelcomeVoucherToNewMemberIfEligible("0900000000")).granted, false);
    assert.equal(writes, 1);
    assert.equal(account.totalPoints, 1200);
    assert.deepEqual(account.voucherHistory.map((item) => item.type), ["WELCOME_REGISTER"]);
  } finally {
    [loyaltyRepository.getCrmConfigAsync, loyaltyRepository.getByPhoneAsync,
      loyaltyRepository.saveByPhoneAsync, catalogConfigRepository.getAsync] = originals;
  }
});

test("previously issued welcome and monthly vouchers remain usable, expired ones do not", () => {
  for (const type of ["WELCOME_REGISTER", "TIER_MONTHLY"]) {
    const issued = { ...voucher, type };
    const wallet = buildCustomerVoucherLibrary({ walletVouchers: [issued], coupons: [] });
    assert.equal(wallet[0].code, issued.code);
    const offers = buildCheckoutPromoCodes([], [], 100000, String, [issued], []);
    assert.equal(offers[0].discount, 15000);
    assert.equal(buildCheckoutPromoCodes([], [], 100000, String, [{ ...issued, expiredAt: "2020-01-01" }], []).length, 0);
  }
});

test("voucher plus points still respects the 40 percent cap", () => {
  for (const discount of [30000, 40000]) {
    const result = calculateCheckoutPricing({
      fulfillmentType: "pickup", baseShippingByConfig: 0, smartPromotions: [], subtotal: 100000,
      shippingConfig: {}, selectedPromo: { discount }, availablePoints: 100000, usePoints: true,
      loyaltyRule: { maxRedemptionPercent: 30, redeemPointUnit: 1, redeemValue: 1 }
    });
    assert.equal(result.pointsDiscount, 40000 - discount);
    assert.equal(result.checkoutTotal, 60000);
  }
});

test("guest view offers points without promising automatic tier vouchers", () => {
  const html = renderToStaticMarkup(React.createElement(views.Guest, { navigate() {}, loyaltyRule: {} }));
  assert.ok(!html.includes("Quà tự đến khi lên hạng"));
  assert.ok(!html.includes("Voucher được tặng đúng mốc"));
  assert.ok(html.includes("Dùng điểm cho lần đặt sau"));
});

test("member view hides empty voucher section but retains issued vouchers", () => {
  const props = { navigate() {}, loyaltyRule: {}, loyalty: { totalPoints: 1000, voucherHistory: [] }, userProfile: {}, coupons: [], orders: [] };
  const empty = renderToStaticMarkup(React.createElement(views.Member, props));
  assert.ok(!empty.includes('id="loyalty-voucher-heading"'));
  const withVoucher = renderToStaticMarkup(React.createElement(views.Member, {
    ...props, loyalty: { ...props.loyalty, voucherHistory: [voucher] }
  }));
  assert.ok(withVoucher.includes(voucher.code));
  assert.ok(withVoucher.includes('id="loyalty-voucher-heading"'));
});
