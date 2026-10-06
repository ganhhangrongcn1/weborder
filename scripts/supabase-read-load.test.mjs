import test from "node:test";
import assert from "node:assert/strict";
import startForegroundRefresh from "../src/services/foregroundRefreshService.js";
import createKeyedReadCache from "../src/services/keyedReadCache.js";
import {
  getCustomerPopularProductIds,
  clearCustomerPopularProductsCache
} from "../src/services/popularProductService.js";

const flush = async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); };
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function harness({ hidden = false, offline = false } = {}) {
  let time = 0;
  let timerId = 0;
  const timers = new Map();
  const target = () => {
    const listeners = new Map();
    return {
      addEventListener(name, fn) { listeners.set(name, fn); },
      removeEventListener(name) { listeners.delete(name); },
      fire(name) { listeners.get(name)?.(); },
      listeners
    };
  };
  const documentTarget = { ...target(), visibilityState: hidden ? "hidden" : "visible" };
  const windowTarget = {
    ...target(), navigator: { onLine: !offline },
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, at: time + delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  return {
    windowTarget, documentTarget, timers, now: () => time,
    async advance(ms) {
      time += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= time) { timers.delete(id); timer.fn(); }
      }
      await flush();
    }
  };
}

test("dashboard: hidden/offline mount, resume burst and successful refresh cadence", async () => {
  const h = harness({ hidden: true, offline: true });
  const calls = [];
  const stop = startForegroundRefresh(async (options) => { calls.push(options); return true; }, h);
  await h.advance(120000);
  assert.equal(calls.length, 0);
  h.documentTarget.visibilityState = "visible";
  h.documentTarget.fire("visibilitychange");
  assert.equal(calls.length, 0);
  h.windowTarget.navigator.onLine = true;
  h.windowTarget.fire("online");
  h.windowTarget.fire("focus");
  h.documentTarget.fire("visibilitychange");
  await flush();
  assert.deepEqual(calls, [{ force: false }]);
  await h.advance(59000);
  h.windowTarget.fire("focus");
  await flush();
  assert.equal(calls.length, 1);
  await h.advance(1000);
  assert.deepEqual(calls[1], { force: true });
  h.documentTarget.visibilityState = "hidden";
  h.documentTarget.fire("visibilitychange");
  await h.advance(180000);
  assert.equal(calls.length, 2);
  h.documentTarget.visibilityState = "visible";
  h.documentTarget.fire("visibilitychange");
  await flush();
  assert.equal(calls.length, 3);
  stop();
  assert.equal(h.timers.size, 0);
  assert.equal(h.windowTarget.listeners.size + h.documentTarget.listeners.size, 0);
});

test("dashboard: failure retries, pending request cannot overlap or restart after unmount", async () => {
  const h = harness();
  const pending = deferred();
  let calls = 0;
  const stop = startForegroundRefresh(() => { calls += 1; return calls === 1 ? false : pending.promise; }, h);
  await flush();
  await h.advance(29999);
  assert.equal(calls, 1);
  await h.advance(1);
  h.windowTarget.fire("focus");
  h.windowTarget.fire("online");
  await h.advance(120000);
  assert.equal(calls, 2);
  stop();
  pending.resolve(true);
  await flush();
  assert.equal(h.timers.size, 0);
});

test("cache clear invalidates late results and preserves a replacement in-flight request", async () => {
  const cache = createKeyedReadCache();
  const old = deferred();
  const newer = deferred();
  const first = cache.read("a", () => old.promise);
  cache.clear();
  const second = cache.read("a", () => newer.promise);
  old.resolve({ value: "old", ttlMs: 10000 });
  assert.equal(await first, "old");
  assert.equal(cache.read("a", () => assert.fail("duplicate request")), second);
  newer.resolve({ value: "new", ttlMs: 10000 });
  assert.equal(await second, "new");
  assert.equal(await cache.read("a", () => assert.fail("stale cache")), "new");
});

test("cache bounds entries and retries rejected loaders", async () => {
  const cache = createKeyedReadCache({ maxEntries: 2 });
  for (const key of ["a", "b", "c"]) await cache.read(key, async () => ({ value: key, ttlMs: 10000 }));
  assert.equal(await cache.read("a", async () => ({ value: "reloaded", ttlMs: 10000 })), "reloaded");
  await assert.rejects(cache.read("fail", async () => { throw new Error("network"); }));
  assert.equal(await cache.read("fail", async () => ({ value: "recovered" })), "recovered");
});

test("popular products: key canonicalization, concurrent callers, TTL and error cooldowns", async () => {
  const originalNow = Date.now;
  const originalClient = globalThis.__GHR_SUPABASE_CLIENT__;
  let time = 100000;
  let calls = 0;
  let error = null;
  Date.now = () => time;
  globalThis.__GHR_SUPABASE_CLIENT__ = {
    async rpc(_name, params) {
      calls += 1;
      return { error, data: [{ product_id: `${params.p_days}:${params.p_limit}`, sales_rank: 1 }] };
    }
  };
  try {
    clearCustomerPopularProductsCache();
    const [a, b, c] = await Promise.all([
      getCustomerPopularProductIds({ days: 30, limit: 12 }),
      getCustomerPopularProductIds({ days: 7, limit: 5 }),
      getCustomerPopularProductIds({ days: "30", limit: "12" })
    ]);
    assert.deepEqual(a, c);
    assert.deepEqual(b, ["7:5"]);
    assert.equal(calls, 2);
    await getCustomerPopularProductIds({ days: 30, limit: 12 });
    assert.equal(calls, 2);
    time += 15 * 60000;
    await getCustomerPopularProductIds();
    assert.equal(calls, 3);

    for (const [rpcError, ttl] of [
      [{ code: "57014", message: "cancelled" }, 30000],
      [{ code: "42501", message: "permission denied" }, 30000],
      [{ code: "PGRST202", message: "function missing" }, 300000],
      [{ code: "42703", message: "column does not exist" }, 30000]
    ]) {
      clearCustomerPopularProductsCache();
      error = rpcError;
      const before = calls;
      assert.deepEqual(await getCustomerPopularProductIds(), []);
      time += ttl - 1;
      assert.deepEqual(await getCustomerPopularProductIds(), []);
      assert.equal(calls, before + 1);
      time += 1;
      error = null;
      assert.deepEqual(await getCustomerPopularProductIds(), ["30:12"]);
      assert.equal(calls, before + 2);
    }
    clearCustomerPopularProductsCache();
    globalThis.__GHR_SUPABASE_CLIENT__.rpc = async () => { calls += 1; return { data: [], error: null }; };
    const before = calls;
    await getCustomerPopularProductIds();
    await getCustomerPopularProductIds();
    assert.equal(calls, before + 1, "valid empty results are cached");
  } finally {
    Date.now = originalNow;
    globalThis.__GHR_SUPABASE_CLIENT__ = originalClient;
    clearCustomerPopularProductsCache();
  }
});
