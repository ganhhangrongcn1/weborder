import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import { calculateCheckoutPricing } from "../src/features/checkout/checkoutPricing.js";
import { buildCreateOrderPayload, validateCheckoutContact, getCheckoutPointsErrorMessage, getCheckoutVoucherErrorMessage } from "../src/services/checkoutOrderService.js";

async function loadModule(path, dependencies) {
  const context = createContext({ console: { info() {}, warn() {}, error() {} }, setTimeout, clearTimeout, AbortController: globalThis.AbortController });
  const module = new SourceTextModule(await readFile(new URL(path, import.meta.url), "utf8"), { context });
  await module.link((specifier) => {
    const exports = dependencies[specifier];
    assert.ok(exports, `Missing mock: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}

const order = { id: "test-checkout", customerPhone: "0707686521", source: "online", status: "preparing", items: [{ id: "tea", quantity: 1 }] };

async function repositoryHarness({ writable = true, write = async () => {}, remote = [] } = {}) {
  const saved = new Map();
  const queue = [];
  let verificationCount = 0;
  const { orderRepository } = await loadModule("../src/services/repositories/orderRepository.js", {
    "../storageService.js": { getCustomerKey: (phone) => String(phone || "") },
    "./appConfigRepository.js": { createRuntimeAppConfigRepository: () => ({
      setAsync: async (key, value) => saved.set(key, value), set: (key, value) => saved.set(key, value),
      get: (key, fallback) => saved.get(key) ?? fallback, getAsync: async (key, fallback) => saved.get(key) ?? fallback
    }) },
    "./coreSupabaseRepository.js": { coreSupabaseRepository: {
      upsertOrderToTable: write,
      readOrdersForPhoneFromTable: async () => { verificationCount += 1; return remote; },
      readOrdersByPhoneFromTable: async () => ({})
    } },
    "./phoneDataMigration.js": { normalizeOrdersByPhoneMap: (value) => value },
    "./runtimeStrategy.js": { getRuntimeStrategy: () => ({ effectiveSource: "supabase" }) },
    "./storageKeys.js": { STORAGE_KEYS: { currentOrder: "current", lastCreatedOrderId: "last", ordersByPhone: "orders" } },
    "./writeThroughPolicy.js": { shouldAllowLocalFallbackForDomain: () => false, shouldWriteDomainToSupabase: () => writable },
    "../posOfflineQueueService.js": { enqueuePosOfflineOrder: (entry) => queue.push(entry), removePosOfflineOrder() {} }
  });
  return { repository: orderRepository, saved, queue, verificationCount: () => verificationCount };
}

test("website cannot report success or create local history when remote writes are unavailable", async () => {
  const h = await repositoryHarness({ writable: false });
  await assert.rejects(h.repository.upsertOrderAsync(order), { code: "ORDER_REMOTE_UNAVAILABLE" });
  assert.equal(h.saved.size, 0);
  assert.equal(h.queue.length, 0);
});

test("benefit rejection leaves no local accepted order, even if an older identity exists", async () => {
  const error = Object.assign(new Error("LOYALTY_COMBINED_BENEFIT_LIMIT"), { code: "P4001" });
  const h = await repositoryHarness({ write: async () => { throw error; }, remote: [order] });
  await assert.rejects(h.repository.upsertOrderAsync(order), { code: "P4001" });
  assert.equal(h.saved.size, 0);
  assert.equal(h.verificationCount(), 0);
});

test("network failure without persisted order never adds an accepted local order", async () => {
  const h = await repositoryHarness({ write: async () => { throw new Error("network"); } });
  await assert.rejects(h.repository.upsertOrderAsync(order), /network/);
  assert.equal(h.saved.size, 0);
});

test("confirmed website write saves history only after completion and requests strict writing", async () => {
  let release;
  let strict;
  const h = await repositoryHarness({ write: async (_, options) => {
    strict = options.requireRemote;
    await new Promise((resolve) => { release = resolve; });
  } });
  const pending = h.repository.upsertOrderAsync(order);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(h.saved.size, 0);
  release();
  await pending;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(strict, true);
  assert.equal(h.saved.get("current").id, order.id);
});

test("lost response recovers an order verified on the server without duplicating it", async () => {
  const h = await repositoryHarness({ write: async () => { throw new Error("response lost"); }, remote: [order] });
  assert.equal((await h.repository.upsertOrderAsync(order)).id, order.id);
  assert.equal(h.verificationCount(), 1);
});

test("cash POS retains its existing offline queue", async () => {
  const h = await repositoryHarness({ writable: false });
  const result = await h.repository.upsertOrderAsync({ ...order, channel: "pos", paymentMethod: "cash", paymentStatus: "paid" });
  assert.equal(result.syncStatus, "pending_sync");
  assert.equal(h.queue.length, 1);
});

test("refresh corrects the reported old 51% total and requests another confirmation", async () => {
  let nextRule;
  let nextPromo;
  const { default: refreshHook } = await loadModule("../src/features/checkout/hooks/useCheckoutPricingRefresh.js", {
    "../../../services/checkoutService.js": { getCheckoutLoyaltyRuleAsync: async () => ({ maxRedemptionPercent: 30, redeemPointUnit: 1, redeemValue: 1 }) },
    "../checkoutPricing.js": { calculateCheckoutPricing }
  });
  const options = {
    pricingInput: { fulfillmentType: "pickup", baseShippingByConfig: 0, smartPromotions: [], subtotal: 85000, shippingConfig: {}, selectedPromo: { id: "SALE30", discount: 25500 }, availablePoints: 100000, usePoints: true },
    promoCodes: [{ id: "SALE30", discount: 25500 }],
    displayedPricing: { checkoutTotal: 41650, promoDiscount: 25500, pointsDiscount: 17850, pointsSpent: 17850 },
    setLoyaltyRule: (rule) => { nextRule = rule; }, setSelectedPromo: (promo) => { nextPromo = promo; }
  };
  assert.equal(await refreshHook(options)(), true);
  const next = calculateCheckoutPricing({ ...options.pricingInput, selectedPromo: nextPromo, loyaltyRule: nextRule });
  assert.equal(next.checkoutTotal, 51000);
  assert.equal(next.pointsDiscount, 8500);
  assert.equal(await refreshHook({ ...options, displayedPricing: next })(), false);
});

async function actionHarness({ changed = false, error = null } = {}) {
  const notices = [];
  const navigation = [];
  let writes = 0;
  const { default: useCheckoutActions } = await loadModule("../src/features/checkout/useCheckoutActions.js", {
    "../../services/checkoutOrderService.js": { buildCreateOrderPayload, validateCheckoutContact, getCheckoutPointsErrorMessage, getCheckoutVoucherErrorMessage },
    "../../services/qrPaymentService.js": { prewarmQrOrderPaymentSession() {} }
  });
  const actions = useCheckoutActions({
    deliveryInfo: { name: "Khách kiểm tra", phone: "0707686521" }, fulfillmentType: "pickup",
    refreshCheckoutPricing: async () => changed,
    createOrderFromCheckout: async () => { writes += 1; if (error) throw error; return order; },
    onNotice: (notice) => notices.push(notice), navigate: (route) => navigation.push(route)
  });
  await actions.handlePlaceOrder();
  return { notices, navigation, writes };
}

test("changed benefits show a review notice without creating or navigating to success", async () => {
  const h = await actionHarness({ changed: true });
  assert.equal(h.writes, 0);
  assert.equal(h.navigation.length, 0);
  assert.match(h.notices[0].message, /kiểm tra tổng tiền/);
});

test("server rejection never navigates to success; unchanged confirmed order does", async () => {
  const rejected = await actionHarness({ error: Object.assign(new Error("cap"), { code: "P4001" }) });
  assert.equal(rejected.navigation.length, 0);
  assert.match(rejected.notices[0].message, /Giỏ hàng vẫn được giữ nguyên/);
  const accepted = await actionHarness();
  assert.equal(accepted.writes, 1);
  assert.deepEqual(accepted.navigation, ["success"]);
});

test("disabled or deleted gift promotion removes stale free tea and preserves paid items", async () => {
  const { default: useCheckoutGiftPromotions } = await loadModule("../src/features/checkout/hooks/useCheckoutGiftPromotions.js", {
    react: { useEffect: (effect) => effect() },
    "../checkoutHelpers.js": { isDateInRange: () => true }
  });
  const paid = { id: "combo", quantity: 1, lineTotal: 102000 };
  const gift = { id: "tea", autoGiftByPromo: true, giftPromoId: "retired", quantity: 1, lineTotal: 0, originalLineTotal: 40000 };
  for (const smartPromotions of [[], [{ id: "retired", type: "gift_threshold", active: false, condition: { minSubtotal: 80000 }, reward: { productId: "tea" } }]]) {
    let cart = [gift, paid];
    useCheckoutGiftPromotions({ smartPromotions, subtotal: 102000, products: [{ id: "tea", price: 40000 }], setCart: (update) => { cart = update(cart); } });
    assert.equal(cart.length, 1);
    assert.equal(cart[0], paid);
    assert.equal(cart.reduce((sum, item) => sum + item.lineTotal, 0), 102000);
  }
});
